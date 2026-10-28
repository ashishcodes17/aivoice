"""Letting the agent end the call, plus the safety nets for when it does not.

VoiceLink keeps a call open until a human hangs up, so without this an agent that said goodbye
leaves the line (and the bill) running.
"""

import asyncio
import re
import time

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.frames.frames import EndWorkerFrame, FunctionCallResultProperties, TTSSpeakFrame
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.frame_processor import FrameDirection
from pipecat.services.llm_service import FunctionCallParams

from . import events

# The model forgets the tool when this sits mid-prompt (0 of 8 tries on a real call), so it is
# worded as a duty with a cost and bot.py puts it last.
END_CALL_RULE = (
    "HANGING UP: you are the only one who can end the call; the line stays open and costs money until "
    "you call the end_call tool. Every time you say a closing line, such as goodbye, thanks and the team "
    "will call you, or take care, you MUST call end_call in that same reply, after the words. Once the "
    "details are confirmed and the next step is agreed, close the call this way. Never say goodbye "
    "without calling end_call, and never call end_call without saying a short goodbye first, even when "
    "the caller has already said bye: the call must not end in silence. Do not call it while the caller is still asking or answering something."
)

END_CALL_TOOLS = ToolsSchema(
    standard_tools=[
        FunctionSchema(
            name="end_call",
            description=(
                "Hang up the phone call. Use it only after you have said goodbye and the caller "
                "has nothing more to ask."
            ),
            properties={},
            required=[],
        )
    ]
)


GOODBYES = {
    "te": "సరే అండి, థాంక్స్! బై!",
    "hi": "ठीक है जी, धन्यवाद! नमस्ते!",
    "en": "Alright, thank you! Bye!",
}


def register_end_call(llm, call_sid: str, language: str = "en-IN", spoke=lambda: True, hold_secs: float = 0.0) -> None:
    """`spoke()` says whether the model said anything in this reply. Some models hang up with only
    the tool call when the caller says bye first, which would end the call in silence.

    `hold_secs` waits before hanging up. Smallest releases a line only when it has finished it, about
    4.7 s after the request, and the hangup queued behind the goodbye made the goodbye start 3.6 s
    late; holding the hangup back lets the goodbye play first."""

    async def end_call(params: FunctionCallParams) -> None:
        events.log("call.end_requested", call_sid=call_sid, by="agent")
        if not spoke():
            events.log("call.goodbye_added", call_sid=call_sid)
            await params.llm.push_frame(TTSSpeakFrame(GOODBYES.get(language.split("-")[0], GOODBYES["en"])))
        # No follow-up completion: the goodbye was already spoken in this turn.
        await params.result_callback(None, properties=FunctionCallResultProperties(run_llm=False))
        if hold_secs:
            await asyncio.sleep(hold_secs)
        # EndWorkerFrame is turned into an EndFrame that queues behind the goodbye audio.
        await params.llm.push_frame(EndWorkerFrame(), FrameDirection.UPSTREAM)

    llm.register_function("end_call", end_call)


# Closing lines the model sometimes says without calling end_call. Telugu words are matched as whole
# words (బై must not match బైక్).
_TE = "\u0C00-\u0C7F"
_FAREWELL = re.compile(
    rf"(?<![{_TE}])(బై|టేక్ కేర్|జాగ్రత్త(గా)?\s*ఉండండి|గుడ్\s*బై|వీడ్కోలు)(?![{_TE}])"
    r"|\b(bye|goodbye|take care|have a (good|nice) day)\b"
    r"|अलविदा|(?<![\u0900-\u097F])बाय(?![\u0900-\u097F])",
    re.IGNORECASE,
)


def is_farewell(text: str) -> bool:
    return bool(_FAREWELL.search(text or ""))


class CallClock:
    """Tracks who spoke last so a silent line can be nudged, then hung up."""

    def __init__(self) -> None:
        self.last_activity = time.monotonic()
        self.user_speaking = False
        self.nudges = 0  # nudges sent since the caller last spoke
        self.said_goodbye = False  # the agent's last turn was a closing line

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def user_started(self) -> None:
        self.user_speaking = True
        self.nudges = 0
        self.said_goodbye = False
        self.touch()

    def agent_finished(self, text: str) -> None:
        self.said_goodbye = is_farewell(text)

    def user_stopped(self) -> None:
        self.user_speaking = False
        self.touch()


async def guard_call(
    clock: CallClock,
    task: PipelineTask,
    call_sid: str,
    max_call_secs: int,
    silence_secs: int,
    nudge_secs: int = 0,
    nudge=None,
    hangup_after_nudge_secs: int = 12,
    goodbye_grace_secs: float = 4,
) -> None:
    """Check in on a quiet line like a person would, then hang up; also cap the call length."""
    started = time.monotonic()
    while True:
        await asyncio.sleep(1)
        now = time.monotonic()
        if max_call_secs and now - started >= max_call_secs:
            events.log("call.max_duration", "WARNING", call_sid=call_sid, seconds=max_call_secs)
            await task.stop_when_done()
            return
        if clock.user_speaking:
            continue
        quiet = now - clock.last_activity
        if clock.said_goodbye and quiet >= goodbye_grace_secs:
            # The agent said goodbye but did not call end_call; nobody is saying anything more.
            events.log("call.goodbye_hangup", call_sid=call_sid, quiet_seconds=round(quiet, 1))
            await task.stop_when_done()
            return
        if nudge and nudge_secs and clock.nudges == 0 and quiet >= nudge_secs:
            clock.nudges += 1
            events.log("call.nudge", call_sid=call_sid, quiet_seconds=round(quiet))
            await nudge()
            clock.touch()
            continue
        limit = hangup_after_nudge_secs if clock.nudges else silence_secs
        if limit and quiet >= limit:
            events.log("call.silence_hangup", "WARNING", call_sid=call_sid, seconds=round(quiet), nudged=bool(clock.nudges))
            await task.stop_when_done()
            return
