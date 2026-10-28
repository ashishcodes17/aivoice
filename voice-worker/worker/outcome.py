"""What did this call achieve? Read the transcript afterwards and keep the result on the call.

Done after the call from the transcript, not by asking the agent to report it mid-call: it then
works however the call ended (including a caller who simply hangs up), and a model that forgets a
tool never loses the result.
"""

import asyncio
import json
import re

import httpx

from . import events
from .config import settings
from .store import Store

OUTCOMES = (
    "visit_requested", "callback_requested", "busy_call_later", "info_only", "not_interested", "no_conversation",
    "qualified_lead", "quote_requested", "wrong_number", "do_not_call",
)

PROMPT = """You review a phone call between an AI agent for {business} and a person.
Return ONLY a JSON object with these keys, in English:
- "outcome": one of {outcomes}. visit_requested = they agreed to a concrete next step (a booking, appointment, visit, order, or a promise to pay by a date); callback_requested = they want the team to call them; busy_call_later = not a good time, call later; info_only = they only asked questions; not_interested = declined or asked not to be called; no_conversation = they never really spoke (silence, noise, hung up at once); qualified_lead = a real prospect with a clear need and timeline who has not yet agreed to a concrete step (a polite \"okay\" or \"I will see\" is NOT interest: choose info_only or not_interested unless the person gave a date, quantity or asked for rates or details); quote_requested = they asked for a quotation, rates or written details; wrong_number = not the person or business meant; do_not_call = they asked not to be contacted again.
- "name": the person's name if they clearly said it, else null.
- "need": what they want, in a few words (for example "tooth pain for 3 days", "table for six", "EMI due on the 5th"), else null.
- "preferred_time": the day and time they asked for, in English (for example "tomorrow evening 6 PM"), else null.
- "details": an object of the facts the agent was asked to find out and the person actually told it, with short English keys and short values (for example {{"stocking date": "first week of December", "quantity": "5 lakh", "location": "Bhimavaram", "current supplier": "X"}}); {{}} if none. Only what was said.
- "phone": a DIFFERENT phone number they gave (digits only), else null.
- "summary": one or two plain sentences a colleague at the business can act on.
- "follow_up": true if a human must contact them, else false.
Use only what is in the transcript. Never guess a name or a number. The transcript may have speech-recognition mistakes."""


def _json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])


async def extract(transcript: list[tuple[str, str]], business: str = "a business") -> dict | None:
    lines = [f"{'Person' if role == 'user' else 'Agent'}: {text}" for role, text in transcript if text.strip()]
    if not lines:
        return None
    async with httpx.AsyncClient(timeout=25) as http:
        r = await http.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={
                "model": settings.outcome_model,
                "messages": [
                    {"role": "system", "content": PROMPT.format(outcomes=", ".join(OUTCOMES), business=business)},
                    {"role": "user", "content": "\n".join(lines)},
                ],
                "max_tokens": 400,
                "temperature": 0,
                "reasoning": {"enabled": False},
                "provider": {"sort": "latency"},
            },
        )
        r.raise_for_status()
        data = _json(r.json()["choices"][0]["message"]["content"])
    if data.get("outcome") not in OUTCOMES:
        data["outcome"] = "info_only"
    details = data.get("details")
    data["details"] = {str(k)[:40]: str(v)[:120] for k, v in details.items() if v not in (None, "")} if isinstance(details, dict) else {}
    return data


async def record(store: Store, call_id: str, call_sid: str | None, transcript: list[tuple[str, str]], business: str = "a business") -> None:
    """Fire and forget: never let this hold up, or break, the end of a call."""
    try:
        outcome = await extract(transcript, business)
        if outcome:
            await store.save_metadata(call_id, "outcome", outcome)
            events.log("call.outcome", call_sid=call_sid, **{k: outcome.get(k) for k in ("outcome", "name", "need", "preferred_time", "follow_up")})
    except Exception as e:
        events.log("call.outcome_failed", "ERROR", call_sid=call_sid, error=f"{type(e).__name__}: {e}")


_running: set[asyncio.Task] = set()


def record_in_background(store: Store, call_id: str, call_sid: str | None, transcript: list[tuple[str, str]], business: str = "a business") -> None:
    task = asyncio.create_task(record(store, call_id, call_sid, list(transcript), business))
    _running.add(task)  # a task nobody references can be garbage collected mid-flight
    task.add_done_callback(_running.discard)
