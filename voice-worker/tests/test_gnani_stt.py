"""Gnani STT against a fake local server: headers, 1024-byte framing, speech boundaries, transcript.
Run: .venv/bin/python tests/test_gnani_stt.py   (no network)"""
import asyncio, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import websockets
from pipecat.frames.frames import (InputAudioRawFrame, ProposedUserStartedSpeakingFrame,
                                   ProposedUserStoppedSpeakingFrame, TranscriptionFrame, EndFrame)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.transcriptions.language import Language
from worker import gnani_stt
from worker.gnani_stt import GnaniSTTService

seen = {"headers": None, "frames": []}


async def server(ws):
    seen["headers"] = dict(ws.request.headers)
    await ws.send(json.dumps({"type": "connected"}))
    async for m in ws:
        seen["frames"].append(len(m))
        if len(seen["frames"]) == 3:
            await ws.send(json.dumps({"type": "speech_start"}))
            await ws.send(json.dumps({"type": "processing"}))
            await ws.send(json.dumps({"type": "transcript", "text": " hello there ", "segment_index": 1}))


class Sink(FrameProcessor):
    def __init__(self):
        super().__init__(name="sink"); self.got = []

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, (ProposedUserStartedSpeakingFrame, ProposedUserStoppedSpeakingFrame, TranscriptionFrame)):
            self.got.append(type(frame).__name__ + (":" + frame.text if isinstance(frame, TranscriptionFrame) else ""))
        await self.push_frame(frame, direction)


async def main():
    async with websockets.serve(server, "127.0.0.1", 8911):
        gnani_stt.URL = "ws://127.0.0.1:8911"
        stt = GnaniSTTService(api_key="KEY", sample_rate=8000, silence_ms=400,
                              settings=GnaniSTTService.Settings(model=None, language=Language.TE_IN))
        sink = Sink()
        task = PipelineTask(Pipeline([stt, sink]))

        async def feed():
            await asyncio.sleep(0.5)
            for _ in range(10):  # 10 x 320 B (20 ms at 8 kHz) = 3200 B -> three 1024 B frames, 128 B left over
                await task.queue_frame(InputAudioRawFrame(audio=b"\x01\x00" * 160, sample_rate=8000, num_channels=1))
                await asyncio.sleep(0.02)
            await asyncio.sleep(0.6)
            await task.queue_frame(EndFrame())

        await asyncio.gather(PipelineRunner(handle_sigint=False).run(task), feed())
    h = seen["headers"]
    print("headers:", {k: h.get(k) for k in ("x-api-key-id", "language_code", "x-sample-rate", "x-min-silence-ms", "x-idle-timeout-sec")})
    print("frame sizes:", seen["frames"], "| out:", sink.got)
    assert h["x-api-key-id"] == "KEY" and h["language_code"] == "te-IN" and h["x-sample-rate"] == "8000"
    assert h["x-min-silence-ms"] == "400" and "model" not in h
    assert seen["frames"] == [1024, 1024, 1024]
    assert sink.got == ["ProposedUserStartedSpeakingFrame", "ProposedUserStoppedSpeakingFrame", "TranscriptionFrame:hello there"], sink.got

asyncio.run(main())
print("gnani stt: ok")
