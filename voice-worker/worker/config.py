from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    elevenlabs_api_key: str = ""
    voicelink_api_token: str = ""

    supabase_url: str = "http://localhost:8001"
    supabase_service_role_key: str = ""

    ws_token: str = ""

    # Native 8 kHz synthesis, latency-sorted LLM routing. Turn off only to compare.
    low_latency: bool = True
    # Reasoning models (e.g. DeepSeek V4) think before answering, which adds seconds of
    # dead air on a phone call. Ask OpenRouter to skip it.
    llm_disable_thinking: bool = True
    # Sarvam server-side end-of-speech wait in ms. Its default (~1.2 s) is the biggest single
    # source of lag; 300 ms measured about 0.7 s faster with identical transcripts.
    sarvam_silence_ms: int | None = 300
    # "vad": Sarvam's server decides when the caller is done. "manual": our own voice
    # activity detector does, which ends the turn much sooner.
    sarvam_endpointing: str = "vad"
    # Voice-activity detector timing. A quick start keeps the first word; a slightly longer
    # stop keeps the last one. Only the end-of-turn side adds latency.
    vad_start_secs: float = 0.2
    vad_stop_secs: float = 0.2


settings = Settings()
