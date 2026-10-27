"""One Pipecat pipeline per phone call: Sarvam STT -> OpenRouter LLM -> Sarvam/ElevenLabs TTS."""

import asyncio

from fastapi import WebSocket
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.services.sarvam.stt import SarvamRealtimeSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from . import events
from .config import settings
from .latency import LLMProbe, TurnTimer
from .serializer import VoiceLinkFrameSerializer
from .store import Store

VOICE_RULES = (
    "You are speaking on a phone call. Reply in short, natural spoken sentences. "
    "Never use markdown, lists, emojis or URLs. Ask one question at a time."
)

PIPELINE_SAMPLE_RATE = 8000


def _language(code: str) -> Language:
    try:
        return Language(code)
    except ValueError:
        return Language.EN_IN


def _build_stt(agent: dict, language: Language):
    if agent.get("stt_provider") == "elevenlabs":
        return ElevenLabsRealtimeSTTService(
            api_key=settings.elevenlabs_api_key,
            sample_rate=PIPELINE_SAMPLE_RATE,
            settings=ElevenLabsRealtimeSTTService.Settings(language=language),
        )
    extra = {"silence_duration_ms": settings.sarvam_silence_ms} if settings.sarvam_silence_ms else {}
    return SarvamRealtimeSTTService(
        api_key=settings.sarvam_api_key,
        sample_rate=PIPELINE_SAMPLE_RATE,
        endpointing=settings.sarvam_endpointing,
        settings=SarvamRealtimeSTTService.Settings(language=language, **extra),
    )


def _build_tts(agent: dict, language: Language):
    voice = agent.get("tts_voice")
    if agent.get("tts_provider") == "elevenlabs":
        return ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            settings=ElevenLabsTTSService.Settings(model="eleven_flash_v2_5", voice=voice, language=language),
        )
    # Per-agent options live in agents.config. Note v3 and v4-flash have different voice names.
    cfg = agent.get("config") or {}
    options = {"voice": voice, "language": language}
    if cfg.get("tts_model"):
        options["model"] = cfg["tts_model"]
    if cfg.get("tts_pace"):
        options["pace"] = float(cfg["tts_pace"])
    return SarvamTTSService(api_key=settings.sarvam_api_key, settings=SarvamTTSService.Settings(**options))


async def _audio_stats(serializer: VoiceLinkFrameSerializer, call_sid: str) -> None:
    """Heartbeat while the call is live: shows whether audio is flowing each way."""
    last_in = last_out = 0
    while True:
        await asyncio.sleep(5)
        events.log(
            "call.audio",
            call_sid=call_sid,
            frames_in=serializer.frames_in,
            frames_out=serializer.frames_out,
            new_in=serializer.frames_in - last_in,
            new_out=serializer.frames_out - last_out,
            interruptions=serializer.interruptions,
        )
        last_in, last_out = serializer.frames_in, serializer.frames_out


async def run_bot(websocket: WebSocket, start: dict, agent: dict, org_id: str, call_id: str, store: Store) -> None:
    call_sid = start.get("call_sid")
    language = _language(agent.get("language") or "en-IN")
    serializer = VoiceLinkFrameSerializer(start)
    timer = TurnTimer(call_sid)
    serializer.on_audio_out = timer.audio_out

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
        ),
    )

    stt = _build_stt(agent, language)
    llm_settings = {"model": agent.get("llm_model") or "openai/gpt-4o-mini"}
    if settings.low_latency:
        # OpenRouter's default routing favours price; ask for the fastest provider instead.
        llm_settings["provider"] = {"sort": "latency"}
    if settings.llm_disable_thinking:
        llm_settings["extra"] = {"extra_body": {"reasoning": {"enabled": False}}}
    llm = OpenRouterLLMService(api_key=settings.openrouter_api_key, settings=OpenRouterLLMService.Settings(**llm_settings))
    tts = _build_tts(agent, language)
    events.log(
        "pipeline.built",
        call_sid=call_sid,
        stt=agent.get("stt_provider"),
        llm=agent.get("llm_model"),
        tts=agent.get("tts_provider"),
        voice=agent.get("tts_voice"),
        tts_model=(agent.get("config") or {}).get("tts_model", "default"),
        tts_pace=(agent.get("config") or {}).get("tts_pace", 1.0),
        language=str(language),
    )

    system = f"{agent.get('system_prompt', '')}\n\n{VOICE_RULES}".strip()
    context = LLMContext(messages=[{"role": "system", "content": system}])
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(start_secs=settings.vad_start_secs, stop_secs=settings.vad_stop_secs)
            )
        ),
    )
    user_agg, assistant_agg = aggregators.user(), aggregators.assistant()

    @user_agg.event_handler("on_user_turn_stopped")
    async def _user_turn(aggregator, strategy, message):
        text = message.content or ""
        timer.user_stopped()
        events.log("call.user_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "user", text)

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _assistant_turn(aggregator, message):
        text = message.content or ""
        events.log("call.agent_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "assistant", text)

    pipeline = Pipeline([transport.input(), stt, user_agg, llm, LLMProbe(timer), tts, transport.output(), assistant_agg])
    # With low latency the TTS services synthesize at the phone line's native 8 kHz, which
    # skips a 24 kHz -> 8 kHz resample (extra work and audible artifacts).
    rates = {"audio_in_sample_rate": PIPELINE_SAMPLE_RATE}
    if settings.low_latency:
        rates["audio_out_sample_rate"] = PIPELINE_SAMPLE_RATE
    task = PipelineTask(pipeline, params=PipelineParams(**rates))

    @transport.event_handler("on_client_connected")
    async def _connected(transport, ws):
        greeting = agent.get("first_message")
        events.log("call.pipeline_started", call_sid=call_sid, greeting=bool(greeting))
        if greeting:
            await task.queue_frames([TTSSpeakFrame(greeting)])

    @transport.event_handler("on_client_disconnected")
    async def _disconnected(transport, ws):
        events.log("ws.disconnected", call_sid=call_sid, frames_in=serializer.frames_in, frames_out=serializer.frames_out)
        await task.cancel()

    stats = asyncio.create_task(_audio_stats(serializer, call_sid))
    try:
        await PipelineRunner(handle_sigint=False).run(task)
    finally:
        stats.cancel()
