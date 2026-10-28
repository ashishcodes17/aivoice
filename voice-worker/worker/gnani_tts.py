"""Gnani (Vachana "Timbre") text-to-speech over its realtime WebSocket.

Measured from India: first audio about 140 ms after a sentence is sent (its REST and SSE routes
took 1.4 s or more), and synthesis runs about three times faster than speech. The socket takes
0.5 to 1.3 s to open, so it is opened when the call starts and kept for the whole call.

Gnani sends a tiny first chunk (about 60 ms of sound) and then pauses about 0.4 s before the rest of
the sentence, which on a call is a click, a gap, then speech. The first 300 ms of each sentence is
therefore held back and played together; the speech was not going to start any sooner than that.

Gnani accepts one request at a time on a socket and has no cancel message. On a barge-in the rest
of that sentence's audio is dropped as it arrives, and the next sentence waits for the server to
finish the old one (usually well under a second).
"""

import asyncio
import base64
import json
import re
from collections.abc import AsyncGenerator

from pipecat.frames.frames import (
    CancelFrame,
    EndFrame,
    ErrorFrame,
    Frame,
    StartFrame,
    TTSAudioRawFrame,
    TTSStoppedFrame,
)
from pipecat.services.settings import NOT_GIVEN, TTSSettings
from pipecat.services.tts_service import InterruptibleTTSService
from websockets.asyncio.client import connect as websocket_connect
from websockets.exceptions import InvalidStatus
from websockets.protocol import State

from .textfilter import spell_phone_numbers

URL = "wss://api.vachana.ai/api/v1/tts"
DEFAULT_MODEL = "timbre-v3.0"
DEFAULT_VOICE = "Lakshmi"
# Languages Gnani accepts; anything else is sent as "auto".
# How much of a sentence to collect before the first audio is played.
LEAD_SECONDS = 0.3
LANGUAGES = {"hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN"}


