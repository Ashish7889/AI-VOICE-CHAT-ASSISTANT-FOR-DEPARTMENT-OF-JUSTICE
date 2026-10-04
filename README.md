# AI-VOICE-CHAT-ASSISTANT-FOR-DEPARTMENT-OF-JUSTICE

The DoJ Virtual Assistant transforms citizen access to judicial information using AI and NLP. It enhances transparency, efficiency, and engagement while reducing staff workload. In the future, it can expand across ministries, creating a network of AI-driven governance tools for a more transparent and digitally empowered India.

## Features
- **AI Lawyer Persona**: Acts as a helpful legal assistant for poor people who don't know their rights and laws
- **Detailed Legal Information**: Provides IPC sections, punishments, and years of imprisonment for criminal cases
- **Multilingual Support**: Responds in the same language as user input
- **Simple Language**: Explains complex legal concepts in easy-to-understand terms
- **Mistral API Integration**: Uses Mistral AI for comprehensive legal assistance

## Quickstart

1. Python 3.11+
2. Install deps: `pip install -r requirements.txt`
3. Create a `.env` based on `.env.example` with your Mistral API key
4. Run: `uvicorn backend.server:app --reload`
5. Open: http://localhost:8000

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
3. Ask: "What are my rights if police arrests me without reason?" (AI will provide IPC sections and punishments)

### Upload Documents (Admin Only)
To upload, you need an admin JWT. For demo, use:

```
import jwt
token = jwt.encode({"sub": "admin", "role": "admin"}, "generate_a_long_random_secret_here", algorithm="HS256")
print(token)
```
Then use this token as a Bearer token in the `Authorization` header for `/upload`.

### Run Tests
```
pytest tests/
```
