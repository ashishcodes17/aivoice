"""Rumik text-to-speech over its streaming WebSocket, at the phone line's native format.

Adapted from the community `pipecat-rumik` package with three changes for telephony:
audio is requested as 8 kHz A-law (no 24 kHz -> 8 kHz resample), replies are sent a sentence
at a time instead of buffered whole (the package's default adds seconds of dead air), and
the muga tone tag / mulberry description are added for us.
"""

import asyncio
import audioop
import json
import re
import ssl
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from urllib.parse import urlencode

import aiohttp
import certifi
from loguru import logger
from pipecat.frames.frames import (
    CancelFrame,
    EndFrame,
    ErrorFrame,
    Frame,
    StartFrame,
    TTSAudioRawFrame,
    TTSStoppedFrame,
)
from pipecat.services.settings import NOT_GIVEN, TTSSettings, NotGiven
from pipecat.services.tts_service import InterruptibleTTSService
from websockets.asyncio.client import connect as websocket_connect
from websockets.protocol import State

from .config import settings
from .textfilter import spell_phone_numbers

SAMPLE_RATE = 8000
DEFAULT_MODEL = "mulberry"
# mulberry takes a free-text voice description on every request (and bills its characters).
DEFAULT_DESCRIPTION = "A warm, clear, friendly female voice speaking at a natural pace."
# muga needs an opening tone tag.
MUGA_TONE = "[neutral] "


@dataclass
class RumikTTSSettings(TTSSettings):
    description: str | None | NotGiven = field(default_factory=lambda: NOT_GIVEN)


