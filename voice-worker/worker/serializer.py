"""VoiceLink WebSocket protocol <-> Pipecat frames.

Audio on the wire is base64 A-law, 8 kHz, mono, in both directions.
"""

import base64
import json

from loguru import logger
from pipecat.audio.utils import alaw_to_pcm, create_stream_resampler, pcm_to_alaw
from pipecat.frames.frames import (
    AudioRawFrame,
    Frame,
    InputAudioRawFrame,
    InterruptionFrame,
)
from pipecat.processors.frame_processor import FrameProcessorSetup
from pipecat.serializers.base_serializer import FrameSerializer


class VoiceLinkFrameSerializer(FrameSerializer):
    class InputParams(FrameSerializer.InputParams):
        voicelink_sample_rate: int = 8000
        sample_rate: int | None = None

    def __init__(self, stream_sid: str, params: InputParams | None = None, **kwargs):
        super().__init__(params or VoiceLinkFrameSerializer.InputParams(), **kwargs)
        self._stream_sid = stream_sid
        self._wire_rate = self._params.voicelink_sample_rate
        self._sample_rate = 0  # pipeline input rate, set in setup()
        self._input_resampler = create_stream_resampler()
        self._output_resampler = create_stream_resampler()

    async def setup(self, setup: FrameProcessorSetup):
        self._sample_rate = self._params.sample_rate or setup.audio_in_sample_rate

    async def serialize(self, frame: Frame) -> str | bytes | None:
        if isinstance(frame, InterruptionFrame):
            # Barge-in: drop audio VoiceLink has queued but not yet played.
            return json.dumps({"event": "clear", "stream_sid": self._stream_sid})
        if isinstance(frame, AudioRawFrame):
            alaw = await pcm_to_alaw(frame.audio, frame.sample_rate, self._wire_rate, self._output_resampler)
            if not alaw:
                return None
            payload = base64.b64encode(alaw).decode("utf-8")
            return json.dumps({"event": "media", "media": {"payload": payload}})
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        try:
            message = json.loads(data)
        except json.JSONDecodeError:
            logger.warning(f"Unparseable VoiceLink message: {data!r}")
            return None

        if message.get("event") != "media":
            return None
        payload = message.get("media", {}).get("payload")
        if not payload:
            return None
        pcm = await alaw_to_pcm(base64.b64decode(payload), self._wire_rate, self._sample_rate, self._input_resampler)
        if not pcm:
            return None
        return InputAudioRawFrame(audio=pcm, num_channels=1, sample_rate=self._sample_rate)
