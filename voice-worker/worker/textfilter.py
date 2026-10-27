"""Keep stray scripts out of the voice.

Models occasionally slip a word from another language into a reply (a Russian "удобно" inside
Telugu, for example). Telugu and Latin TTS voices read it as noise, and a prompt rule does not
stop it, so characters outside the scripts a phone agent should use are dropped before synthesis.
"""

import re

from pipecat.frames.frames import Frame, LLMTextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from . import events

# Keep: ASCII, Latin-1 and Latin Extended (accents), all Indic scripts (U+0900-0DFF), zero-width
# joiners, and general punctuation (dashes, quotes, ellipsis). Everything else is removed.
_STRAY = re.compile(r"[^\x00-\x7F -ɏऀ-෿​-‍‐-‧‰-⁞]")


def strip_stray_scripts(text: str) -> str:
    return _STRAY.sub("", text)


class ScriptFilter(FrameProcessor):
    def __init__(self, call_sid: str | None = None):
        super().__init__()
        self._call_sid = call_sid

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMTextFrame) and direction == FrameDirection.DOWNSTREAM:
            clean = strip_stray_scripts(frame.text)
            if clean != frame.text:
                events.log("llm.stray_script_removed", "WARNING", call_sid=self._call_sid, removed=_STRAY.findall(frame.text))
                if not clean.strip():
                    return
                frame.text = clean
        await self.push_frame(frame, direction)
