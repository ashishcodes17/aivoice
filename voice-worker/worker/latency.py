"""Per-turn latency: where does the wait between the caller finishing and the agent speaking go?"""

import time

from pipecat.frames.frames import Frame, LLMFullResponseStartFrame, LLMTextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from . import events

# A model that takes longer than this to its first words makes the caller hear dead air.
SLOW_LLM_MS = 1500


class TurnTimer:
    """Stamps the three moments of a turn and logs the breakdown once audio leaves."""

    def __init__(self, call_sid: str | None):
        self.call_sid = call_sid
        self.turn = 0
        self._stop: float | None = None
        self._llm: float | None = None
        self._audio: float | None = None

    def user_stopped(self) -> None:
        if self._stop is not None and self._audio is None:
            # The caller spoke again before the last turn was answered: they sat in silence.
            events.log(
                "latency.unanswered",
                "WARNING",
                call_sid=self.call_sid,
                turn=self.turn,
                waited_ms=round((time.monotonic() - self._stop) * 1000),
                llm_started=self._llm is not None,
            )
        self.turn += 1
        self._stop, self._llm, self._audio = time.monotonic(), None, None

    def llm_token(self) -> None:
        if self._stop is not None and self._llm is None:
            self._llm = time.monotonic()

    def audio_out(self) -> None:
        if self._stop is None or self._audio is not None:
            return
        self._audio = time.monotonic()
        llm = self._llm if self._llm is not None else self._audio
        slow = (llm - self._stop) * 1000 > SLOW_LLM_MS
        events.log(
            "latency",
            "WARNING" if slow else "INFO",
            call_sid=self.call_sid,
            turn=self.turn,
            turn_end_to_llm_first_token_ms=round((llm - self._stop) * 1000),
            llm_first_token_to_audio_ms=round((self._audio - llm) * 1000),
            turn_end_to_audio_ms=round((self._audio - self._stop) * 1000),
        )


class LLMProbe(FrameProcessor):
    """Sits between the LLM and TTS; notes when the model's first text arrives."""

    def __init__(self, timer: TurnTimer):
        super().__init__()
        self._timer = timer
        # Has the model said anything in the reply being generated? (A reply that is only a tool
        # call, such as hanging up, has no words.)
        self.spoke = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMFullResponseStartFrame):
            self.spoke = False
        if isinstance(frame, LLMTextFrame):
            self._timer.llm_token()
            if frame.text.strip():
                self.spoke = True
        await self.push_frame(frame, direction)
