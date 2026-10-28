"""A call's own voice and language, chosen when it was requested (or the agent's own settings).

The dashboard stores the choice on the call row; the worker re-checks it here against what each
provider really supports (VOICES) before using it, and swaps the agent's voice, language, opening
line and language instructions for the duration of that one call.
"""

from . import events
from .config import settings

_KEYS = {"sarvam": "sarvam_api_key", "elevenlabs": "elevenlabs_api_key", "rumik": "rumik_api_key", "smallest": "smallest_api_key"}


def provider_ready(provider: str | None) -> bool:
    """Is there a key for this voice provider? (A key can still be wrong; failover covers that.)"""
    attr = _KEYS.get(provider or "sarvam")
    return bool(attr and (getattr(settings, attr, "") or "").strip())


def fallback_agent(agent: dict) -> dict | None:
    """The same agent speaking the same language with Sarvam, or None if Sarvam cannot do it."""
    language = agent.get("language") or "en-IN"
    choice = VOICES.get(("sarvam", language))
    if not choice:
        return None
    cfg = {k: v for k, v in (agent.get("config") or {}).items() if k not in ("tts_model", "tts_pace", "tts_description")}
    if choice.get("model"):
        cfg["tts_model"] = choice["model"]
    if choice.get("pace"):
        cfg["tts_pace"] = choice["pace"]
    return {**agent, "tts_provider": "sarvam", "tts_voice": choice["voice"], "config": cfg}


def ensure_provider_ready(agent: dict, call_sid: str | None = None) -> dict:
    """If the agent's voice provider has no key, speak with Sarvam instead of staying silent."""
    provider = agent.get("tts_provider") or "sarvam"
    if provider_ready(provider):
        return agent
    events.log("voice.provider_unavailable", "ERROR", call_sid=call_sid, provider=provider, reason="no API key configured", using="sarvam")
    return fallback_agent(agent) or agent

# (provider, language) -> how to speak that language with that provider. Only pairs that were
# measured to work are listed; anything else is refused and the agent's own voice is used.
VOICES: dict[tuple[str, str], dict] = {
    ("sarvam", "te-IN"): {"voice": "kavitha_te_conversation", "model": "bulbul:v4-flash", "pace": 1.2},
    ("sarvam", "en-IN"): {"voice": "priya", "model": "bulbul:v3"},
    ("sarvam", "hi-IN"): {"voice": "priya", "model": "bulbul:v3"},
    ("elevenlabs", "en-IN"): {"voice": "EXAVITQu4vr4xnSDxMaL"},
    ("elevenlabs", "hi-IN"): {"voice": "EXAVITQu4vr4xnSDxMaL"},
    ("smallest", "te-IN"): {"voice": "zariya", "model": "lightning_v3.1_pro"},
    ("smallest", "en-IN"): {"voice": "zariya", "model": "lightning_v3.1_pro"},
    ("smallest", "hi-IN"): {"voice": "zariya", "model": "lightning_v3.1_pro"},
    ("rumik", "en-IN"): {"voice": "zoya", "model": "mulberry", "description": "A warm, friendly, confident young woman speaking natural Indian English at a brisk, easy pace."},
    ("rumik", "hi-IN"): {"voice": "siya", "model": "mulberry", "description": "A warm, friendly, confident young woman speaking natural conversational Hindi at a brisk, easy pace."},
}

# Added to the agent's prompt when the call's language differs from the one the prompt was written
# for. The prompt's own rules (selling, honesty, hours, hangup) all still apply.
LANGUAGE_NOTES = {
    "en-IN": (
        "THIS CALL IS IN ENGLISH. Ignore every instruction above about speaking Telugu, writing Telugu "
        "script, Telugu words and Telugu spellings. Speak natural, casual, warm Indian English, the way a "
        "friendly clinic coordinator talks on the phone: short sentences (8 to 18 words, at most two), "
        "contractions, no jargon. Say prices, numbers, days and times the English way (\"four thousand five "
        "hundred rupees\", \"tomorrow, Wednesday, six in the evening\"). Use the English names of doctors and "
        "treatments from CLINIC FACTS and ignore the Telugu \"say:\" spellings. If the person answers in "
        "another language, keep to simple, clear English."
    ),
    "hi-IN": (
        "यह कॉल हिंदी में है (THIS CALL IS IN HINDI). Ignore every instruction above about speaking Telugu, "
        "writing Telugu script and Telugu spellings. Speak natural, casual, warm conversational Hindi, the way "
        "a friendly clinic coordinator talks on the phone, with common English words mixed in as people really "
        "do. Write Hindi in Devanagari, and write the English words in Devanagari too, spelled as they sound "
        "(डॉक्टर, अपॉइंटमेंट, चेकअप, क्लीनिंग, टाइम, कन्फर्म), because the voice reads Devanagari far more "
        "clearly. Short sentences (8 to 18 words, at most two). Say prices, numbers, days and times in Hindi "
        "words (\"चार हज़ार पाँच सौ रुपये\", \"कल बुधवार शाम छह बजे\"). Use Dr. names as डॉक्टर मीरा रेड्डी and "
        "डॉक्टर अर्जुन राव, and ignore the Telugu \"say:\" spellings."
    ),
}


def supported(provider: str | None, language: str | None) -> bool:
    return (provider, language) in VOICES


def apply_voice_override(agent: dict, override: dict | None, call_sid: str | None = None) -> dict:
    """The agent as this call should run it. The stored agent is never changed."""
    if not override:
        return agent
    provider = override.get("tts_provider")
    language = override.get("language")
    base_provider = agent.get("tts_provider") or "sarvam"
    base_language = agent.get("language") or "en-IN"
    provider = base_provider if provider in (None, "agent") else provider
    language = base_language if language in (None, "agent") else language
    if (provider, language) == (base_provider, base_language):
        return agent
    if not supported(provider, language):
        events.log("voice.override_refused", "WARNING", call_sid=call_sid, provider=provider, language=language)
        return agent

    choice = VOICES[(provider, language)]
    cfg = dict(agent.get("config") or {})
    for key in ("tts_model", "tts_pace", "tts_description"):
        cfg.pop(key, None)
    if choice.get("model"):
        cfg["tts_model"] = choice["model"]
    if choice.get("pace"):
        cfg["tts_pace"] = choice["pace"]
    if choice.get("description"):
        cfg["tts_description"] = choice["description"]

    out = {**agent, "tts_provider": provider, "tts_voice": choice["voice"], "language": language, "config": cfg}
    if language != base_language:
        # The agent's saved opening line is in its own language. Use one written for this language,
        # if the agent has it; otherwise the model opens the call itself.
        greeting = (cfg.get("greetings") or {}).get(language)
        cfg["outbound_first_message"] = greeting
        out["first_message"] = greeting
        out["language_note"] = LANGUAGE_NOTES.get(language)
    events.log("voice.override", call_sid=call_sid, provider=provider, language=language, voice=choice["voice"], scripted_opening=bool(out.get("config", {}).get("outbound_first_message")))
    return out
