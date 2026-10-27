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
from pipecat.services.openrouter.llm import OpenRouterLLMService  # noqa: F401  (Settings type)
from pipecat.services.sarvam.stt import SarvamRealtimeSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from . import events
from .config import settings
from .hangup import END_CALL_RULE, END_CALL_TOOLS, CallClock, guard_call, register_end_call
from .costs import CallCosts, CostTrackingOpenRouterLLM, TTSUsageProbe
from .latency import LLMProbe, TurnTimer
from .transcripts import TranscriptCleaner
from .serializer import VoiceLinkFrameSerializer
from .rumik_tts import RumikTTSService
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
    if agent.get("tts_provider") == "rumik":
        cfg = agent.get("config") or {}
        return RumikTTSService(
            api_key=settings.rumik_api_key,
            gateway_url=settings.rumik_gateway_url,
            settings=RumikTTSService.Settings(
                model=cfg.get("tts_model") or "mulberry",
                voice=voice,
                language=None,
                description=cfg.get("tts_description"),
            ),
        )
    # Per-agent options live in agents.config. Note v3 and v4-flash have different voice names.
    cfg = agent.get("config") or {}
    options = {"voice": voice, "language": language}
    if cfg.get("tts_model"):
        options["model"] = cfg["tts_model"]
    if cfg.get("tts_pace"):
        options["pace"] = float(cfg["tts_pace"])
    return SarvamTTSService(api_key=settings.sarvam_api_key, settings=SarvamTTSService.Settings(**options))


IDLE_TIMEOUT_SECS = 15


async def _audio_stats(serializer: VoiceLinkFrameSerializer, call_sid: str, task: PipelineTask) -> None:
    """Heartbeat while the call is live, and a watchdog for calls that went silent.

    VoiceLink sends caller audio continuously (about 50 frames a second), so a stretch with
    none means the call is over even if the socket was never closed.
    """
    last_in = last_out = idle = 0
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
        idle = idle + 5 if serializer.frames_in == last_in else 0
        last_in, last_out = serializer.frames_in, serializer.frames_out
        if idle >= IDLE_TIMEOUT_SECS:
            events.log("call.idle_timeout", "WARNING", call_sid=call_sid, idle_seconds=idle)
            await task.cancel()
            return


async def run_bot(
    websocket: WebSocket, start: dict, agent: dict, org_id: str, call_id: str, store: Store, direction: str = "inbound"
) -> None:
    call_sid = start.get("call_sid")
    language = _language(agent.get("language") or "en-IN")
    serializer = VoiceLinkFrameSerializer(start)
    timer = TurnTimer(call_sid)
    clock = CallClock()

    def _agent_audio() -> None:
        timer.audio_out()
        clock.touch()

    serializer.on_audio_out = _agent_audio

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
    # Only route to providers that honour the tools parameter, or end_call would be ignored.
    llm_settings.setdefault("provider", {})["require_parameters"] = True
    # `usage.include` makes OpenRouter return the exact dollar cost with each completion.
    extra_body: dict = {"usage": {"include": True}}
    if settings.llm_disable_thinking:
        extra_body["reasoning"] = {"enabled": False}
    llm_settings["extra"] = {"extra_body": extra_body}
    cfg = agent.get("config") or {}
    costs = CallCosts(
        llm_model=llm_settings["model"],
        stt_provider=agent.get("stt_provider") or "sarvam",
        tts_provider=agent.get("tts_provider") or "sarvam",
        tts_model=cfg.get("tts_model"),
    )
    llm = CostTrackingOpenRouterLLM(
        costs=costs, api_key=settings.openrouter_api_key, settings=OpenRouterLLMService.Settings(**llm_settings)
    )
    register_end_call(llm, call_sid)
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
    if direction == "outbound":
        system += (
            "\n\nYou placed this call yourself because the person asked for a callback. "
            "Open by confirming it is a good time to talk, then help with what they need."
        )
    system += f"\n\n{END_CALL_RULE}"  # last, where the model weighs it most
    context = LLMContext(messages=[{"role": "system", "content": system}], tools=END_CALL_TOOLS)
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(start_secs=settings.vad_start_secs, stop_secs=settings.vad_stop_secs)
            )
        ),
    )
    user_agg, assistant_agg = aggregators.user(), aggregators.assistant()

    @user_agg.event_handler("on_user_turn_started")
    async def _user_turn_started(aggregator, strategy):
        clock.user_started()

    @user_agg.event_handler("on_user_turn_stopped")
    async def _user_turn(aggregator, strategy, message):
        clock.user_stopped()
        text = message.content or ""
        timer.user_stopped()
        events.log("call.user_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "user", text)

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _assistant_turn(aggregator, message):
        text = message.content or ""
        events.log("call.agent_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "assistant", text)

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            TranscriptCleaner(call_sid),
            user_agg,
            llm,
            LLMProbe(timer),
            tts,
            TTSUsageProbe(costs),
            transport.output(),
            assistant_agg,
        ]
    )
    # With low latency the TTS services synthesize at the phone line's native 8 kHz, which
    # skips a 24 kHz -> 8 kHz resample (extra work and audible artifacts).
    # Usage metrics make the TTS report characters spoken, which is what Sarvam bills on.
    rates = {"audio_in_sample_rate": PIPELINE_SAMPLE_RATE, "enable_usage_metrics": True}
    if settings.low_latency:
        rates["audio_out_sample_rate"] = PIPELINE_SAMPLE_RATE
    task = PipelineTask(pipeline, params=PipelineParams(**rates))

    @transport.event_handler("on_client_connected")
    async def _connected(transport, ws):
        # When the agent is the one calling, "thanks for calling" would be wrong.
        greeting = (agent.get("config") or {}).get("outbound_first_message") if direction == "outbound" else None
        greeting = greeting or agent.get("first_message")
        events.log("call.pipeline_started", call_sid=call_sid, greeting=bool(greeting))
        if greeting:
            await task.queue_frames([TTSSpeakFrame(greeting)])

    @transport.event_handler("on_client_disconnected")
    async def _disconnected(transport, ws):
        events.log("ws.disconnected", call_sid=call_sid, frames_in=serializer.frames_in, frames_out=serializer.frames_out)
        await task.cancel()

    async def _end_call():
        # VoiceLink sends `stop` but leaves the socket open, so end the pipeline ourselves.
        # Detached so the pipeline is not cancelled from inside its own input task.
        asyncio.create_task(task.cancel())

    serializer.on_stop = _end_call
    stats = asyncio.create_task(_audio_stats(serializer, call_sid, task))
    guard = asyncio.create_task(
        guard_call(clock, task, call_sid, settings.max_call_secs, settings.silence_hangup_secs)
    )
    try:
        await PipelineRunner(handle_sigint=False).run(task)
    finally:
        stats.cancel()
        guard.cancel()
        costs.stt_seconds = serializer.frames_in * 0.02  # VoiceLink frames are 20 ms each
        summary = costs.summary()
        events.log("call.cost", call_sid=call_sid, **{k: summary[k] for k in ("total_inr", "complete", "llm", "tts", "stt")})
        try:
            await store.save_cost(call_id, summary)
        except Exception as e:  # never let bookkeeping break a call's shutdown
            events.log("call.cost_save_failed", "ERROR", call_sid=call_sid, error=f"{type(e).__name__}: {e}")
