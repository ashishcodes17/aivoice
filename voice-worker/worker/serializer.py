"""VoiceLink WebSocket media protocol <-> Pipecat frames.

Written against VoiceLink's own Pipecat SDK, which was built from frames captured on real
calls, because VoiceLink's public docs are wrong in several places:

* No `connected` event is sent; `start` arrives first.
* The bot's configured audio format is advisory. The `start` frame's `media_format` is the
  only truth, so the codec and rate are resolved from it.
* Key casing is inconsistent (`stream_sid` on start, `streamSid` on media/stop), and it is
  unproven which spelling VoiceLink reads on outbound frames, so both are sent.
"""

import base64
import json
import time
from collections import Counter
from typing import Any

from loguru import logger
from pipecat.audio.utils import (
    alaw_to_pcm,
    create_stream_resampler,
    pcm_to_alaw,
    pcm_to_ulaw,
    ulaw_to_pcm,
)
from pipecat.frames.frames import (
    AudioRawFrame,
    EndFrame,
    Frame,
    InputAudioRawFrame,
    InterruptionFrame,
    OutputTransportMessageFrame,
    OutputTransportMessageUrgentFrame,
)
from pipecat.processors.frame_processor import FrameProcessorSetup
from pipecat.serializers.base_serializer import FrameSerializer

from . import events

# (encoding name without "audio/", sample rate) -> (codec, rate)
_WIRE_FORMATS = {
    ("alaw", 8000): "alaw",
    ("pcma", 8000): "alaw",
    ("ulaw", 8000): "ulaw",
    ("mulaw", 8000): "ulaw",
    ("pcmu", 8000): "ulaw",
    ("l16", 8000): "l16",
    ("l16", 16000): "l16",
    ("pcm", 8000): "l16",
    ("pcm", 16000): "l16",
}


def resolve_format(media_format: dict[str, Any] | None) -> tuple[str, int]:
    """Codec and sample rate actually streamed, from the `start` frame's media_format."""
    fmt = media_format or {}
    encoding = str(fmt.get("encoding") or "audio/alaw").strip().lower().removeprefix("audio/")
    try:
        rate = int(fmt.get("sample_rate") or 8000)
    except (TypeError, ValueError):
        rate = 8000
    codec = _WIRE_FORMATS.get((encoding, rate))
    if codec is None:
        # Guessing would feed noise to the transcriber for the whole call.
        raise ValueError(f"Unsupported VoiceLink media_format: encoding={encoding!r} sample_rate={rate}")
    return codec, rate


