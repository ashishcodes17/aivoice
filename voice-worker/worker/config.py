from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    elevenlabs_api_key: str = ""
    rumik_api_key: str = ""
    smallest_api_key: str = ""
    # Seconds to wait before hanging up on a Smallest voice, so the goodbye is heard first.
    smallest_end_hold_secs: float = 3.5
    rumik_gateway_url: str = "https://silk-api.rumik.ai"
    # 0 = do not send max_new_tokens (Rumik's default cap of 2048 applies).
    rumik_max_new_tokens: int = 0
    voicelink_api_token: str = ""

    supabase_url: str = "http://localhost:8001"
    supabase_service_role_key: str = ""

    ws_token: str = ""

    # After Sarvam's final transcript the turn-end strategy waits this long for a follow-up fragment
    # before handing the turn to the LLM. 0.1 s answered faster but split sentences with a pause in
    # them into two turns, so the agent started replying and was cut off by the second half.
    turn_stop_timeout_secs: float = 0.5
    # While the agent is speaking, the caller interrupts her only with at least this many words;
    # a lone sound (cough, TV, line noise) no longer cuts her off mid-sentence.
    barge_in_min_words: int = 2
    # Also protect the reply for this long after the caller finishes, while it is being written.
    # 0 turns that off.
    barge_in_thinking_secs: float = 4.0

    # Safety nets for calls the agent does not end itself (VoiceLink never hangs up on its own).
    max_call_secs: int = 600
    silence_hangup_secs: int = 25
    # A quiet line gets one "can you hear me?" after this long, then a hangup if still quiet.
    nudge_secs: int = 7
    hangup_after_nudge_secs: int = 10
    # The agent said goodbye but forgot end_call: hang up if nobody speaks for this long.
    goodbye_grace_secs: float = 4
    # Outbound: how long to wait for the person's "hello" before speaking first.
    outbound_wait_secs: float = 1.2

    # LLM resilience: OpenRouter falls back to these models (comma-separated) if the agent's model
    # fails, and a request that produces no text within the timeout is re-sent once.
    llm_fallback_models: str = "deepseek/deepseek-v4.1-flash-1017,deepseek/deepseek-v4-flash"
    # OpenRouter provider routing: "latency" (time to first token) or "throughput" (tokens/s), plus
    # optional p50 floors: tokens/s, and seconds to first token.
    # Model that reads each finished call's transcript and records its outcome.
    record_outcomes: bool = True
    outcome_model: str = "deepseek/deepseek-v4.1-flash"
    llm_provider_sort: str = "latency"
    llm_min_throughput_p50: float | None = 100
    llm_max_latency_p50: float | None = None
    llm_retry_timeout_secs: float = 1.5
    # When an agent uses a Sarvam LLM ("sarvam-..."), this OpenRouter model takes over if it fails.
    sarvam_llm_backup_model: str = "deepseek/deepseek-v4.1-flash"

    # Pipecat logs every LLM request in full at DEBUG, which is a lot of I/O on a live call.
    log_level: str = "INFO"

    # Native 8 kHz synthesis, latency-sorted LLM routing. Turn off only to compare.
    low_latency: bool = True
    # Ask Sarvam for 8 kHz voice directly (off = Sarvam's 24 kHz, downsampled by Pipecat). Off by
    # default: Sarvam's 8 kHz output had 15-35% more short breaks inside words than the downsampled
    # 24 kHz voice, and the voice was reported breaking only after switching to it.
    sarvam_tts_native_8k: bool = False
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
