import json
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)

def test_upload_and_search():
    # Generate admin JWT
    import jwt
    token = jwt.encode({"sub": "admin", "role": "admin"}, "change_me", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    # Upload a new document with proper file format
    file_content = b"Demo document for testing upload."
    files = {"file": ("demo.txt", file_content, "text/plain")}
    resp = client.post("/upload", files=files, headers=headers)
    print(f"Upload response status: {resp.status_code}")
    print(f"Upload response body: {resp.text}")
    assert resp.status_code == 200
    doc_id = resp.json()["doc_id"]
    # Search for a word in the uploaded document
    resp2 = client.get("/search", params={"q": "demo"})
    assert resp2.status_code == 200
    results = resp2.json()["results"]
    assert any(doc_id == r["id"] for r in results)
