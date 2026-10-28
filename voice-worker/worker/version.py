"""What this worker can do and which of its secrets are configured, without exposing any secret.

Served at /debug/status (token protected). Exists because "is the new code deployed, and does it
have its keys?" otherwise takes a phone call and a log dig to answer.
"""

import os

from .config import settings

# Bump when a capability is added. Seeing a name here means the deployed code has it.
FEATURES = (
    "scripted_opening",
    "outcome_summary",
    "guarded_barge_in",
    "call_context",
    "voice_override",
    "tts_failover",
    "sarvam_llm",
    "sarvam_tts_temperature",
    "smallest_tts",
    "gnani_tts",
    "latency_probe",
    "wideband_16k",
)


def status() -> dict:
    keys = {
        "openrouter": settings.openrouter_api_key,
        "sarvam": settings.sarvam_api_key,
        "elevenlabs": settings.elevenlabs_api_key,
        "rumik": settings.rumik_api_key,
        "smallest": settings.smallest_api_key,
        "gnani": settings.gnani_api_key,
        "supabase_service_role": settings.supabase_service_role_key,
        "voicelink": settings.voicelink_api_token,
        "ws_token": settings.ws_token,
    }
    return {
        "features": list(FEATURES),
        "commit": os.environ.get("SOURCE_COMMIT") or os.environ.get("GIT_COMMIT") or "unknown",
        # only whether each is set, never what it is
        "keys_configured": {name: bool(value and value.strip()) for name, value in keys.items()},
    }
