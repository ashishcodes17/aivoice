"""One Pipecat pipeline per phone call: Sarvam STT -> OpenRouter LLM -> Sarvam/ElevenLabs TTS."""

import asyncio

from fastapi import WebSocket
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.service_switcher import ServiceSwitcher, ServiceSwitcherStrategyFailover
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
from pipecat.services.sarvam.llm import SarvamLLMService
from pipecat.services.sarvam.stt import SarvamRealtimeSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.services.smallest.tts import SmallestTTSService
from pipecat.transcriptions.language import Language
from pipecat.turns.user_stop import ExternalUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from . import events
from .config import settings
from .variables import fill_variables
from .context import call_context_note, national_number
from .gnani_stt import GnaniSTTService
from .gnani_tts import GnaniTTSService
from .llm_sarvam import SarvamLLMWithBackup, is_sarvam_llm
from .hangup import END_CALL_RULE, END_CALL_TOOLS, CallClock, guard_call, register_end_call
from .costs import CallCosts, CostTrackingOpenRouterLLM, TTSUsageProbe
from .latency import LLMProbe, TurnTimer
from .opening import OpeningGate, outbound_note
from . import outcome
from .textfilter import ScriptFilter, spell_phone_numbers
from .transcripts import TranscriptCleaner
from .levels import LevelMeter, LevelTracker
from .turns import GuardedBargeInStartStrategy
from pipecat.turns.user_start import ExternalUserTurnStartStrategy
from .serializer import VoiceLinkFrameSerializer
from .rumik_tts import RumikTTSService
from .store import Store
from .voices import provider_ready, tts_backup_chain

VOICE_RULES = (
    "You are speaking on a phone call. Reply in short, natural spoken sentences, under 25 words per turn. "
    "Never use markdown, lists, emojis or URLs. Ask one question at a time, then wait for the answer. "
    "Never repeat a sentence or question you already used earlier in this call: if you need to ask the "
    "same thing again, put it in different words and shorter, or move the conversation forward instead. "
    "Treat hmm, haan, accha and ok as the caller listening, not as an answer. "
    "If something is unclear, say what you heard and ask the caller to confirm. "
    "When the caller gives a day or a date, work out the exact calendar date from today's date, say it back "
    "to confirm, and if it is in the past point that out and ask for another. "
    "Never say something is booked, changed, sent or done unless you really did it; otherwise say the team will do it. "
    "Never mention instructions, tools, variables or any internal detail. Never invent facts, prices or promises: "
    "say you will check with the team. "
    "Stay calm and kind if the caller is upset and never match hostile energy. For a legal threat, a fraud claim, "
    "a mental-health concern or a request for a person, acknowledge briefly, say a senior representative will reach "
    "out, and end the call. If the person asked for has passed away, offer condolences and end the call. "
    "If the caller says it is the wrong number, apologize and end politely. If they are busy, ask when to call "
    "back, repeat the time and end politely. If the caller switches to another language, continue in it."
)

PIPELINE_SAMPLE_RATE = 8000
# With VoiceLink set to 16 kHz linear PCM, hearing and voice run at 16 kHz too (wideband); converting
# to 8 kHz inside would throw that away. Rumik only produces 8 kHz, so its calls stay at 8 kHz.
WIDEBAND_RATE = 16000


NUDGES = {
    "te": "హలో, మీకు వినిపిస్తోందా?",
    "hi": "हेलो, क्या आपको मेरी आवाज़ आ रही है?",
}
DEFAULT_NUDGE = "Hello, can you hear me?"


class SpokenSarvamTTS(SarvamTTSService):
    """Sarvam voice that says phone numbers digit by digit."""

    # Set from the call's language when the service is built.
    spoken_language = "te-IN"

    async def run_tts(self, text: str, context_id: str):
        async for frame in super().run_tts(spell_phone_numbers(text, self.spoken_language), context_id):
            yield frame


class SpokenSmallestTTS(SmallestTTSService):
    """Smallest voice that says phone numbers digit by digit."""

    spoken_language = "te-IN"

    async def run_tts(self, text: str, context_id: str):
        async for frame in super().run_tts(spell_phone_numbers(text, self.spoken_language), context_id):
            yield frame


