from __future__ import annotations
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Centralized settings loaded from environment variables.
# Do NOT hardcode secrets here; set them in your environment or compose/k8s.

# Mistral API settings
MISTRAL_API_KEY: Optional[str] = os.getenv("MISTRAL_API_KEY")
MISTRAL_MODEL: str = os.getenv("MISTRAL_MODEL", "mistral-tiny")
MISTRAL_TEMPERATURE: float = float(os.getenv("MISTRAL_TEMPERATURE", "0.2"))
MISTRAL_MAX_TOKENS: int = int(os.getenv("MISTRAL_MAX_TOKENS", "256"))

ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # default voice id (Rachel)
ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

# App behavior toggles
USE_LLM: bool = bool(MISTRAL_API_KEY)
USE_TTS: bool = bool(ELEVENLABS_API_KEY)
