"""One Pipecat pipeline per phone call: Sarvam STT -> OpenRouter LLM -> Sarvam/ElevenLabs TTS."""

from fastapi import WebSocket
from loguru import logger
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
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.services.sarvam.stt import SarvamRealtimeSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from .config import settings
from .serializer import VoiceLinkFrameSerializer
from .store import Store

VOICE_RULES = (
    "You are speaking on a phone call. Reply in short, natural spoken sentences. "
    "Never use markdown, lists, emojis or URLs. Ask one question at a time."
)


def _language(code: str) -> Language:
    try:
        return Language(code)
    except ValueError:
        return Language.EN_IN


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


async def run_bot(websocket: WebSocket, start: dict, agent: dict, org_id: str, call_id: str, store: Store) -> None:
    language = _language(agent.get("language") or "en-IN")

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=VoiceLinkFrameSerializer(stream_sid=start["stream_sid"]),
        ),
    )

    stt = SarvamRealtimeSTTService(
        api_key=settings.sarvam_api_key,
        sample_rate=8000,
        settings=SarvamRealtimeSTTService.Settings(language=language),
    )
    llm = OpenRouterLLMService(
        api_key=settings.openrouter_api_key,
        settings=OpenRouterLLMService.Settings(model=agent.get("llm_model") or "openai/gpt-4o-mini"),
    )
    tts = _build_tts(agent, language)

    system = f"{agent.get('system_prompt', '')}\n\n{VOICE_RULES}".strip()
    context = LLMContext(messages=[{"role": "system", "content": system}])
    aggregators = LLMContextAggregatorPair(
        context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer())
    )
    user_agg, assistant_agg = aggregators.user(), aggregators.assistant()

    @user_agg.event_handler("on_user_turn_stopped")
    async def _user_turn(aggregator, strategy, message):
        await store.add_transcript(call_id, org_id, "user", message.content or "")

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _assistant_turn(aggregator, message):
        await store.add_transcript(call_id, org_id, "assistant", message.content or "")

    pipeline = Pipeline([transport.input(), stt, user_agg, llm, tts, transport.output(), assistant_agg])
    task = PipelineTask(pipeline, params=PipelineParams(audio_in_sample_rate=8000))

    @transport.event_handler("on_client_connected")
    async def _connected(transport, ws):
        greeting = agent.get("first_message")
        if greeting:
            await task.queue_frames([TTSSpeakFrame(greeting)])

    @transport.event_handler("on_client_disconnected")
    async def _disconnected(transport, ws):
        logger.info(f"Call {start.get('call_sid')} disconnected")
        await task.cancel()

    await PipelineRunner(handle_sigint=False).run(task)
