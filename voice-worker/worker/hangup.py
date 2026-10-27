"""Letting the agent end the call, plus the safety nets for when it does not.

VoiceLink keeps a call open until a human hangs up, so without this an agent that said goodbye
leaves the line (and the bill) running.
"""

import asyncio
import time

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.frames.frames import EndWorkerFrame, FunctionCallResultProperties
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
    "without calling end_call. Do not call it while the caller is still asking or answering something."
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


def register_end_call(llm, call_sid: str) -> None:
    async def end_call(params: FunctionCallParams) -> None:
        events.log("call.end_requested", call_sid=call_sid, by="agent")
        # No follow-up completion: the goodbye was already spoken in this turn.
        await params.result_callback(None, properties=FunctionCallResultProperties(run_llm=False))
        # EndWorkerFrame is turned into an EndFrame that queues behind the goodbye audio.
        await params.llm.push_frame(EndWorkerFrame(), FrameDirection.UPSTREAM)

    llm.register_function("end_call", end_call)


class CallClock:
    """Tracks who spoke last so a silent line can be nudged, then hung up."""

    def __init__(self) -> None:
        self.last_activity = time.monotonic()
        self.user_speaking = False
        self.nudges = 0  # nudges sent since the caller last spoke

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def user_started(self) -> None:
        self.user_speaking = True
        self.nudges = 0
        self.touch()

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
