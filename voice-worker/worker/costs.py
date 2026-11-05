"""What did this call cost us? LLM from OpenRouter's own figure, voice and hearing from units x rates.

OpenRouter returns the exact dollar cost with every completion (`usage.cost`). Sarvam does not
return any cost, but bills in plain units we can measure: characters spoken and minutes of audio.
Rates below are Sarvam's published pay-as-you-go prices (https://www.sarvam.ai/api-pricing,
checked Oct 2026). They are the one thing to update if Sarvam changes its pricing.
"""

from dataclasses import dataclass
from typing import Any

from pipecat.frames.frames import Frame
from pipecat.metrics.metrics import TTSUsageMetricsData
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.openrouter.llm import OpenRouterLLMService

from .config import settings

# INR per 1,000 characters of synthesized speech.
SARVAM_TTS_INR_PER_1K_CHARS = {"bulbul:v3": 3.00, "bulbul:v3-beta": 3.00, "bulbul:v4-flash": 1.00}
# Rumik, same unit. Excludes mulberry's per-request voice description (about 65 characters billed
# on each reply, roughly 6% extra), which we do not count here.
RUMIK_TTS_INR_PER_1K_CHARS = {"mulberry": 0.50, "muga": 0.99}
# Smallest AI Lightning v3.1 Pro: about $0.195 per 10,000 characters at the 88 INR/USD in settings.
SMALLEST_TTS_USD_PER_1K_CHARS = {"lightning_v3.1_pro": 0.0195}
DEFAULT_SMALLEST_TTS_MODEL = "lightning_v3.1_pro"
DEFAULT_RUMIK_TTS_MODEL = "mulberry"
# Sarvam's own chat models, INR per 1M tokens (input, output). The "-conversations" variant is not on
# the price page; it is billed here at the 105B rate until Sarvam's invoice says otherwise.
SARVAM_LLM_INR_PER_M_TOKENS = {"sarvam-105b": (15.0, 60.0), "sarvam-105b-conversations": (15.0, 60.0)}
DEFAULT_SARVAM_TTS_MODEL = "bulbul:v3"  # what Sarvam uses when the agent does not choose one


