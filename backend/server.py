from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import jwt
import os
import re
import hashlib
import logging
from typing import Optional, List, Dict

from . import nlp
from . import db
from . import tts
from . import settings

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
DATA_RETENTION_DAYS = int(os.getenv("DATA_RETENTION_DAYS", "30"))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "600"))

app = FastAPI(title="DoJ Virtual Assistant", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static UI
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.isdir(static_dir):
    app.mount("/ui", StaticFiles(directory=static_dir, html=True), name="ui")

# Simple PII redaction (email, phone, Aadhaar-like)
PII_PATTERNS = [
    re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    re.compile(r"\b\+?\d[\d\s\-]{7,14}\b"),
    re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),  # 12-digit patterns
]

def redact_pii(text: str) -> str:
    redacted = text
    for pat in PII_PATTERNS:
        redacted = pat.sub("[REDACTED]", redacted)
    return redacted

# Logging middleware with anonymization
@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    anon_ip = hashlib.sha256(client_ip.encode()).hexdigest()[:10]
    path = request.url.path
    method = request.method
    # Do not read body to avoid holding large payloads in memory; log minimal
    response = await call_next(request)
    logging.getLogger("uvicorn.error").info(f"{method} {path} ip={anon_ip} status={response.status_code}")
    return response

# Auth utilities
class User(BaseModel):
    sub: str
    role: str = "user"


def get_user_from_jwt(authorization: Optional[str]) -> Optional[User]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])  # nosec
        return User(sub=payload.get("sub", "unknown"), role=payload.get("role", "user"))
    except Exception:
        return None


def get_current_user(request: Request) -> Optional[User]:
    authorization = request.headers.get("Authorization")
    return get_user_from_jwt(authorization)

def require_admin(user: Optional[User] = Depends(get_current_user)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=401, detail="Admin token required")
    return user

# Models
class AskRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    top_k: int = 5
    language: Optional[str] = None

class AskResponse(BaseModel):
    answer: str
    sources: List[Dict]
    intent: str

# Routes
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# Serve landing page at root if available; otherwise redirect to /ui/
@app.get("/")
async def root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return RedirectResponse(url="/ui/")

@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest, request: Request):
    clean_query = req.query.strip()
    if not clean_query:
        raise HTTPException(status_code=400, detail="query is required")
    redacted_for_log = redact_pii(clean_query)
    logging.getLogger("uvicorn.error").info(f"ask: {redacted_for_log[:200]}")
    result = nlp.answer_query(query=clean_query, session_id=req.session_id, top_k=req.top_k, language=req.language)
    return JSONResponse(content=result)

@app.post("/upload")
async def upload(file: UploadFile = File(...), user: User = Depends(require_admin)):
    # Enhanced text extraction: support text files and PDFs
    content: str
    content_type = file.content_type or ""
    filename_lower = (file.filename or "").lower()
    
    if content_type.startswith("text") or filename_lower.endswith('.txt'):
        content_bytes = await file.read()
        content = content_bytes.decode('utf-8', errors='ignore')
        # Remove null bytes and clean up text
        content = content.replace('\x00', '')
        content = ' '.join(content.split())  # Normalize whitespace
    elif content_type == "application/pdf" or filename_lower.endswith('.pdf'):
        try:
            import fitz  # PyMuPDF
            content_bytes = await file.read()
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            content = ""
            for page in doc:
                # Try multiple text extraction methods for better results
                page_text = page.get_text()
                # Clean up common encoding issues
                page_text = page_text.encode('utf-8', errors='ignore').decode('utf-8')
                # Remove excessive whitespace and normalize
                page_text = ' '.join(page_text.split())
                content += page_text + "\n"
            doc.close()
            
            # Additional cleanup for bilingual documents
            if content.strip():
                # Try to extract English content primarily
                import re
                # Remove common Hindi character patterns that cause encoding issues
                content = re.sub(r'[^\x00-\x7F\u0900-\u097F\s\.,;:!?\-\n\r\(\)\[\]\{\}"\'\/]', '', content)
                # Clean up multiple spaces
                content = re.sub(r'\s+', ' ', content)
            else:
                content = f"PDF '{file.filename}' contains no extractable text."
                
        except Exception as e:
            content = f"Error extracting text from PDF '{file.filename}': {str(e)}"
    else:
        content = f"Uploaded file '{file.filename}' of type {content_type}. Text extraction not enabled for this file type."
    doc_id = db.add_document(text=content, metadata={"filename": file.filename, "uploader": user.sub})
    return {"status": "indexed", "doc_id": doc_id}

@app.get("/search")
async def search(q: str, top_k: int = 5):
    if not q:
        raise HTTPException(status_code=400, detail="q required")
    results = db.search(q, top_k=top_k)
    return {"results": results}

@app.api_route("/tts", methods=["GET", "POST"])
async def tts_endpoint(text: str):
    if not text.strip():
        raise HTTPException(status_code=400, detail="text required")
    audio = tts.synthesize(text)
    if not audio:
        raise HTTPException(status_code=400, detail="TTS not configured or failed")
    return Response(content=audio, media_type="audio/mpeg")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True) 
