"""How an outbound call opens.

People answer the phone with "hello?". Talking over it sounds like a robot, so the agent waits a
moment for it. The opening line is then spoken from the agent's configured text: generating it with
the LLM cost about a second, let the model reword it, and streamed it in pieces.
"""

from pipecat.frames.frames import Frame, LLMContextFrame, TTSSpeakFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


def outbound_note(greeting: str) -> str:
    return (
        "You placed this call yourself because the person asked for a callback. Your opening line is "
        f'spoken for you automatically: "{greeting}". It is already in the conversation, so never say it '
        "again. If they say hello or ask who is calling after it, answer briefly that it is you, for example "
        '"హా అండి, నేను కుముద, Sunrise Dental నుంచి", and carry on from what they say.'
    )


class OpeningGate(FrameProcessor):
    """Sits between the user aggregator and the LLM on outbound calls.

    The person's first turn ("hello?") is answered with the opening line instead of an LLM reply.
    Once the opening has been spoken, by this gate or because the line stayed quiet, every turn
    goes to the LLM as usual.
    """

    def __init__(self, greeting: str | None):
        super().__init__()
        self._greeting = greeting
        self.pending = bool(greeting)

    def take(self) -> str | None:
        """Claim the opening line (once); None if it has already been spoken."""
        if not self.pending:
            return None
        self.pending = False
        return self._greeting

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMContextFrame) and direction == FrameDirection.DOWNSTREAM:
            greeting = self.take()
            if greeting:
                await self.push_frame(TTSSpeakFrame(greeting), direction)
                return
        await self.push_frame(frame, direction)
