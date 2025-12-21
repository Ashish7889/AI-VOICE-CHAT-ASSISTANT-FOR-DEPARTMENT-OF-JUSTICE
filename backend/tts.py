from __future__ import annotations
import io
import requests
from typing import Optional
from . import settings

# ElevenLabs TTS integration (if ELEVENLABS_API_KEY set). Returns MP3 bytes.

def synthesize(text: str) -> Optional[bytes]:
    if not settings.USE_TTS or not settings.ELEVENLABS_API_KEY:
        return None
    text = text.strip()
    if not text:
        return None
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{settings.ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": settings.ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.4,
            "similarity_boost": 0.75,
        },
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        if r.status_code == 200 and r.content:
            return r.content
        return None
    except Exception:
        return None