"""Sarvam's own chat model as the call's brain, with an OpenRouter model standing by.

Sarvam's "conversations" model answered Telugu clinic questions as accurately as DeepSeek and began
speaking about 0.4 s sooner. It is one company's API though, so if a request fails or does not start
within the timeout, that request (and the next ones for a while) goes to the backup instead of
leaving the caller in silence.
"""

import asyncio
import time

from loguru import logger
from openai import APIError, APITimeoutError
from pipecat.services.sarvam.llm import SarvamLLMService

from . import events
from .costs import CallCosts, _RecordsLLMUsage

SARVAM_LLM_PREFIX = "sarvam-"


def is_sarvam_llm(model: str | None) -> bool:
    return bool(model and model.startswith(SARVAM_LLM_PREFIX))


# Sarvam answering "no credits" (or rejecting the key) will not change within minutes, and every
# turn that retries it first costs the caller about a second. Remember it for every call in this
# process, not just the current one.
OUT_OF_CREDITS_SECS = 600.0
_sarvam_unavailable_until = 0.0


class SarvamLLMWithBackup(_RecordsLLMUsage, SarvamLLMService):
    def __init__(self, *, costs: CallCosts, backup, call_sid: str | None, start_timeout_secs: float, cooldown_secs: float = 30.0, **kwargs):
        super().__init__(**kwargs)
        self._costs = costs
        self._backup = backup
        self._call_sid = call_sid
        self._start_timeout = start_timeout_secs
        self._cooldown = cooldown_secs
        self._backup_until = 0.0
        self._using_backup = False

    def _record_llm_usage(self, tokens) -> None:
        if self._using_backup:
            # Backup completions carry OpenRouter's own dollar figure.
            self._costs.add_llm(tokens.prompt_tokens, tokens.completion_tokens, self._last_cost)
            self._last_cost = None
        else:
            self._costs.add_sarvam_llm(tokens.prompt_tokens, tokens.completion_tokens)

    async def get_chat_completions(self, context):
        global _sarvam_unavailable_until
        if time.monotonic() < max(self._backup_until, _sarvam_unavailable_until):
            self._using_backup = True
            return await self._backup.get_chat_completions(context)
        self._using_backup = False
        try:
            return await asyncio.wait_for(super().get_chat_completions(context), timeout=self._start_timeout)
        except (TimeoutError, APITimeoutError, APIError, OSError) as e:
            reason = "no response in time" if isinstance(e, (TimeoutError, APITimeoutError)) else f"{type(e).__name__}: {str(e)[:120]}"
            self._backup_until = time.monotonic() + self._cooldown
            if getattr(e, "status_code", None) in (401, 402, 403):
                _sarvam_unavailable_until = time.monotonic() + OUT_OF_CREDITS_SECS
            self._using_backup = True
            events.log("llm.failover", "ERROR", call_sid=self._call_sid, failed="sarvam", reason=reason, now=getattr(self._backup, "model_name", "backup"))
            return await self._backup.get_chat_completions(context)
