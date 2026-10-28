"""When may the caller cut the agent off?

Sarvam's server-side VAD proposes a turn start on any sound. While the agent is talking, that
means a cough, a TV, someone nearby or line noise interrupts her mid-sentence: the audio is
cleared and the voice sounds broken. So while she speaks, a turn only starts (and interrupts
her) once the transcript holds real words; when she is quiet, any speech starts a turn at once.
"""

import time

from loguru import logger
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    InterimTranscriptionFrame,
    ProposedUserStartedSpeakingFrame,
    TranscriptionFrame,
)
from pipecat.turns.types import ProcessFrameResult
from pipecat.turns.user_start import ExternalUserTurnStartStrategy

from . import events
from .levels import LevelTracker
from .transcripts import _words, clean_transcript


class GuardedBargeInStartStrategy(ExternalUserTurnStartStrategy):
    def __init__(
        self,
        *,
        min_words: int = 2,
        thinking_secs: float = 4.0,
        call_sid: str | None = None,
        levels: LevelTracker | None = None,
        level_ratio: float = 0.45,
        min_level: float = 300.0,
        **kwargs,
    ):
        super().__init__(enable_interruptions=True, **kwargs)
        self._min_words = min_words
        # A voice quieter than the caller has been is someone nearby, not the caller (see levels.py).
        self._levels = levels
        self._level_ratio = level_ratio
        self._min_level = min_level
        self._turn_started_at = time.monotonic()
        self._last_ignored = 0.0
        self._thinking_secs = thinking_secs
        # Until this time the reply to the caller's last turn is being written but not yet spoken.
        # A sound in that gap used to cancel the reply before it began.
        self._thinking_until = 0.0
        self._call_sid = call_sid
        self._bot_speaking = False
        # Speech began while she was talking and no turn has started yet. Its words usually arrive
        # after she has finished, and must then still start the caller's turn.
        self._pending = False

    async def handle_user_turn_started(self):
        self._pending = False
        self._thinking_until = 0.0
        self._turn_started_at = time.monotonic()

    async def handle_user_turn_stopped(self):
        self._thinking_until = time.monotonic() + self._thinking_secs
        if self._levels:
            self._levels.commit_turn(self._turn_started_at)

    def _too_quiet(self) -> tuple[bool, float | None, float | None]:
        """Is the voice heard just now much quieter than this caller usually is?"""
        if not self._levels:
            return False, None, None
        level, reference = self._levels.recent(), self._levels.reference
        if level is None:
            return False, level, reference
        floor = max(self._min_level, self._levels.expected() * self._level_ratio)
        return level < floor, level, reference

    @property
    def _busy(self) -> bool:
        """She is speaking, or about to: a lone sound must not cut her off."""
        return self._bot_speaking or time.monotonic() < self._thinking_until

    async def process_frame(self, frame: Frame) -> ProcessFrameResult:
        if isinstance(frame, BotStartedSpeakingFrame):
            self._bot_speaking = True
            self._thinking_until = 0.0
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self._bot_speaking = False
        elif isinstance(frame, ProposedUserStartedSpeakingFrame) and self._busy:
            # A sound while she talks: wait for words before deciding it is the caller.
            self._pending = True
            logger.debug(f"{self}: sound while the agent is speaking, waiting for words")
            return ProcessFrameResult.CONTINUE
        elif isinstance(frame, (TranscriptionFrame, InterimTranscriptionFrame)):
            # Count real words only: filler sounds and noise loops must not cut her off.
            words = len(_words(clean_transcript(frame.text)))
            if self._busy and words >= self._min_words:
                quiet, level, reference = self._too_quiet()
                if quiet:
                    # Someone nearby, not the caller: keep talking. Logged at most twice a second.
                    now = time.monotonic()
                    if now - self._last_ignored > 0.5:
                        self._last_ignored = now
                        events.log("call.background_ignored", call_sid=self._call_sid, words=words, heard_level=round(level), caller_level=round(reference or 0), text=frame.text[:60])
                    return ProcessFrameResult.CONTINUE
                events.log("call.barge_in", call_sid=self._call_sid, words=words, heard_level=round(level) if level else None, caller_level=round(reference) if reference else None, text=frame.text[:80])
                await self.trigger_user_turn_started()
                return ProcessFrameResult.STOP
            if not self._busy and self._pending and words:
                await self.trigger_user_turn_started()
                return ProcessFrameResult.STOP
            return ProcessFrameResult.CONTINUE
        return await super().process_frame(frame)
