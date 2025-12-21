# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Python 3.11 FastAPI backend serving a statically built React frontend (if present under frontend/).
- Containerized with Docker; runnable via Docker Compose; deployable to Kubernetes using k8s-deployment.yaml.
- Core capabilities: FAQ/document retrieval (RAG-style, stubbed), JWT-gated admin upload, basic PII redaction, anonymized request logging.

Common commands
- Local dev (Windows PowerShell)
  1) Create venv and install deps
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     pip install -r requirements.txt
  2) Run API (auto-reload)
     uvicorn backend.server:app --reload
  3) Open http://localhost:8000

- Tests (pytest-based)
  Note: pytest is not listed in requirements.txt. Install it once for local testing:
  pip install pytest
  Run entire suite:
  pytest -q
  Run a single test:
  pytest tests/test_api.py::test_healthz -q

- Docker
  Build and run image:
  docker build -t doj-va .
  docker run -p 8000:8000 doj-va

- Docker Compose
  Start (build + detached):
  docker compose up --build -d
  Tail logs:
  docker compose logs -f app
  Stop:
  docker compose down

- Kubernetes (example)
  kubectl apply -f k8s-deployment.yaml

- Linting
  No linter is configured in this repo (no ruff/flake8 config detected).

Environment
The service reads these environment variables (defaults shown where applicable):
- JWT_SECRET (default: "change_me")
- ALLOWED_ORIGINS (default: "*")
- DATA_RETENTION_DAYS (default: 30)
- CACHE_TTL_SECONDS (default: 600)
- VECTOR_BACKEND (default: "stub")
You can provide these via docker-compose.yml or your shell/CI environment. README mentions a .env based on .env.example, but no .env.example is present in the repo.

High-level architecture and flow
- backend/server.py (FastAPI app)
  - App setup: CORS via ALLOWED_ORIGINS, title/version, and optional static UI mount from frontend/ at "/".
  - Middleware: request logging with hashed IP (PII minimized), simple PII redaction utility used when logging queries.
  - Auth: Bearer JWT parsing; require_admin dependency for protected routes (e.g., /upload). Secret: JWT_SECRET.
  - Routes:
    - GET /healthz: Health check.
    - POST /ask: Accepts AskRequest {query, session_id?, top_k?, language?}. Calls nlp.answer_query, returns AskResponse-like JSON via JSONResponse.
    - POST /upload (admin-only): Accepts a file; for text/*, reads content and indexes it; for other types, stores an informational note. Persists via db.add_document.
    - GET /search: Keyword search endpoint; returns ranked results from db.search.

- backend/nlp.py (answer synthesis with guardrails)
  - Detects sensitive intents (e.g., personal legal advice) and returns a refusal with a disclaimer.
  - For normal queries: calls db.search(query, top_k), builds a concise, grounded answer from returned snippets, and returns structured JSON: {answer, sources, intent}.
  - No external LLM/vector service calls; behavior is deterministic and data-grounded.

- backend/db.py (minimal persistence + retrieval)
  - Stores a simple JSON index at backend/data/index.json; auto-creates directory.
  - add_document/add_documents to append items: {id, text, metadata}.
  - Token-overlap scoring for search; returns top_k hits with {id, score, metadata, snippet} where score > 0.

- tests/test_api.py (FastAPI TestClient)
  - Smoke tests: /healthz and POST /ask happy-path JSON contract.

- Dockerfile / docker-compose.yml
  - Dockerfile installs requirements, copies backend and frontend, and launches via uvicorn on port 8000.
  - docker-compose.yml sets env vars (JWT_SECRET, ALLOWED_ORIGINS, DATA_RETENTION_DAYS, CACHE_TTL_SECONDS, VECTOR_BACKEND) and maps port 8000.

- k8s-deployment.yaml
  - Deployment (replicas=3), Service (port 80 -> 8000), HPA (CPU-based), ConfigMap for non-secret config, Secret for JWT_SECRET, probes at /healthz.

Security posture (from README and code)
- Admin-only uploads gated by JWT (Bearer token with HS256 using JWT_SECRET).
- PII redaction applied to logged query text; IPs hashed before logging.
- Data retention days parameter available via env (enforced at app-level policy, not an automated janitor in code).

Notes for future Warp agents
- For quick iteration on endpoints, run uvicorn with --reload and target the FastAPI app at backend.server:app.
- When running tests, ensure pytest is installed locally since it’s not listed in requirements.txt.
- The “RAG” behavior is a stub over a local JSON index; production vector backends are not wired. Adjust VECTOR_BACKEND or extend db.py as needed.