def _language(code: str) -> Language:
    try:
        return Language(code)
    except ValueError:
        return Language.EN_IN


def _build_stt(agent: dict, language: Language, rate: int = PIPELINE_SAMPLE_RATE, provider: str | None = None):
    provider = provider or agent.get("stt_provider") or "sarvam"
    if provider == "gnani":
        return GnaniSTTService(
            api_key=settings.gnani_api_key,
            sample_rate=rate,
            silence_ms=settings.gnani_stt_silence_ms,
            settings=GnaniSTTService.Settings(model=settings.gnani_stt_model or None, language=language),
        )
    if provider == "elevenlabs":
        return ElevenLabsRealtimeSTTService(
            api_key=settings.elevenlabs_api_key,
            sample_rate=rate,
            settings=ElevenLabsRealtimeSTTService.Settings(language=language),
        )
    extra = {"silence_duration_ms": settings.sarvam_silence_ms} if settings.sarvam_silence_ms else {}
    return SarvamRealtimeSTTService(
        api_key=settings.sarvam_api_key,
        sample_rate=rate,
        endpointing=settings.sarvam_endpointing,
        settings=SarvamRealtimeSTTService.Settings(language=language, **extra),
    )


def _external_turns(agent: dict) -> bool:
    """Do the speech-to-text's own speech boundaries drive the turns (rather than a local VAD)?"""
    stt = agent.get("stt_provider") or "sarvam"
    return stt == "gnani" or (stt == "sarvam" and settings.sarvam_endpointing == "vad")


def _stt_backup_providers(agent: dict) -> list[str]:
    """Speech-to-text providers standing by for the agent's own, on separate accounts, so one running
    out of credits does not leave the caller unheard. A backup must report speech boundaries the same
    way as the primary, because the call's turn-taking is set up around the primary:
    Sarvam and Gnani both do; ElevenLabs needs a local VAD, so it only backs up ElevenLabs's peers.
    """
    primary = agent.get("stt_provider") or "sarvam"
    if _external_turns(agent):
        candidates = [p for p in ("sarvam", "gnani") if p != primary]
    else:
        candidates = [p for p in ("sarvam", "elevenlabs") if p != primary]
    return [p for p in candidates if provider_ready(p)]


def _build_tts(agent: dict, language: Language, has_backup: bool = False, rate: int = PIPELINE_SAMPLE_RATE):
    voice = agent.get("tts_voice")
    # With a backup voice standing by, one sentence that comes out silent is already one too many.
    strict = {"max_consecutive_zero_audio_contexts": 1} if has_backup else {}
    if agent.get("tts_provider") == "elevenlabs":
        return ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            **strict,
            settings=ElevenLabsTTSService.Settings(model="eleven_flash_v2_5", voice=voice, language=language),
        )
    if agent.get("tts_provider") == "gnani":
        cfg = agent.get("config") or {}
        tts = GnaniTTSService(
            api_key=settings.gnani_api_key,
            sample_rate=rate,
            **strict,
            settings=GnaniTTSService.Settings(model=cfg.get("tts_model") or "timbre-v3.0", voice=voice, language=None),
        )
        tts.spoken_language = str(language)
        return tts
    if agent.get("tts_provider") == "smallest":
        cfg = agent.get("config") or {}
        # Smallest's Indian voices speak English and Hindi under "hi" (Indian-accented English plus
        # Hindi); "en" would be the British and American voices. Telugu has its own code.
        smallest_language = Language.HI if str(language).startswith(("en", "hi")) else language
        options = {"voice": voice, "language": smallest_language, "model": cfg.get("tts_model") or "lightning_v3.1_pro"}
        if cfg.get("tts_pace"):
            options["speed"] = float(cfg["tts_pace"])
        # word_timestamps off: Telugu voices send no word events, and without them the transcript
        # would receive no agent text at all.
        tts = SpokenSmallestTTS(
            api_key=settings.smallest_api_key,
            word_timestamps=False,
            # By default Smallest holds a fragment for up to 3 s waiting for more text, which made
            # a short line such as the goodbye start 4 s late.
            max_buffer_delay_ms=300,
            **strict,
            settings=SmallestTTSService.Settings(**options),
        )
        tts.spoken_language = str(language)
        return tts
    if agent.get("tts_provider") == "rumik":
        cfg = agent.get("config") or {}
        tts = RumikTTSService(
            api_key=settings.rumik_api_key,
            gateway_url=settings.rumik_gateway_url,
            **strict,
            settings=RumikTTSService.Settings(
                model=cfg.get("tts_model") or "mulberry",
                voice=voice,
                language=None,
                description=cfg.get("tts_description"),
            ),
        )
        tts.spoken_language = str(language)
        return tts
    # Per-agent options live in agents.config. Note v3 and v4-flash have different voice names.
    cfg = agent.get("config") or {}
    options = {"voice": voice, "language": language}
    if cfg.get("tts_model"):
        options["model"] = cfg["tts_model"]
    if cfg.get("tts_pace"):
        options["pace"] = float(cfg["tts_pace"])
    if cfg.get("tts_temperature"):
        # Higher temperature = more varied intonation; the default sounds flat on some voices.
        options["temperature"] = float(cfg["tts_temperature"])
    # Sarvam's service takes its rate from the model default (24 kHz), not the pipeline; asking for
    # 8 kHz directly is optional (see settings.sarvam_tts_native_8k).
    native = {"sample_rate": rate} if settings.low_latency and settings.sarvam_tts_native_8k else {}
    tts = SpokenSarvamTTS(api_key=settings.sarvam_api_key, settings=SarvamTTSService.Settings(**options), **native)
    tts.spoken_language = str(language)
    return tts