class GnaniTTSService(InterruptibleTTSService):
    Settings = TTSSettings
    _settings: Settings

    # Language of the call: for the request, and to say phone numbers digit by digit.
    spoken_language = "te-IN"

    def __init__(self, *, api_key: str, sample_rate: int = 8000, settings: Settings | None = None, **kwargs):
        defaults = TTSSettings(model=DEFAULT_MODEL, voice=DEFAULT_VOICE, language=None)
        if settings is not None:
            defaults.apply_update(settings)
        super().__init__(
            push_stop_frames=False,
            push_start_frame=True,
            pause_frame_processing=True,
            sample_rate=sample_rate,
            settings=defaults,
            **kwargs,
        )
        self._api_key = api_key
        self._rate = sample_rate
        self._receive_task: asyncio.Task | None = None
        self._active_context_id: str | None = None
        # One request at a time on the socket. Held until the server says the request is complete,
        # including after a barge-in, because Gnani cannot be told to stop.
        self._synthesis_lock = asyncio.Lock()
        # Start of the current sentence, held until enough has arrived to play without a gap.
        self._lead = bytearray()
        self._lead_released = False
        self._lead_bytes = int(sample_rate * 2 * LEAD_SECONDS)

    def can_generate_metrics(self) -> bool:
        return True

    def _setting(self, name: str, default: str) -> str:
        value = getattr(self._settings, name)
        return value if value not in (None, NOT_GIVEN) else default

    async def start(self, frame: StartFrame):
        await super().start(frame)
        await self._connect()

    async def stop(self, frame: EndFrame):
        await super().stop(frame)
        await self._disconnect()

    async def cancel(self, frame: CancelFrame):
        await super().cancel(frame)
        await self._disconnect()

    async def cleanup(self):
        try:
            await self._disconnect()
            await self._stop_audio_context_task()
        finally:
            await super().cleanup()

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
        self._release()

    async def _connect_websocket(self):
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return
            self._websocket = await websocket_connect(
                URL, additional_headers={"X-API-Key-ID": self._api_key}, max_size=None, ping_interval=20, ping_timeout=30
            )
            await self._call_event_handler("on_connected")
        except Exception as e:
            self._websocket = None
            # A rejected key or an empty account never recovers mid-call: say so, so the call moves
            # to the backup voice at once.
            rejected = isinstance(e, InvalidStatus) and e.response.status_code in (401, 402, 403)
            await self.push_error(error_msg=f"Gnani WS connect failed: {e}", exception=e, force_treat_as_permanent=rejected)
            await self._call_event_handler("on_connection_error", f"{e}")

    async def _disconnect_websocket(self):
        try:
            await self.stop_all_metrics()
            if self._websocket and self._websocket.state is State.OPEN:
                await self._websocket.close()
        except Exception as e:
            await self.push_error(error_msg=f"Gnani WS disconnect error: {e}", exception=e)
        finally:
            self._websocket = None
            await self._call_event_handler("on_disconnected")

    def _get_websocket(self):
        if self._websocket:
            return self._websocket
        raise Exception("WebSocket not connected")

    async def _report_error(self, error: ErrorFrame):
        await self._finish_active_context()
        await super()._report_error(error)

    async def _handle_interruption(self, frame, direction):
        # The base class reopens the socket when the caller cuts in while she speaks. A Gnani socket
        # takes 0.5 to 1.3 s to open, which delayed every reply after a barge-in; instead the old
        # sentence's remaining audio is dropped as it arrives (on_audio_context_interrupted).
        self._bot_speaking = False
        self._tts_started = False
        await super(InterruptibleTTSService, self)._handle_interruption(frame, direction)

    async def on_audio_context_interrupted(self, context_id: str):
        """Barge-in: stop playing this sentence. The lock stays held until Gnani says it is done."""
        if context_id == self._active_context_id:
            self._active_context_id = None
        await super().on_audio_context_interrupted(context_id)

    async def _receive_messages(self):
        try:
            async for message in self._get_websocket():
                try:
                    data = json.loads(message)
                except (TypeError, json.JSONDecodeError):
                    continue
                kind = data.get("type")
                if kind == "audio":
                    await self.stop_ttfb_metrics()
                    context_id = self._active_context_id
                    audio = base64.b64decode((data.get("data") or {}).get("audio") or "")
                    if context_id and audio:
                        if self._lead_released:
                            await self._play(context_id, audio)
                        else:
                            self._lead += audio
                            if len(self._lead) >= self._lead_bytes:
                                await self._release_lead(context_id)
                elif kind == "complete":
                    # Gnani sends two "complete" messages per request: the final chunk (with `data`)
                    # and then "Streaming completed". Only the first ends the sentence; counting the
                    # second cut the next sentence off before it was spoken.
                    if data.get("data") is not None:
                        if self._active_context_id and not self._lead_released:
                            await self._release_lead(self._active_context_id)  # a short sentence
                        await self._finish_active_context()
                elif kind == "error":
                    await self._finish_active_context(error_msg=f"Gnani TTS error: {data.get('message') or data}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            await self._finish_active_context(error_msg=f"Gnani WS receive error: {e}")
            raise
        else:
            await self._finish_active_context(error_msg="Gnani WebSocket closed before synthesis completed")

    async def _play(self, context_id: str, audio: bytes):
        await self.append_to_audio_context(
            context_id, TTSAudioRawFrame(audio=audio, sample_rate=self._rate, num_channels=1, context_id=context_id)
        )

    async def _release_lead(self, context_id: str):
        lead, self._lead, self._lead_released = bytes(self._lead), bytearray(), True
        if lead:
            await self._play(context_id, lead)

    async def _finish_active_context(self, *, error_msg: str | None = None):
        context_id = self._active_context_id
        if context_id:
            if error_msg:
                await self.append_to_audio_context(context_id, ErrorFrame(error=error_msg))
            await self.append_to_audio_context(context_id, TTSStoppedFrame(context_id=context_id))
            await self.remove_audio_context(context_id)
            await self.stop_all_metrics()
        self._release()

    def _release(self):
        self._active_context_id = None
        self._lead, self._lead_released = bytearray(), False
        if self._synthesis_lock.locked():
            self._synthesis_lock.release()

    def _payload(self, text: str) -> dict:
        language = self.spoken_language if self.spoken_language in LANGUAGES else "auto"
        return {
            "text": text,
            "voice": self._setting("voice", DEFAULT_VOICE),
            "model": self._setting("model", DEFAULT_MODEL),
            "language": language,
            "audio_config": {"sample_rate": self._rate, "num_channels": 1, "sample_width": 2, "encoding": "linear_pcm", "container": "raw"},
        }

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        text = spell_phone_numbers(re.sub(r"\s+", " ", text).strip(), self.spoken_language)
        if not text:
            yield TTSStoppedFrame(context_id=context_id)
            await self.remove_audio_context(context_id)
            return

        await self._synthesis_lock.acquire()
        self._active_context_id = context_id
        self._lead, self._lead_released = bytearray(), False
        try:
            if not self._websocket or self._websocket.state is State.CLOSED:
                await self._connect()
            await self._get_websocket().send(json.dumps(self._payload(text)))
            await self.start_tts_usage_metrics(text)
            yield None
        except Exception as e:
            yield ErrorFrame(error=f"Gnani send failed: {e}")
            yield TTSStoppedFrame(context_id=context_id)
            await self.remove_audio_context(context_id)
            self._release()
            await self._disconnect()
