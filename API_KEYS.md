# API Keys Required for Full Functionality

The DoJ Virtual Assistant can run in basic mode without any API keys, but for enhanced functionality, you'll need the following optional API keys:

## Required API Keys for Enhanced Features

### 1. Mistral API (Optional - for Enhanced AI Responses)

**Purpose**: Provides advanced language model capabilities for more intelligent and contextual responses.

**Where to get it**:
- Visit [Mistral AI Console](https://console.mistral.ai/)
- Create an account and generate an API key
- Add billing information (pay-per-use model)

**Environment variables to set**:
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
MISTRAL_MODEL=mistral-small-latest  # or mistral-large-latest for better quality
MISTRAL_TEMPERATURE=0.2  # Controls randomness (0.0-1.0)
MISTRAL_MAX_TOKENS=512   # Maximum response length
```

**Cost**: Approximately $0.2-$2 per 1M tokens depending on model chosen.

### 2. ElevenLabs API (Optional - for Text-to-Speech)

**Purpose**: Converts text responses to high-quality speech audio for accessibility and voice interactions.

**Where to get it**:
- Visit [ElevenLabs](https://elevenlabs.io/)
- Create an account and get your API key from the profile section
- Choose a subscription plan (free tier available with limitations)

**Environment variables to set**:
```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM     # Rachel voice (default)
ELEVENLABS_MODEL_ID=eleven_multilingual_v2    # Supports multiple languages
```

**Cost**: Free tier includes 10,000 characters/month. Paid plans start at $5/month.

## Fallback Behavior

### Without Mistral API
- The system uses a rule-based approach with keyword matching
- Responses are based on exact document snippets from the knowledge base
- Less contextual but still functional for basic FAQ queries

### Without ElevenLabs API  
- Falls back to browser-based text-to-speech (speechSynthesis API)
- Works offline but with lower quality voice synthesis
- Limited language support compared to ElevenLabs

## Configuration

1. Copy the provided `.env.example` to `.env`
2. Add your API keys to the `.env` file:

```bash
# Copy from .env.example and add your keys
JWT_SECRET=change_me_to_secure_secret
ALLOWED_ORIGINS=*
DATA_RETENTION_DAYS=30
CACHE_TTL_SECONDS=600
VECTOR_BACKEND=stub

# Add these for enhanced functionality
MISTRAL_API_KEY=your_key_here
MISTRAL_MODEL=mistral-small-latest
ELEVENLABS_API_KEY=your_key_here
```

3. Restart the application to load the new configuration.

## Testing API Keys

After adding API keys, you can test them:

```bash
# Test Mistral integration
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What are my rights under Indian law?"}'

# Test TTS integration  
curl http://localhost:8000/tts?text="Hello from DoJ Assistant"
```

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables in production deployments
- Consider using secrets management services for production
- Rotate API keys periodically for security

## Support

- Mistral AI: [Documentation](https://docs.mistral.ai/)
- ElevenLabs: [Documentation](https://docs.elevenlabs.io/)

For basic functionality without these services, the application works perfectly with the built-in keyword search and browser TTS capabilities.