@dataclass
class CallCosts:
    llm_model: str
    stt_provider: str
    tts_provider: str
    tts_model: str | None
    llm_requests: int = 0
    llm_prompt_tokens: int = 0
    llm_completion_tokens: int = 0
    llm_usd: float = 0.0
    llm_cost_missing: int = 0  # completions where the provider reported no cost
    tts_chars: int = 0
    stt_seconds: float = 0.0

    def add_sarvam_llm(self, prompt: int, completion: int) -> None:
        """A completion from Sarvam's own LLM: no cost comes back, so price it from the tokens."""
        rate_in, rate_out = SARVAM_LLM_INR_PER_M_TOKENS.get(self.llm_model, (None, None))
        usd = None
        if rate_in is not None:
            usd = ((prompt or 0) * rate_in + (completion or 0) * rate_out) / 1_000_000 / settings.usd_to_inr
        self.add_llm(prompt, completion, usd)

    def add_llm(self, prompt: int, completion: int, usd: float | None) -> None:
        self.llm_requests += 1
        self.llm_prompt_tokens += prompt or 0
        self.llm_completion_tokens += completion or 0
        if usd is None:
            self.llm_cost_missing += 1
        else:
            self.llm_usd += usd

    def summary(self) -> dict[str, Any]:
        fx = settings.usd_to_inr
        llm_inr = self.llm_usd * fx

        tts_rate = None
        tts_inr = None
        if self.tts_provider == "sarvam":
            model = self.tts_model or DEFAULT_SARVAM_TTS_MODEL
            tts_rate = SARVAM_TTS_INR_PER_1K_CHARS.get(model)
            tts_inr = self.tts_chars / 1000 * tts_rate if tts_rate is not None else None

        if self.tts_provider == "rumik":
            model = self.tts_model or DEFAULT_RUMIK_TTS_MODEL
            tts_rate = RUMIK_TTS_INR_PER_1K_CHARS.get(model)
            tts_inr = self.tts_chars / 1000 * tts_rate if tts_rate is not None else None

        if self.tts_provider == "smallest":
            model = self.tts_model or DEFAULT_SMALLEST_TTS_MODEL
            usd = SMALLEST_TTS_USD_PER_1K_CHARS.get(model)
            tts_rate = None if usd is None else round(usd * fx, 4)
            tts_inr = None if usd is None else self.tts_chars / 1000 * usd * fx

        if self.tts_provider == "gnani" and settings.gnani_tts_inr_per_1k_chars is not None:
            tts_rate = settings.gnani_tts_inr_per_1k_chars
            tts_inr = self.tts_chars / 1000 * tts_rate

        stt_rate = settings.sarvam_stt_inr_per_min if self.stt_provider == "sarvam" else None
        if self.stt_provider == "gnani":
            stt_rate = settings.gnani_stt_inr_per_min
        stt_inr = self.stt_seconds / 60 * stt_rate if stt_rate is not None else None

        known = [llm_inr, tts_inr, stt_inr]
        return {
            "usd_to_inr": fx,
            "llm": {
                "model": self.llm_model,
                "requests": self.llm_requests,
                "prompt_tokens": self.llm_prompt_tokens,
                "completion_tokens": self.llm_completion_tokens,
                "usd": round(self.llm_usd, 8),
                "inr": round(llm_inr, 4),
                "completions_without_cost": self.llm_cost_missing,
            },
            "tts": {
                "provider": self.tts_provider,
                "model": self.tts_model or (DEFAULT_SARVAM_TTS_MODEL if self.tts_provider == "sarvam" else None),
                "characters": self.tts_chars,
                "rate_inr_per_1k_chars": tts_rate,
                "inr": None if tts_inr is None else round(tts_inr, 4),
            },
            "stt": {
                "provider": self.stt_provider,
                "seconds": round(self.stt_seconds, 1),
                "rate_inr_per_min": stt_rate,
                "inr": None if stt_inr is None else round(stt_inr, 4),
            },
            # Only parts with a known price are summed; unpriced parts show as null above.
            "total_inr": round(sum(x for x in known if x is not None), 4),
            "complete": all(x is not None for x in known),
        }


class _RecordsLLMUsage:
    """Mixin: after each completion, add its tokens (and cost, if the provider reports one) to the call."""

    _costs: CallCosts
    _last_cost: float | None = None

    def _token_usage(self, usage):
        # Some providers send a running total on every chunk, so keep only the latest.
        cost = getattr(usage, "cost", None)
        if cost is not None:
            self._last_cost = float(cost)
        return super()._token_usage(usage)

    def _record_llm_usage(self, tokens) -> None:
        self._costs.add_llm(tokens.prompt_tokens, tokens.completion_tokens, self._last_cost)
        self._last_cost = None

    async def start_llm_usage_metrics(self, tokens):
        self._record_llm_usage(tokens)
        await super().start_llm_usage_metrics(tokens)


class CostTrackingOpenRouterLLM(_RecordsLLMUsage, OpenRouterLLMService):
    """OpenRouter service that records the dollar cost OpenRouter reports for each completion."""

    def __init__(self, *, costs: CallCosts, **kwargs):
        super().__init__(**kwargs)
        self._costs = costs


class TTSUsageProbe(FrameProcessor):
    """Sits after the TTS; totals the characters the voice service reports having spoken."""

    def __init__(self, costs: CallCosts):
        super().__init__()
        self._costs = costs

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        for item in getattr(frame, "data", None) or []:
            if isinstance(item, TTSUsageMetricsData):
                self._costs.tts_chars += int(item.value)
        await self.push_frame(frame, direction)