class RumikTTSService(InterruptibleTTSService):
    Settings = RumikTTSSettings
    _settings: Settings

    # Language of the call, used to say phone numbers digit by digit in the right words.
    spoken_language = "en-IN"

    def __init__(self, *, api_key: str, gateway_url: str, settings: Settings | None = None, **kwargs):
        defaults = RumikTTSSettings(model=DEFAULT_MODEL, voice=None, language=None, description=None)
        if settings is not None:
            defaults.apply_update(settings)
        super().__init__(
            push_stop_frames=False,
            push_start_frame=True,
            pause_frame_processing=True,
            sample_rate=SAMPLE_RATE,
            settings=defaults,
            **kwargs,
        )
        self._api_key = api_key
        self._gateway_url = gateway_url.rstrip("/")
        self._receive_task: asyncio.Task | None = None
        self._active_context_id: str | None = None
        # One request at a time on the socket; held across a cancel until the server confirms.
        self._synthesis_lock = asyncio.Lock()
        self._cancel_pending = False

    def can_generate_metrics(self) -> bool:
        return True

    @property
    def _model(self) -> str:
        return self._settings.model if self._settings.model not in (None, NOT_GIVEN) else DEFAULT_MODEL

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
        self._clear_active_context()

    async def _connect_websocket(self):
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return
            session = await self._mint_session()
            sep = "&" if "?" in session["ws_url"] else "?"
            url = f"{session['ws_url']}{sep}{urlencode({'token': session['token']})}"
            ctx = ssl.create_default_context(cafile=certifi.where()) if url.startswith("wss://") else None
            self._websocket = await websocket_connect(url, ssl=ctx, ping_interval=20, ping_timeout=30)
            await self._call_event_handler("on_connected")
        except Exception as e:
            self._websocket = None
            # A rejected key never starts working mid-call: say so, so the call can move to a backup
            # voice at once instead of after several silent sentences.
            rejected = any(f"HTTP {code}" in str(e) for code in (401, 403))
            await self.push_error(error_msg=f"Rumik WS connect failed: {e}", exception=e, force_treat_as_permanent=rejected)
            await self._call_event_handler("on_connection_error", f"{e}")

    async def _disconnect_websocket(self):
        try:
            await self.stop_all_metrics()
            if self._websocket and self._websocket.state is State.OPEN:
                try:
                    await self._websocket.send(json.dumps({"type": "close"}))
                except Exception:
                    pass
                await self._websocket.close()
        except Exception as e:
            await self.push_error(error_msg=f"Rumik WS disconnect error: {e}", exception=e)
        finally:
            self._websocket = None
            await self._call_event_handler("on_disconnected")

    async def _mint_session(self) -> dict:
        # The output format is fixed when the session is minted, not per message.
        body = {"text": "init", "model": self._model, "audio_format": "alaw"}
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as http:
            async with http.post(
                f"{self._gateway_url}/v1/tts/ws-connect",
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
            ) as r:
                if r.status != 200:
                    raise Exception(f"HTTP {r.status}: {(await r.text())[:200]}")
                data = await r.json()
        for key in ("ws_url", "token"):
            if key not in data:
                raise ValueError(f"Rumik ws-connect response missing {key!r}")
        return data

    def _get_websocket(self):
        if self._websocket:
            return self._websocket
        raise Exception("WebSocket not connected")

    async def _report_error(self, error: ErrorFrame):
        await self._finish_active_context()
        await super()._report_error(error)

    async def on_audio_context_interrupted(self, context_id: str):
        """Barge-in: cancel on the warm socket and wait for the server to confirm."""
        if context_id == self._active_context_id or self._synthesis_lock.locked():
            self._active_context_id = None
            try:
                if self._websocket and self._websocket.state is State.OPEN:
                    await self._websocket.send(json.dumps({"type": "cancel"}))
                    self._cancel_pending = True
                else:
                    self._clear_active_context()
            except Exception:
                self._clear_active_context()
            self._bot_speaking = False
        await super().on_audio_context_interrupted(context_id)

    async def _receive_messages(self):
        try:
            async for message in self._get_websocket():
                if isinstance(message, bytes):
                    await self.stop_ttfb_metrics()
                    context_id = self._active_context_id
                    if not context_id:
                        continue  # audio from a request we already cancelled
                    pcm = audioop.alaw2lin(message, 2)
                    await self.append_to_audio_context(
                        context_id,
                        TTSAudioRawFrame(audio=pcm, sample_rate=SAMPLE_RATE, num_channels=1, context_id=context_id),
                    )
                    continue
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                kind = data.get("type")
                if kind in ("done", "cancelled"):
                    await self._finish_active_context()
                elif kind == "timeout":
                    self._disconnecting = True
                    await self._disconnect_websocket()
                    break
                elif kind == "error" or data.get("error"):
                    await self._finish_active_context(error_msg=f"Rumik TTS error: {data}")
                    await self._disconnect_websocket()
                    break
        except asyncio.CancelledError:
            raise
        except Exception as e:
            if self._active_context_id:
                await self._finish_active_context(error_msg=f"Rumik WS receive error: {e}")
            raise
        else:
            if self._active_context_id:
                await self._finish_active_context(error_msg="Rumik WebSocket closed before synthesis completed")

    async def _finish_active_context(self, *, error_msg: str | None = None):
        self._cancel_pending = False
        context_id = self._active_context_id
        if not context_id:
            self._clear_active_context()
            return
        if error_msg:
            await self.append_to_audio_context(context_id, ErrorFrame(error=error_msg))
        await self.append_to_audio_context(context_id, TTSStoppedFrame(context_id=context_id))
        await self.remove_audio_context(context_id)
        await self.stop_all_metrics()
        self._clear_active_context()

    def _clear_active_context(self):
        self._active_context_id = None
        if self._synthesis_lock.locked():
            self._synthesis_lock.release()

    def _payload(self, text: str) -> dict:
        voice = self._settings.voice if self._settings.voice not in (None, NOT_GIVEN) else None
        description = self._settings.description if self._settings.description not in (None, NOT_GIVEN) else None
        if self._model == "muga":
            if not text.startswith("["):
                text = MUGA_TONE + text
            payload = {"text": text, "temperature": 0.7}
        else:
            payload = {"text": text, "description": description or DEFAULT_DESCRIPTION}
        # Rumik stops a line at 2048 generated tokens, which cuts off a long reply in the middle of
        # a word ("the audio is cut off early" in its docs); its ceiling is 8000. Off by default:
        # not yet confirmed to be accepted on the streaming path. Set RUMIK_MAX_NEW_TOKENS=4096.
        if settings.rumik_max_new_tokens:
            payload["max_new_tokens"] = settings.rumik_max_new_tokens
        if voice:
            payload["speaker"] = voice
        return payload

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        text = spell_phone_numbers(re.sub(r"\s+", " ", text).strip(), self.spoken_language)
        if not text:
            yield TTSStoppedFrame(context_id=context_id)
            await self.remove_audio_context(context_id)
            return

        await self._synthesis_lock.acquire()
        self._active_context_id = context_id
        try:
            if not self._websocket or self._websocket.state is State.CLOSED:
                await self._connect()
            await self._get_websocket().send(json.dumps(self._payload(text)))
            await self.start_tts_usage_metrics(text)
            yield None
        except Exception as e:
            yield ErrorFrame(error=f"Rumik send failed: {e}")
            yield TTSStoppedFrame(context_id=context_id)
            await self.remove_audio_context(context_id)
            self._clear_active_context()
            await self._disconnect()
