"""One Pipecat pipeline per phone call: Sarvam STT -> OpenRouter LLM -> Sarvam/ElevenLabs TTS."""

import asyncio

from fastapi import WebSocket
from pipecat.audio.vad.silero import SileroVADAnalyzer
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
    return SarvamRealtimeSTTService(
        api_key=settings.sarvam_api_key,
        sample_rate=PIPELINE_SAMPLE_RATE,
        settings=SarvamRealtimeSTTService.Settings(language=language),
    )


def _build_tts(agent: dict, language: Language):
    voice = agent.get("tts_voice")
    if agent.get("tts_provider") == "elevenlabs":
        return ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            settings=ElevenLabsTTSService.Settings(model="eleven_flash_v2_5", voice=voice, language=language),
        )
    return SarvamTTSService(
        api_key=settings.sarvam_api_key,
        settings=SarvamTTSService.Settings(voice=voice, language=language),
    )


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
    llm = OpenRouterLLMService(
        api_key=settings.openrouter_api_key,
        settings=OpenRouterLLMService.Settings(model=agent.get("llm_model") or "openai/gpt-4o-mini"),
    )
    tts = _build_tts(agent, language)
    events.log(
        "pipeline.built",
        call_sid=call_sid,
        stt=agent.get("stt_provider"),
        llm=agent.get("llm_model"),
        tts=agent.get("tts_provider"),
        voice=agent.get("tts_voice"),
        language=str(language),
    )

    system = f"{agent.get('system_prompt', '')}\n\n{VOICE_RULES}".strip()
    context = LLMContext(messages=[{"role": "system", "content": system}])
    aggregators = LLMContextAggregatorPair(
        context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer())
    )
    user_agg, assistant_agg = aggregators.user(), aggregators.assistant()

    @user_agg.event_handler("on_user_turn_stopped")
    async def _user_turn(aggregator, strategy, message):
        text = message.content or ""
        events.log("call.user_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "user", text)

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _assistant_turn(aggregator, message):
        text = message.content or ""
        events.log("call.agent_said", call_sid=call_sid, text=text[:200])
        await store.add_transcript(call_id, org_id, "assistant", text)

    pipeline = Pipeline([transport.input(), stt, user_agg, llm, tts, transport.output(), assistant_agg])
    task = PipelineTask(pipeline, params=PipelineParams(audio_in_sample_rate=PIPELINE_SAMPLE_RATE))

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
