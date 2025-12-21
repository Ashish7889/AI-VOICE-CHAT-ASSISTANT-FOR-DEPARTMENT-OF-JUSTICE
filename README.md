# DoJ Virtual Assistant (AI Chatbot)

Production-ready virtual assistant for the Department of Justice: FAQs, document retrieval (RAG), multilingual, and voice support. Backend: FastAPI. Frontend: React (served statically). Containerized with Docker, deployable to Kubernetes.

## Quickstart

1. Python 3.11+
2. Install deps: `pip install -r requirements.txt`
3. Run: `uvicorn backend.server:app --reload`
4. Open: http://localhost:8000

## Environment
Create a `.env` based on `.env.example`.

## Security
- JWT for admin upload
- PII redaction middleware
- Logs anonymized
- Data retention controlled via env

## Docker
```
docker build -t doj-va .
docker run -p 8000:8000 doj-va
```

## Kubernetes
See `k8s-deployment.yaml`.


## Demo Usage

### Try the Assistant
1. Start the backend: `uvicorn backend.server:app --reload`
2. Open [http://localhost:8000/ui/](http://localhost:8000/ui/) in your browser.
3. Ask: `What is the procedure for filing a complaint?` (uses the sample document).

### Upload Documents (Admin Only)
To upload, you need an admin JWT. For demo, use:

```
import jwt
token = jwt.encode({"sub": "admin", "role": "admin"}, "change_me", algorithm="HS256")
print(token)
```
Then use this token as a Bearer token in the `Authorization` header for `/upload`.

### Run Tests
```
pytest tests/
```
