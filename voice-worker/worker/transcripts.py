"""Tidy what the speech recognizer hands to the conversation.

Two real failures seen on live calls:
* Sarvam looped on noise, returning "లే లే లే ..." about 100 times in one turn, which then sat in
  the conversation and inflated every later request.
* Filler sounds ("అ", "ఉమ్", "ఏ ఏ.") were treated as full turns, so the agent answered them.
* Short noise loops ("ఓ లే లే లే.") cut the agent off mid-sentence and got an answer of their own.
"""

import re

from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from . import events

MAX_REPEATS = 6  # real digit runs ("nine nine nine nine nine") stay intact; loops of 100 do not
MAX_CHARS = 600

# Sounds people make while thinking or acknowledging, not words. "hello" is deliberately not
# here: on a phone it is a real question ("can you hear me?") and deserves an answer.
FILLERS = {
    # Telugu vowels and hesitation sounds
    "అ", "ఆ", "ఇ", "ఈ", "ఉ", "ఊ", "ఎ", "ఏ", "ఒ", "ఓ", "ఉమ్", "ఊ", "హ్మ్", "హమ్", "హూ", "ఆహ్", "ఊహూ", "ఊహు", "హా",
    # Hindi
    "अ", "आ", "उम", "उम्", "हम्म", "हूँ", "ऊं",
    # English
    "um", "umm", "uh", "uhh", "er", "erm", "hmm", "hm", "mm", "mmm", "ah", "aa", "oh", "ooh", "huh",
}
_PUNCT = ".,!?।…-–—'\"“”‘’;:()[]"


def _words(text: str) -> list[str]:
    return [w for w in (t.strip(_PUNCT) for t in text.split()) if w]


def clean_transcript(text: str) -> str:
    # Collapse a word repeated more than MAX_REPEATS times in a row.
    out: list[str] = []
    previous, run = None, 0
    for token in text.split():
        run = run + 1 if token == previous else 1
        previous = token
        if run <= MAX_REPEATS:
            out.append(token)
    text = " ".join(out)[:MAX_CHARS].strip()

    # A turn made only of filler sounds says nothing: blank it so the agent does not answer.
    words = _words(text)
    if words and all(w.lower() in FILLERS for w in words):
        return ""
    # One short syllable said over and over (with or without fillers) is the recognizer looping on
    # noise, not speech. Latin words are left alone: "no no no" is a real answer.
    rest = [w for w in words if w.lower() not in FILLERS]
    if len(set(rest)) == 1 and len(rest[0]) <= 2 and len(rest) >= 3 and not rest[0].isascii():
        return ""
    return text


class TranscriptCleaner(FrameProcessor):
    """Sits between speech recognition and the conversation."""

    def __init__(self, call_sid: str | None):
        super().__init__()
        self._call_sid = call_sid

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            cleaned = clean_transcript(frame.text)
            if cleaned != frame.text:
                events.log(
                    "transcript.cleaned",
                    call_sid=self._call_sid,
                    before_chars=len(frame.text),
                    after_chars=len(cleaned),
                    blanked=not cleaned,
                    before=frame.text[:80],
                )
                frame.text = cleaned
        await self.push_frame(frame, direction)
