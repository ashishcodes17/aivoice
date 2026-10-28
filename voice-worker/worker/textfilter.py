"""Keep what the caller must not hear out of the voice.

Models occasionally slip a word from another language into a reply (a Russian "удобно" inside
Telugu, for example). Telugu and Latin TTS voices read it as noise, and a prompt rule does not
stop it, so characters outside the scripts a phone agent should use are dropped before synthesis.

Given conflicting instructions (an English prompt on a Telugu call), a model has also spoken its
own reasoning aloud ("the user said hello, the instructions say..."). Such sentences are dropped
whole before they reach the voice.

A model also sometimes says a sentence it said one or two turns ago, word for word, whatever the
prompt says. Such a sentence is dropped (unless that would leave the reply silent).
"""

import re

from pipecat.frames.frames import Frame, InterruptionFrame, LLMFullResponseEndFrame, LLMFullResponseStartFrame, LLMTextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from . import events

# Keep: ASCII, Latin-1 and Latin Extended (accents), all Indic scripts (U+0900-0DFF), zero-width
# joiners, and general punctuation (dashes, quotes, ellipsis). Everything else is removed.
_STRAY = re.compile(r"[^\x00-\x7F -ɏऀ-෿​-‍‐-‧‰-⁞]")


def strip_stray_scripts(text: str) -> str:
    return _STRAY.sub("", text)


# Words an agent never says to a caller but a model narrating its reasoning does.
_META = re.compile(
    r"\bthe user\b|\bthe caller (?:said|says|is|wants|asked)\b|\b(?:the|my|these|those) instructions?\b"
    r"|\bsystem prompt\b|\bthe prompt\b|\bchain of thought\b|</?[a-z_]{2,}>"
    r"|\bI (?:need|should|have) to (?:open|respond|reply|answer) (?:now|in|with|the)\b|\blet me (?:think|reason)\b",
    re.IGNORECASE,
)
# Where a spoken sentence ends: . ! ? or the Devanagari danda, before a space; or a line break.
_SENTENCE_END = re.compile(r"(?<=[.!?\u0964])\s+|\n+")


def is_meta_talk(sentence: str) -> bool:
    return bool(_META.search(sentence))


_PUNCT = re.compile(r"[\s.,!?;:\u0964'\"\u201c\u201d\u2018\u2019()\-\u2013\u2014\u2026]+")
REPEAT_MIN_WORDS = 5  # "సరే అండి." may be said twice; a whole statement should not be
REPEAT_MEMORY_REPLIES = 2


def sentence_key(sentence: str) -> str:
    return _PUNCT.sub(" ", sentence.lower()).strip()


_DIGIT_WORDS = {
    "te": ["సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది"],
    "hi": ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ"],
    "en": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
}
# Seven or more digits in a row (optionally grouped by single spaces or dashes) is a phone number.
_LONG_NUMBER = re.compile(r"(?<![\d,.])\d(?:[ -]?\d){6,}(?![\d,.])")


def spell_phone_numbers(text: str, language: str = "te-IN") -> str:
    """A TTS voice reads "9133525601" as a huge number; a phone number must be said digit by digit,
    in the language of the call (a Telugu word in the middle of an English sentence is worse).

    Only long digit runs are touched. Amounts and times (800, 6, 4,500) are left for the voice's
    own number handling, which says them correctly.
    """
    words = _DIGIT_WORDS.get(language.split("-")[0], _DIGIT_WORDS["en"])

    def spell(m: re.Match) -> str:
        return ", ".join(words[int(c)] for c in m.group(0) if c.isdigit())

    return _LONG_NUMBER.sub(spell, text)


class ScriptFilter(FrameProcessor):
    """Between the LLM and the voice: removes stray scripts, and holds text a sentence at a time so a
    sentence of the model's own reasoning can be dropped whole. The voice speaks in sentences
    anyway, so holding to the end of one adds no delay."""

    def __init__(self, call_sid: str | None = None):
        super().__init__()
        self._call_sid = call_sid
        self._buffer = ""
        self._history: list[set[str]] = []  # sentences of the last few finished replies
        self._current: list[str] = []  # sentences let through in the reply being written
        self._held_repeat: str | None = None  # last repeat dropped, spoken only if nothing else is

    def _is_repeat(self, sentence: str) -> bool:
        key = sentence_key(sentence)
        return len(key.split()) >= REPEAT_MIN_WORDS and any(key in earlier for earlier in self._history)

    async def _release(self, text: str, direction: FrameDirection):
        if not text.strip():
            if text:
                await self.push_frame(LLMTextFrame(text), direction)
            return
        if is_meta_talk(text):
            events.log("llm.meta_removed", "WARNING", call_sid=self._call_sid, text=text[:160])
            return
        if self._is_repeat(text):
            events.log("llm.repeat_removed", "WARNING", call_sid=self._call_sid, text=text[:120])
            self._held_repeat = text
            return
        self._current.append(sentence_key(text))
        await self.push_frame(LLMTextFrame(text), direction)

    async def _flush(self, direction: FrameDirection):
        text, self._buffer = self._buffer, ""
        if text:
            await self._release(text, direction)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if direction != FrameDirection.DOWNSTREAM:
            await self.push_frame(frame, direction)
            return
        if isinstance(frame, LLMTextFrame):
            clean = strip_stray_scripts(frame.text)
            if clean != frame.text:
                events.log("llm.stray_script_removed", "WARNING", call_sid=self._call_sid, removed=_STRAY.findall(frame.text))
            self._buffer += clean
            parts = _SENTENCE_END.split(self._buffer)
            # Everything but the last part is a finished sentence; keep the spacing between them.
            if len(parts) > 1:
                done_len = len(self._buffer) - len(parts[-1])
                finished, self._buffer = self._buffer[:done_len], self._buffer[done_len:]
                for sentence in re.findall(r".+?(?:[.!?\u0964]\s+|\n+|$)", finished, flags=re.S):
                    await self._release(sentence, direction)
            return
        if isinstance(frame, InterruptionFrame):
            # Cut off mid-reply: the caller may not have heard it, so it does not count as said.
            self._buffer, self._current, self._held_repeat = "", [], None
        elif isinstance(frame, LLMFullResponseStartFrame):
            if self._current:
                self._history = (self._history + [set(self._current)])[-REPEAT_MEMORY_REPLIES:]
            self._buffer, self._current, self._held_repeat = "", [], None
        else:
            # Anything else (end of the reply, a tool call, end of the call) comes after the text so far.
            await self._flush(direction)
            if isinstance(frame, LLMFullResponseEndFrame) and not self._current and self._held_repeat:
                # The whole reply was a repeat: say it rather than leave the caller in silence.
                held, self._held_repeat = self._held_repeat, None
                self._current.append(sentence_key(held))
                await self.push_frame(LLMTextFrame(held), direction)
        await self.push_frame(frame, direction)
