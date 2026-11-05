"""Gnani (Vachana "Prisma") speech-to-text over its realtime WebSocket.

wss://api.vachana.ai/stt/v3/stream takes raw 16-bit mono PCM in frames of exactly 1,024 bytes and
decides where speech starts and ends itself (server-side VAD). It sends one final transcript per
spoken segment and no partial ones. Settings travel as headers on the upgrade request.

On a call the turn-taking is set up around the primary STT's own speech detection (Sarvam's), so this
service reports Gnani's boundaries the same way: `speech_start` proposes the start of the caller's
turn, `processing` (the VAD heard them stop) proposes the end, and each transcript is final.
"""

import json
from collections.abc import AsyncGenerator

from loguru import logger
from pipecat.frames.frames import (
    ErrorFrame,
    Frame,
    ProposedUserStartedSpeakingFrame,
    ProposedUserStoppedSpeakingFrame,
    StartFrame,
    TranscriptionFrame,
)
from pipecat.services.settings import NOT_GIVEN, STTSettings, is_given
from pipecat.services.stt_service import WebsocketSTTService
from pipecat.transcriptions.language import Language
from pipecat.utils.time import time_now_iso8601
from websockets.asyncio.client import connect as websocket_connect
from websockets.exceptions import InvalidStatus
from websockets.protocol import State

URL = "wss://api.vachana.ai/stt/v3/stream"
FRAME_BYTES = 1024  # Gnani rejects any other size
LANGUAGES = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"}
SAMPLE_RATES = (8000, 16000)


class GnaniSTTService(WebsocketSTTService):
    Settings = STTSettings
    _settings: Settings

    def __init__(
        self,
        *,
        api_key: str,
        sample_rate: int | None = None,
        silence_ms: int | None = None,
        settings: Settings | None = None,
        **kwargs,
    ):
        defaults = STTSettings(model=None, language=Language.EN_IN)
        if settings is not None:
            defaults.apply_update(settings)
        super().__init__(
            sample_rate=sample_rate,
            # Gnani closes a socket idle for x-idle-timeout-sec, and silence sent to keep it open
            # would be billed as audio, so the timeout is asked for at its longest instead.
            keepalive_timeout=None,
            ttfs_p99_latency=0.6,
            settings=defaults,
            **kwargs,
        )
        self._api_key = api_key
        self._silence_ms = silence_ms
        self._receive_task = None
        self._pending = bytearray()  # audio not yet a whole 1,024-byte frame
        self._speech_active = False

    def can_generate_metrics(self) -> bool:
        return True

    def language_to_service_language(self, language: Language) -> str | None:
        code = str(language.value) if isinstance(language, Language) else str(language)
        return code if code in LANGUAGES else None

    def _language_code(self) -> str:
        language = self._settings.language
        code = str(language.value) if isinstance(language, Language) else str(language or "")
        return code if code in LANGUAGES else "en-IN"

    async def start(self, frame: StartFrame):
        await super().start(frame)
        await self._connect()

    async def _connect(self):
        await super()._connect()
        if self._receive_task and self._receive_task.done():
            self._receive_task = None
        await self._connect_websocket()
        if self._websocket and not self._receive_task:
            self._receive_task = self.create_task(self._receive_task_handler(self._report_error))

    async def _disconnect(self):
        await super()._disconnect()
        if self._receive_task:
            await self.cancel_task(self._receive_task)
            self._receive_task = None
        await self._disconnect_websocket()
        self._pending.clear()
        self._speech_active = False

    def _headers(self) -> dict[str, str]:
        rate = self.sample_rate if self.sample_rate in SAMPLE_RATES else 16000
        headers = {
            "x-api-key-id": self._api_key,
            "language_code": self._language_code(),
            "x-sample-rate": str(rate),
            "x-idle-timeout-sec": "900",
        }
        model = self._settings.model
        if is_given(model) and model:
            headers["model"] = str(model)
        if self._silence_ms:
            headers["x-min-silence-ms"] = str(max(100, min(2000, int(self._silence_ms))))
        return headers

    async def _connect_websocket(self):
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return
            self._websocket = await websocket_connect(URL, additional_headers=self._headers(), max_size=None)
            await self._call_event_handler("on_connected")
        except Exception as e:
            self._websocket = None
            # A rejected key or an empty account never starts working mid-call: say so, so the call
            # moves to the next provider at once.
            rejected = isinstance(e, InvalidStatus) and e.response.status_code in (401, 402, 403)
            await self.push_error(error_msg=f"Gnani STT connect failed: {e}", exception=e, force_treat_as_permanent=rejected)
            await self._call_event_handler("on_connection_error", f"{e}")

    async def _disconnect_websocket(self):
        try:
            await self.stop_all_metrics()
            if self._websocket and self._websocket.state is State.OPEN:
                await self._websocket.close()
        except Exception as e:
            logger.warning(f"Gnani STT disconnect error: {e}")
        finally:
            self._websocket = None
            await self._call_event_handler("on_disconnected")

    def _get_websocket(self):
        if self._websocket:
            return self._websocket
        raise Exception("WebSocket not connected")

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame | None, None]:
        """Send the caller's audio on in whole 1,024-byte frames; results arrive on the socket."""
        if self._websocket and self._websocket.state is State.OPEN:
            try:
                self._pending += audio
                while len(self._pending) >= FRAME_BYTES:
                    chunk = bytes(self._pending[:FRAME_BYTES])
                    del self._pending[:FRAME_BYTES]
                    await self._websocket.send(chunk)
                    self._record_stt_audio_usage(chunk)
            except Exception as e:
                yield ErrorFrame(f"Gnani STT error: {e}")
        yield None

    async def _receive_messages(self):
        async for message in self._get_websocket():
            if isinstance(message, bytes):
                continue
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue
            try:
                await self._handle(data)
            except Exception as e:
                logger.error(f"Gnani STT message error: {e}")

    async def _handle(self, data: dict):
        kind = data.get("type")
        if kind == "speech_start":
            if not self._speech_active:
                self._speech_active = True
                await self.broadcast_frame(ProposedUserStartedSpeakingFrame)
        elif kind in ("processing", "transcript"):
            # The VAD heard the caller stop ("processing"); the transcript follows.
            await self._end_speech()
            if kind == "transcript":
                await self._on_transcript(data)
        elif kind == "error":
            await self.push_error(error_msg=f"Gnani STT error: {data.get('message') or data}")

    async def _end_speech(self):
        if self._speech_active:
            self._speech_active = False
            await self.broadcast_frame(ProposedUserStoppedSpeakingFrame)

    async def _on_transcript(self, data: dict):
        text = (data.get("text") or "").strip()
        await self.emit_stt_usage_metrics()
        if not text:
            return
        language = data.get("detected_language_code") or self._language_code()
        await self.push_frame(
            TranscriptionFrame(text, self._user_id, time_now_iso8601(), language, result=data, finalized=True)
        )