class VoiceLinkFrameSerializer(FrameSerializer):
    class InputParams(FrameSerializer.InputParams):
        sample_rate: int | None = None

    def __init__(self, start: dict[str, Any], params: InputParams | None = None, **kwargs):
        super().__init__(params or VoiceLinkFrameSerializer.InputParams(), **kwargs)
        self._stream_sid: str | None = start.get("stream_sid") or start.get("streamSid")
        self._call_sid: str | None = start.get("call_sid") or start.get("callSid")
        self._codec, self._wire_rate = resolve_format(start.get("media_format"))
        self._sample_rate = 0  # pipeline input rate, set in setup()
        self._in_resampler = create_stream_resampler()
        self._out_resampler = create_stream_resampler()
        self.frames_in = 0
        self.on_audio_out = None  # callback fired for every outgoing audio frame
        self.on_stop = None  # async callback fired once when VoiceLink says the call is over
        self._stopped = False
        self.frames_out = 0
        self.interruptions = 0
        # What VoiceLink actually sent us, so "no audio" can be told apart from "audio we discarded".
        self.msgs = Counter()      # every inbound message, by event name
        self.tracks = Counter()    # media messages, by track label
        self.dropped = Counter()   # media messages that did not become audio, by reason
        self._last_media = None
        self.max_gap_ms = 0        # longest silence between two media messages since the last heartbeat
        self._unusual_logged = 0
        # Our own sending: a pause of 120-1500 ms between two outgoing audio frames is a stutter the
        # caller can hear (shorter is normal pacing, longer is the gap between sentences or turns).
        self._last_out = None
        self.out_stutters = 0
        self.longest_out_gap_ms = 0
        events.log(
            "audio.format",
            call_sid=self._call_sid,
            codec=self._codec,
            wire_rate=self._wire_rate,
            stream_sid=self._stream_sid,
        )

    async def setup(self, setup: FrameProcessorSetup):
        self._sample_rate = self._params.sample_rate or setup.audio_in_sample_rate

    async def serialize(self, frame: Frame) -> str | bytes | None:
        if isinstance(frame, InterruptionFrame):
            self.interruptions += 1
            return json.dumps({"event": "clear", "stream_sid": self._stream_sid, "streamSid": self._stream_sid})
        if isinstance(frame, AudioRawFrame):
            wire = await self._from_pcm(frame.audio, frame.sample_rate)
            if not wire:
                return None
            if self.frames_out == 0:
                events.log("audio.first_out", call_sid=self._call_sid, bytes=len(wire))
            self.frames_out += 1
            out_now = time.monotonic()
            if self._last_out is not None:
                gap = int((out_now - self._last_out) * 1000)
                if 120 <= gap <= 1500:
                    self.out_stutters += 1
                    self.longest_out_gap_ms = max(self.longest_out_gap_ms, gap)
            self._last_out = out_now
            if self.on_audio_out:
                self.on_audio_out()
            return json.dumps(
                {
                    "event": "media",
                    "stream_sid": self._stream_sid,
                    "streamSid": self._stream_sid,
                    "media": {"payload": base64.b64encode(wire).decode("ascii")},
                }
            )
        if isinstance(frame, (OutputTransportMessageFrame, OutputTransportMessageUrgentFrame)):
            if self.should_ignore_frame(frame):
                return None
            return json.dumps(frame.message)
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        try:
            msg = json.loads(data)
        except (ValueError, TypeError):
            logger.warning(f"Skipping unparseable VoiceLink message: {data!r}")
            return None
        if not isinstance(msg, dict):
            return None

        event = msg.get("event")
        self.msgs[str(event)] += 1
        if event == "stop":
            if not self._stopped:
                self._stopped = True
                events.log("ws.stop", call_sid=self._call_sid, frames_in=self.frames_in, frames_out=self.frames_out)
                if self.on_stop:
                    await self.on_stop()
            return EndFrame()
        if event == "mark":
            logger.debug(f"VoiceLink mark: {msg.get('mark')}")
            return None
        if event != "media":
            if self._unusual_logged < 3 and event not in ("mark",):
                self._unusual_logged += 1
                events.log("audio.unusual", "WARNING", call_sid=self._call_sid, event=event, keys=sorted(msg.keys()))
            return None

        media = msg.get("media") if isinstance(msg.get("media"), dict) else {}
        now = time.monotonic()
        if self._last_media is not None:
            self.max_gap_ms = max(self.max_gap_ms, int((now - self._last_media) * 1000))
        self._last_media = now
        self.tracks[str(media.get("track"))] += 1
        # Caller audio is labelled "inbound"; ignore any echo of our own output.
        if media.get("track") not in (None, "inbound"):
            self.dropped["other_track"] += 1
            if self._unusual_logged < 3:
                self._unusual_logged += 1
                events.log("audio.unusual", "WARNING", call_sid=self._call_sid, track=media.get("track"), keys=sorted(msg.keys()), media_keys=sorted(media.keys()))
            return None
        payload = media.get("payload")
        if not payload:
            self.dropped["empty_payload"] += 1
            return None
        try:
            pcm = await self._to_pcm(base64.b64decode(payload))
        except ValueError:
            self.dropped["undecodable"] += 1
            logger.warning("Skipping undecodable VoiceLink media frame")
            return None
        if not pcm:
            self.dropped["empty_pcm"] += 1
            return None
        if self.frames_in == 0:
            events.log("audio.first_in", call_sid=self._call_sid, bytes=len(payload))
        self.frames_in += 1
        return InputAudioRawFrame(audio=pcm, num_channels=1, sample_rate=self._sample_rate)

    async def _to_pcm(self, audio: bytes) -> bytes:
        if self._codec == "alaw":
            return await alaw_to_pcm(audio, self._wire_rate, self._sample_rate, self._in_resampler)
        if self._codec == "ulaw":
            return await ulaw_to_pcm(audio, self._wire_rate, self._sample_rate, self._in_resampler)
        return await self._in_resampler.resample(audio, self._wire_rate, self._sample_rate)

    async def _from_pcm(self, pcm: bytes, in_rate: int) -> bytes:
        if self._codec == "alaw":
            return await pcm_to_alaw(pcm, in_rate, self._wire_rate, self._out_resampler)
        if self._codec == "ulaw":
            return await pcm_to_ulaw(pcm, in_rate, self._wire_rate, self._out_resampler)
        return await self._out_resampler.resample(pcm, in_rate, self._wire_rate)
