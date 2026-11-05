"""A service that can no longer work makes the switcher move to the next. Run:
.venv/bin/python tests/test_switcher_failover.py   (no network)"""
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from pipecat.frames.frames import ErrorFrame, TextFrame, EndFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.service_switcher import ServiceSwitcher, ServiceSwitcherStrategyFailover
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection


class Fake(FrameProcessor):
    def __init__(self, name, dead=False):
        super().__init__(name=name)
        self.dead, self.seen = dead, []

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TextFrame):
            self.seen.append(frame.text)
            if self.dead:
                await self.set_usable(False)
                await self.push_error(error_msg="Credits exhausted", fatal=False)
                return
        await self.push_frame(frame, direction)


class Sink(FrameProcessor):
    def __init__(self):
        super().__init__(name="sink"); self.got = []

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TextFrame):
            self.got.append(frame.text)
        await self.push_frame(frame, direction)


async def main():
    a, b, c = Fake("sarvam", dead=True), Fake("gnani"), Fake("eleven")
    sw = ServiceSwitcher([a, b, c], strategy_type=ServiceSwitcherStrategyFailover)
    switched = []

    @sw.strategy.event_handler("on_service_switched")
    async def _(strategy, service):
        switched.append(service.name)

    sink = Sink()
    task = PipelineTask(Pipeline([sw, sink]))
    runner = PipelineRunner(handle_sigint=False)

    async def feed():
        await asyncio.sleep(0.5)
        await task.queue_frame(TextFrame("one"))
        await asyncio.sleep(0.5)
        await task.queue_frame(TextFrame("two"))
        await asyncio.sleep(0.5)
        await task.queue_frame(EndFrame())

    await asyncio.gather(runner.run(task), feed())
    print("switched:", switched, "| a saw", a.seen, "| b saw", b.seen, "| sink", sink.got)
    assert switched == ["gnani"], switched
    assert b.seen == ["two"] and "two" in sink.got, (b.seen, sink.got)

asyncio.run(main())
print("switcher failover: ok")
