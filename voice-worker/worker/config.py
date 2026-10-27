from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    elevenlabs_api_key: str = ""
    rumik_api_key: str = ""
    rumik_gateway_url: str = "https://silk-api.rumik.ai"
    voicelink_api_token: str = ""

    supabase_url: str = "http://localhost:8001"
    supabase_service_role_key: str = ""

    ws_token: str = ""

    # After Sarvam's final transcript the turn-end strategy waits this long for a follow-up fragment
    # before handing the turn to the LLM. Pipecat's default is 0.5 s, pure dead air on every turn.
    turn_stop_timeout_secs: float = 0.1

    # Safety nets for calls the agent does not end itself (VoiceLink never hangs up on its own).
    max_call_secs: int = 600
    silence_hangup_secs: int = 25
    # A quiet line gets one "can you hear me?" after this long, then a hangup if still quiet.
    nudge_secs: int = 7
    hangup_after_nudge_secs: int = 10
    # Outbound: how long to wait for the person's "hello" before speaking first.
    outbound_wait_secs: float = 3.5

    # Native 8 kHz synthesis, latency-sorted LLM routing. Turn off only to compare.
    low_latency: bool = True
    # Reasoning models (e.g. DeepSeek V4) think before answering, which adds seconds of
    # dead air on a phone call. Ask OpenRouter to skip it.
    llm_disable_thinking: bool = True

    # Cost accounting. USD->INR converts OpenRouter's dollar figure; Sarvam bills real-time
    # speech-to-text per minute of audio (pay-as-you-go rate).
    usd_to_inr: float = 88.0
    sarvam_stt_inr_per_min: float = 0.49
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
