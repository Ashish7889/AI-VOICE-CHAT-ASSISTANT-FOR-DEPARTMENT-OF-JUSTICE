import json
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)

def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ask_basic():
    payload = {"query": "What is the procedure?", "session_id": "test"}
    r = client.post("/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert set(["answer", "sources", "intent"]).issubset(data.keys())
