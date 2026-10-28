"""How loud is the caller, and is a new voice as loud as the caller?

Someone talking near the caller (a TV, a colleague, a passer-by) reaches the microphone quieter than
the caller, who is speaking into it. Counting words cannot tell the two apart, so a bystander's
sentence cut the agent off mid-reply. Comparing loudness with the caller's own level can: a
barge-in has to be about as loud as the caller has been on this call.

Nothing here touches the audio or adds delay: frames are measured and passed on unchanged.
"""

import audioop
import time
from collections import deque

from pipecat.frames.frames import Frame, InputAudioRawFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

# What a caller on a phone line usually measures (16-bit RMS) until this caller has been heard; used so a
# bystander during the opening line is not mistaken for them.
TYPICAL_CALLER_LEVEL = 2500.0
FRAME_FLOOR = 150  # RMS below this is line silence, not speech
HISTORY_SECS = 6.0


class LevelTracker:
    def __init__(self) -> None:
        self._frames: deque[tuple[float, int]] = deque()
        self.reference: float | None = None  # the caller's usual speaking level on this call

    def add(self, rms: int) -> None:
        now = time.monotonic()
        self._frames.append((now, rms))
        while self._frames and now - self._frames[0][0] > HISTORY_SECS:
            self._frames.popleft()

    def _loud(self, since: float) -> list[int]:
        return sorted(r for t, r in self._frames if t >= since and r >= FRAME_FLOOR)

    def recent(self, window: float = 0.9) -> float | None:
        """Level of the speech heard in the last `window` seconds (75th percentile of its frames)."""
        loud = self._loud(time.monotonic() - window)
        if len(loud) < 5:
            return None
        return float(loud[int(len(loud) * 0.75)])

    def expected(self) -> float:
        return self.reference if self.reference is not None else TYPICAL_CALLER_LEVEL

    def commit_turn(self, since: float) -> None:
        """A caller's turn is over: fold how loud it was into their usual level."""
        loud = self._loud(since)
        if len(loud) < 10:
            return
        level = float(loud[int(len(loud) * 0.75)])
        current = self.expected()
        if level >= current:
            self.reference = level
        else:
            # A quieter turn (a soft speaker, or someone nearby that slipped through) pulls the caller's
            # usual level down only gradually: one bad turn cannot open the door to all the rest, while
            # a genuinely soft caller is followed within about three turns.
            self.reference = 0.8 * current + 0.2 * level


class LevelMeter(FrameProcessor):
    """Measures every incoming audio frame and passes it on untouched."""

    def __init__(self, tracker: LevelTracker):
        super().__init__()
        self._tracker = tracker

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame) and frame.audio:
            self._tracker.add(audioop.rms(frame.audio, 2))
        await self.push_frame(frame, direction)
