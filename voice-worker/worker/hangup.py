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
    """Tracks who spoke last so a silent line can be hung up."""

    def __init__(self) -> None:
        self.last_activity = time.monotonic()
        self.user_speaking = False

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def user_started(self) -> None:
        self.user_speaking = True
        self.touch()

    def user_stopped(self) -> None:
        self.user_speaking = False
        self.touch()


async def guard_call(
    clock: CallClock, task: PipelineTask, call_sid: str, max_call_secs: int, silence_secs: int
) -> None:
    """Hang up on a line nobody is speaking on, and on calls that run past the hard cap."""
    started = time.monotonic()
    while True:
        await asyncio.sleep(1)
        now = time.monotonic()
        if max_call_secs and now - started >= max_call_secs:
            events.log("call.max_duration", "WARNING", call_sid=call_sid, seconds=max_call_secs)
            await task.stop_when_done()
            return
        if silence_secs and not clock.user_speaking and now - clock.last_activity >= silence_secs:
            events.log("call.silence_hangup", "WARNING", call_sid=call_sid, seconds=silence_secs)
            await task.stop_when_done()
            return
