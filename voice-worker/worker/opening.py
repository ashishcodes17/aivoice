"""How an outbound call opens.

People answer the phone with "hello?". Talking over it sounds like a robot, so the agent waits a
moment for it. The opening line is then spoken from the agent's configured text: generating it with
the LLM cost about a second, let the model reword it, and streamed it in pieces.
"""

from pipecat.frames.frames import Frame, LLMContextFrame, TTSSpeakFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


def outbound_note(greeting: str | None) -> str:
    base = "You placed this call yourself because the person asked for a callback. "
    if greeting:
        return (
            base
            + f'Your opening line is spoken for you automatically: "{greeting}". It is already in the '
            "conversation, so never say it again. If they say hello or ask who is calling after it, answer "
            "briefly that it is you (your name and the clinic, a few words), and carry on from what they say."
        )
    # No scripted opening in this language: the model opens, in the call's language.
    return (
        base
        + "The person has just picked up and said hello. Open now, in the language of this call: say who "
        "you are and which clinic you are calling from, why you are calling (they asked for a callback), and "
        "ask whether they can talk now. Keep it to two short sentences, and never say it twice."
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
