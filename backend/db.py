from __future__ import annotations
import os
import json
import uuid
import re
from typing import List, Dict, Any
from pathlib import Path
import logging

# Temporarily disable Pinecone import
# try:
#     from pinecone import Pinecone, ServerlessSpec
#     PINECONE_AVAILABLE = True
# except ImportError:
#     PINECONE_AVAILABLE = False
#     Pinecone = None
PINECONE_AVAILABLE = False
Pinecone = None

DATA_DIR = Path(__file__).resolve().parent / "data"
INDEX_PATH = DATA_DIR / "index.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)

# Vector backend configuration
VECTOR_BACKEND = os.getenv("VECTOR_BACKEND", "stub")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = "doj-documents"

# Initialize Pinecone if available and configured
_pinecone_client = None
_pinecone_index = None

# Temporarily disable Pinecone to get server running
# if PINECONE_AVAILABLE and VECTOR_BACKEND == "pinecone" and PINECONE_API_KEY:
#     try:
#         _pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
#         # Create index if it doesn't exist
#         try:
#             existing_indexes = _pinecone_client.list_indexes()
#             index_names = existing_indexes.names() if hasattr(existing_indexes, 'names') else []
#             if PINECONE_INDEX_NAME not in index_names:
#                 _pinecone_client.create_index(
#                     name=PINECONE_INDEX_NAME,
#                     dimension=1536,  # OpenAI embedding dimension
#                     metric="cosine",
#                     spec=ServerlessSpec(cloud="aws", region="us-east-1")
#                 )
#         except Exception as index_error:
#             logging.warning(f"Index check failed: {index_error}")
#             # Try to create index anyway
#             try:
#                 _pinecone_client.create_index(
#                     name=PINECONE_INDEX_NAME,
#                     dimension=1536,
#                     metric="cosine",
#                     spec=ServerlessSpec(cloud="aws", region="us-east-1")
#                 )
#             except:
#                 pass  # Index might already exist
#         
#         _pinecone_index = _pinecone_client.Index(PINECONE_INDEX_NAME)
#         logging.info("Pinecone initialized successfully")
#     except Exception as e:
#         logging.error(f"Failed to initialize Pinecone: {e}")
#         _pinecone_client = None
#         _pinecone_index = None

# Fallback to stub if Pinecone fails
if not _pinecone_index:
    VECTOR_BACKEND = "stub"

# Very small, keyword-based search as a minimal, runnable stub.
# In production, replace with FAISS/Pinecone/Weaviate integration.

_index: List[Dict[str, Any]] = []

def _load_index():
    global _index
    if INDEX_PATH.exists():
        try:
            _index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        except Exception:
            _index = []


def _save_index():
    try:
        INDEX_PATH.write_text(json.dumps(_index, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

_load_index()

TOKEN_SPLIT = re.compile(r"\W+", re.UNICODE)

def _score(text: str, query: str) -> int:
    text_tokens = set(t.lower() for t in TOKEN_SPLIT.split(text) if t)
    q_tokens = [t.lower() for t in TOKEN_SPLIT.split(query) if t]
    # Simple score: count of overlapping tokens
    return sum(1 for t in q_tokens if t in text_tokens)


def add_document(text: str, metadata: Dict[str, Any] | None = None) -> str:
    doc_id = str(uuid.uuid4())
    doc = {"id": doc_id, "text": text, "metadata": metadata or {}}
    
    if VECTOR_BACKEND == "pinecone" and _pinecone_index:
        # Simple embedding using text hash as placeholder (replace with real embeddings)
        import hashlib
        text_hash = hashlib.md5(text.encode()).hexdigest()
        # Create a simple embedding vector (1536 dimensions with normalized values)
        embedding = [float(int(text_hash[i:i+2], 16)) / 255.0 for i in range(0, min(len(text_hash), 306), 2)]
        # Pad to 1536 dimensions
        embedding.extend([0.0] * (1536 - len(embedding)))
        
        try:
            _pinecone_index.upsert(
                vectors=[{
                    "id": doc_id,
                    "values": embedding,
                    "metadata": {"text": text, **(metadata or {})}
                }]
            )
        except Exception as e:
            logging.error(f"Failed to upsert to Pinecone: {e}")
            # Fallback to stub
            _index.append(doc)
            _save_index()
    else:
        # Fallback to stub
        _index.append(doc)
        _save_index()
    
    return doc_id


def add_documents(docs: List[Dict[str, Any]]) -> List[str]:
    ids = []
    for d in docs:
        ids.append(add_document(text=d.get("text", ""), metadata=d.get("metadata", {})))
    return ids


def search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    if VECTOR_BACKEND == "pinecone" and _pinecone_index:
        try:
            # Create simple embedding for query
            import hashlib
            query_hash = hashlib.md5(query.encode()).hexdigest()
            query_embedding = [float(int(query_hash[i:i+2], 16)) / 255.0 for i in range(0, min(len(query_hash), 306), 2)]
            query_embedding.extend([0.0] * (1536 - len(query_embedding)))
            
            # Search Pinecone
            results = _pinecone_index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True
            )
            
            # Format results
            formatted_results = []
            for match in results.get("matches", []):
                metadata = match.get("metadata", {})
                formatted_results.append({
                    "id": match["id"],
                    "score": match["score"],
                    "metadata": {k: v for k, v in metadata.items() if k != "text"},
                    "snippet": metadata.get("text", "")[:400],
                })
            
            return formatted_results
            
        except Exception as e:
            logging.error(f"Pinecone search failed: {e}")
            # Fallback to stub
    
    # Fallback to stub search
    ranked = sorted(
        (
            {
                "id": d["id"],
                "score": _score(d.get("text", ""), query),
                "metadata": d.get("metadata", {}),
                "snippet": d.get("text", "")[:400],
            }
            for d in _index
        ),
        key=lambda x: x["score"], reverse=True,
    )
    return [r for r in ranked[: max(top_k, 1)] if r["score"] > 0]
