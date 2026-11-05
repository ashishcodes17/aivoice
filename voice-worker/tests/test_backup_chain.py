"""Backup voice / STT selection. Run: .venv/bin/python tests/test_backup_chain.py (no network)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from worker.config import settings
from worker import voices


def with_keys(**keys):
    for k in ("sarvam_api_key", "gnani_api_key", "elevenlabs_api_key"):
        setattr(settings, k, keys.get(k, ""))


def providers(agent):
    return [b["tts_provider"] for b in voices.tts_backup_chain(agent)]


# Sarvam agent: Gnani stands by (this is the case that went silent when Sarvam credits ran out).
with_keys(sarvam_api_key="x", gnani_api_key="x")
assert providers({"tts_provider": "sarvam", "language": "te-IN"}) == ["gnani"]
b = voices.tts_backup_chain({"tts_provider": "sarvam", "language": "en-IN", "config": {"tts_model": "bulbul:v3"}})[0]
assert b["tts_voice"] == "Lakshmi" and b["config"]["tts_model"] == "timbre-v3.0", b

# Non-Sarvam agent keeps Sarvam first (unchanged), then Gnani if it is not the primary.
assert providers({"tts_provider": "smallest", "language": "en-IN"}) == ["sarvam", "gnani"]
assert providers({"tts_provider": "gnani", "language": "en-IN"}) == ["sarvam"]

# No key -> not listed; no measured voice for the language -> not listed; agent default is Sarvam.
with_keys(sarvam_api_key="x")
assert providers({"tts_provider": "sarvam", "language": "te-IN"}) == []
with_keys(sarvam_api_key="x", gnani_api_key="x")
assert providers({"tts_provider": "sarvam", "language": "ta-IN"}) == []
assert providers({"language": "hi-IN"}) == ["gnani"]
assert voices.tts_backup_chain({"tts_provider": "elevenlabs", "language": "en-IN"})[0]["tts_provider"] == "sarvam"
print("tts backup chain: ok")

try:
    from worker import bot
except Exception as e:  # missing env or deps: report, don't hide
    print("bot import skipped:", type(e).__name__, str(e)[:120]); sys.exit(0)
settings.sarvam_endpointing = "vad"
with_keys(sarvam_api_key="x", elevenlabs_api_key="x", gnani_api_key="x")
# Sarvam's own speech boundaries drive turns: only providers that report boundaries can stand in.
assert bot._stt_backup_providers({}) == ["gnani"]
assert bot._stt_backup_providers({"stt_provider": "gnani"}) == ["sarvam"]
# ElevenLabs relies on a local VAD, so under external turns it is never a backup.
with_keys(sarvam_api_key="x", elevenlabs_api_key="x")
assert bot._stt_backup_providers({}) == []
# Local-VAD turns (Sarvam not in "vad" mode, or ElevenLabs primary): Sarvam/ElevenLabs back each other.
assert bot._stt_backup_providers({"stt_provider": "elevenlabs"}) == ["sarvam"]
settings.sarvam_endpointing = "other"
assert bot._stt_backup_providers({}) == ["elevenlabs"]
settings.sarvam_endpointing = "vad"
with_keys(sarvam_api_key="x")
assert bot._stt_backup_providers({}) == []
print("stt backups: ok")