IDLE_TIMEOUT_SECS = 15


async def _audio_stats(serializer: VoiceLinkFrameSerializer, call_sid: str, task: PipelineTask, levels=None) -> None:
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
            # What VoiceLink sent versus what became audio (see VoiceLinkFrameSerializer).
            received=dict(serializer.msgs),
            tracks=dict(serializer.tracks),
            dropped=dict(serializer.dropped),
            longest_gap_ms=serializer.max_gap_ms,
            caller_level=round(levels.recent() or 0) if levels else None,  # loudness of the last second of speech
            caller_usual_level=round(levels.reference) if levels and levels.reference else None,
            out_stutters=serializer.out_stutters,  # 120-1500 ms pauses in what we send while speaking
            longest_out_gap_ms=serializer.longest_out_gap_ms,
        )
        serializer.max_gap_ms = 0
        idle = idle + 5 if serializer.frames_in == last_in else 0
        last_in, last_out = serializer.frames_in, serializer.frames_out
        if idle >= IDLE_TIMEOUT_SECS:
            events.log("call.idle_timeout", "WARNING", call_sid=call_sid, idle_seconds=idle)
            await task.cancel()
            return


async def run_bot(
    websocket: WebSocket,
    start: dict,
    agent: dict,
    org_id: str,
    call_id: str,
    store: Store,
    direction: str = "inbound",
    customer_number: str | None = None,
) -> None:
    call_sid = start.get("call_sid")
    language = _language(agent.get("language") or "en-IN")
    serializer = VoiceLinkFrameSerializer(start)
    timer = TurnTimer(call_sid)
    clock = CallClock()
    opener: list[asyncio.Task] = []
    heard_user = asyncio.Event()

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

    call_rate = WIDEBAND_RATE if serializer.wire_rate == WIDEBAND_RATE and (agent.get("tts_provider") or "sarvam") != "rumik" else PIPELINE_SAMPLE_RATE
    stt_primary = _build_stt(agent, language, call_rate)
    stt_backups = _stt_backup_providers(agent)
    stt = stt_primary
    agent_llm = agent.get("llm_model") or "openai/gpt-4o-mini"
    # A Sarvam model runs on Sarvam's own API, with an OpenRouter model standing by.
    sarvam_llm = is_sarvam_llm(agent_llm) and bool((settings.sarvam_api_key or "").strip())
    llm_settings = {"model": settings.sarvam_llm_backup_model if sarvam_llm else agent_llm}
    if settings.low_latency:
        # OpenRouter's default routing favours price; route for speed instead. Providers below the
        # optional speed floors are tried last, not excluded.
        provider: dict = {"sort": settings.llm_provider_sort}
        if settings.llm_min_throughput_p50:
            provider["preferred_min_throughput"] = {"p50": settings.llm_min_throughput_p50}
        if settings.llm_max_latency_p50:
            provider["preferred_max_latency"] = {"p50": settings.llm_max_latency_p50}
        llm_settings["provider"] = provider
    # Only route to providers that honour the tools parameter, or end_call would be ignored.
    llm_settings.setdefault("provider", {})["require_parameters"] = True
    # `usage.include` makes OpenRouter return the exact dollar cost with each completion.
    extra_body: dict = {"usage": {"include": True}}
    if settings.llm_disable_thinking:
        extra_body["reasoning"] = {"enabled": False}
    # If the main model is down or erroring, OpenRouter moves on to the fallbacks in this order.
    fallbacks = [m.strip() for m in settings.llm_fallback_models.split(",") if m.strip() and m.strip() != llm_settings["model"]]
    if fallbacks:
        extra_body["models"] = [llm_settings["model"], *fallbacks]
    llm_settings["extra"] = {"extra_body": extra_body}
    cfg = agent.get("config") or {}
    costs = CallCosts(
        llm_model=agent_llm if sarvam_llm else llm_settings["model"],
        stt_provider=agent.get("stt_provider") or "sarvam",
        tts_provider=agent.get("tts_provider") or "sarvam",
        tts_model=cfg.get("tts_model"),
    )
    llm = CostTrackingOpenRouterLLM(
        costs=costs,
        api_key=settings.openrouter_api_key,
        settings=OpenRouterLLMService.Settings(**llm_settings),
        # A provider that accepts the request and then sends nothing would leave the caller in
        # silence; re-ask once if no text has arrived by then (first words normally take ~0.6 s).
        retry_on_timeout=True,
        retry_timeout_secs=settings.llm_retry_timeout_secs,
    )
    if sarvam_llm:
        llm = SarvamLLMWithBackup(
            costs=costs,
            backup=llm,
            call_sid=call_sid,
            start_timeout_secs=settings.llm_retry_timeout_secs,
            api_key=settings.sarvam_api_key,
            settings=SarvamLLMService.Settings(model=agent_llm, temperature=0.5, max_tokens=300),
        )
    llm_probe = LLMProbe(timer)
    register_end_call(llm, call_sid, language.value, lambda: llm_probe.spoke, hold_secs=settings.smallest_end_hold_secs if agent.get("tts_provider") in ("smallest", "gnani") else 0.0)
    # Other voice providers stand by (Sarvam, then Gnani, whichever the agent isn't already using):
    # if the voice cannot speak (bad key, no credits, outage) the call switches over instead of
    # going silent.
    backups = tts_backup_chain(agent)
    tts_primary = _build_tts(agent, language, has_backup=bool(backups), rate=call_rate)
    tts = tts_primary
    if backups:
        tts_services = [_build_tts(b, language, has_backup=i < len(backups) - 1, rate=call_rate) for i, b in enumerate(backups)]
        tts = ServiceSwitcher([tts_primary, *tts_services], strategy_type=ServiceSwitcherStrategyFailover)
        backup_of = {id(svc): b for svc, b in zip(tts_services, backups)}
        current_tts = {"provider": agent.get("tts_provider") or "sarvam"}

        @tts.strategy.event_handler("on_service_switched")
        async def _tts_failover(strategy, service):
            backup = backup_of.get(id(service))
            if backup is None:  # switched back to the agent's own voice
                backup = agent
            bcfg = backup.get("config") or {}
            failed = current_tts["provider"]
            current_tts["provider"] = backup.get("tts_provider") or "sarvam"
            costs.tts_provider, costs.tts_model = current_tts["provider"], bcfg.get("tts_model")
            events.log("tts.failover", "ERROR", call_sid=call_sid, failed=failed, now=current_tts["provider"], voice=backup.get("tts_voice"))
            # If the failed voice never got a word out, the caller has heard nothing at all: say
            # the opening again with the backup voice rather than leave a silent line.
            if serializer.frames_out == 0:
                events.log("tts.failover_respeak", call_sid=call_sid)
                opening = greeting
                gate.take()  # the opening is being said now, not by the gate later
                await task.queue_frames([TTSSpeakFrame(opening)] if opening else [LLMRunFrame()])
    if stt_backups:
        stt_services = [_build_stt(agent, language, call_rate, provider=p) for p in stt_backups]
        stt = ServiceSwitcher([stt_primary, *stt_services], strategy_type=ServiceSwitcherStrategyFailover)
        stt_backup_of = {id(svc): p for svc, p in zip(stt_services, stt_backups)}
        current_stt = {"provider": agent.get("stt_provider") or "sarvam"}

        @stt.strategy.event_handler("on_service_switched")
        async def _stt_failover(strategy, service):
            now = stt_backup_of.get(id(service), agent.get("stt_provider") or "sarvam")
            events.log("stt.failover", "ERROR", call_sid=call_sid, failed=current_stt["provider"], now=now)
            current_stt["provider"] = now
            costs.stt_provider = now
    events.log(
        "pipeline.built",
        call_sid=call_sid,
        stt=agent.get("stt_provider"),
        llm=agent.get("llm_model"),
        tts=agent.get("tts_provider"),
        tts_backups=[b.get("tts_provider") for b in backups],
        stt_backups=stt_backups,
        voice=agent.get("tts_voice"),
        tts_model=cfg.get("tts_model", "default"),
        tts_pace=cfg.get("tts_pace", 1.0),
        language=str(language),
        audio_rate=call_rate,
    )

    variables = cfg.get("variables") or {}
    system = f"{fill_variables(agent.get('system_prompt', ''), variables)}\n\n{VOICE_RULES}".strip()
    if agent.get("language_note"):
        system += "\n\n" + agent["language_note"]
    system += "\n\n" + call_context_note(direction, national_number(customer_number), language=language.value)
    greeting = fill_variables(
        (cfg.get("outbound_first_message") if direction == "outbound" else None) or agent.get("first_message"), variables
    )
    if direction == "outbound":
        system += "\n\n" + outbound_note(greeting)
    system += f"\n\n{END_CALL_RULE}"  # last, where the model weighs it most
    # Sarvam's own VAD decides when a turn starts and ends (Pipecat picks the same strategies for us),
    # but its stop strategy adds a 0.5 s wait after the transcript. Supply it with a shorter one.
    turn_strategies = None
    levels = LevelTracker() if settings.barge_in_level_ratio > 0 else None
    if _external_turns(agent):
        turn_strategies = UserTurnStrategies(
            start=[
                GuardedBargeInStartStrategy(
                    min_words=settings.barge_in_min_words, thinking_secs=settings.barge_in_thinking_secs, call_sid=call_sid,
                    levels=levels, level_ratio=settings.barge_in_level_ratio, min_level=settings.barge_in_min_level,
                )
                if settings.barge_in_min_words > 0
                else ExternalUserTurnStartStrategy(enable_interruptions=True)  # 0: any sound interrupts
            ],
            stop=[ExternalUserTurnStopStrategy(timeout=settings.turn_stop_timeout_secs)],
        )
    # Local voice detection only matters when we decide turns ourselves; with Sarvam's server-side
    # endpointing it would just burn CPU on every audio frame of every call.
    vad = None
    if turn_strategies is None:
        vad = SileroVADAnalyzer(params=VADParams(start_secs=settings.vad_start_secs, stop_secs=settings.vad_stop_secs))
    context = LLMContext(messages=[{"role": "system", "content": system}], tools=END_CALL_TOOLS)
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(user_turn_strategies=turn_strategies, vad_analyzer=vad),
    )
    user_agg, assistant_agg = aggregators.user(), aggregators.assistant()

    transcript: list[tuple[str, str]] = []

    @user_agg.event_handler("on_user_turn_started")
    async def _user_turn_started(aggregator, strategy):
        clock.user_started()
        heard_user.set()

    @user_agg.event_handler("on_user_turn_stopped")
    async def _user_turn(aggregator, strategy, message):
        clock.user_stopped()
        text = message.content or ""
        timer.user_stopped()
        transcript.append(("user", text))
        events.log("call.user_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "user", text)

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _assistant_turn(aggregator, message):
        text = message.content or ""
        clock.agent_finished(text)
        transcript.append(("assistant", text))
        events.log("call.agent_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "assistant", text)

    gate = OpeningGate(greeting if direction == "outbound" else None)
    pipeline = Pipeline(
        [
            transport.input(),
            *([LevelMeter(levels)] if levels else []),
            stt,
            TranscriptCleaner(call_sid),
            user_agg,
            gate,
            llm,
            llm_probe,
            ScriptFilter(call_sid),
            tts,
            TTSUsageProbe(costs),
            transport.output(),
            assistant_agg,
        ]
    )
    # With low latency the TTS services synthesize at the phone line's native 8 kHz, which
    # skips a 24 kHz -> 8 kHz resample (extra work and audible artifacts).
    # Usage metrics make the TTS report characters spoken, which is what Sarvam bills on.
    rates = {"audio_in_sample_rate": call_rate, "enable_usage_metrics": True}
    if settings.low_latency:
        rates["audio_out_sample_rate"] = call_rate
    task = PipelineTask(pipeline, params=PipelineParams(**rates))

    async def _open_outbound() -> None:
        # Wait briefly for "hello?" (the gate answers it with the opening); if the line stays quiet,
        # a slow pickup or a handset that opens muted, speak first.
        try:
            await asyncio.wait_for(heard_user.wait(), settings.outbound_wait_secs)
        except asyncio.TimeoutError:
            opening = gate.take()
            events.log("call.outbound_spoke_first", call_sid=call_sid, scripted=bool(opening))
            if opening:
                await task.queue_frames([TTSSpeakFrame(opening)])
            elif not greeting:
                # No scripted opening: have the model speak first.
                await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_connected")
    async def _connected(transport, ws):
        events.log("call.pipeline_started", call_sid=call_sid, greeting=bool(greeting), waits_for_hello=direction == "outbound")
        if direction == "outbound":
            opener.append(asyncio.create_task(_open_outbound()))
        elif greeting:
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
    stats = asyncio.create_task(_audio_stats(serializer, call_sid, task, levels))
    nudge_text = cfg.get("idle_nudge_message") or NUDGES.get(language.value.split("-")[0], DEFAULT_NUDGE)

    async def _nudge() -> None:
        await task.queue_frames([TTSSpeakFrame(nudge_text)])

    guard = asyncio.create_task(
        guard_call(
            clock, task, call_sid, settings.max_call_secs, settings.silence_hangup_secs,
            settings.nudge_secs, _nudge, settings.hangup_after_nudge_secs, settings.goodbye_grace_secs,
        )
    )
    try:
        await PipelineRunner(handle_sigint=False).run(task)
    finally:
        stats.cancel()
        guard.cancel()
        for t in opener:
            t.cancel()
        costs.stt_seconds = serializer.frames_in * 0.02  # VoiceLink frames are 20 ms each
        summary = costs.summary()
        events.log("call.cost", call_sid=call_sid, **{k: summary[k] for k in ("total_inr", "complete", "llm", "tts", "stt")})
        try:
            await store.save_cost(call_id, summary)
        except Exception as e:  # never let bookkeeping break a call's shutdown
            events.log("call.cost_save_failed", "ERROR", call_sid=call_sid, error=f"{type(e).__name__}: {e}")
        # After the call, in the background: the socket must close (that is the hangup) without waiting.
        if settings.record_outcomes:
            outcome.record_in_background(
                store, call_id, call_sid, transcript,
                # What the business is comes from the start of the agent's own instructions.
                f"the agent \"{agent.get('name') or 'assistant'}\", whose instructions begin: {(agent.get('system_prompt') or '')[:300]}",
            )
