"""Facts about this particular call that the agent should not have to ask for or guess."""

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

_TELUGU_DAYS = ["సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం", "ఆదివారం"]


def _coming_days(now: datetime) -> str:
    """The next week spelled out. Left to work out "tomorrow" or "this Saturday" itself, the model
    gets the weekday or the date wrong often enough to book people on the wrong day."""
    out = []
    for i in range(0, 8):
        d = now + timedelta(days=i)
        label = "today" if i == 0 else "tomorrow" if i == 1 else ""
        out.append(f"{d.strftime('%A') + f' {d.day} ' + d.strftime('%B')} = {_TELUGU_DAYS[d.weekday()]}" + (f" ({label})" if label else ""))
    return "; ".join(out)


def national_number(raw: str | None) -> str | None:
    """The caller's 10-digit mobile number from whatever spelling VoiceLink sent."""
    digits = re.sub(r"\D", "", raw or "")
    return digits[-10:] if len(digits) >= 10 else None


def _spoken_digits(number: str) -> str:
    return " ".join(number)


def call_context_note(direction: str, customer_number: str | None, now: datetime | None = None) -> str:
    now = now or datetime.now(IST)
    parts = [
        f"RIGHT NOW (India time): {now.strftime('%A, %d %B %Y, %I:%M %p').replace(' 0', ' ')}. "
        "Use it: \"రేపు\" means tomorrow's real date and weekday, and a day or time outside the clinic's "
        "opening hours must be corrected kindly with the nearest time that is open. If they ask whether "
        "the clinic is open now, answer from the timings and this time."
    ]
    parts.append("THE NEXT DAYS (use exactly these; say the Telugu weekday aloud): " + _coming_days(now) + ".")
    if customer_number:
        how = "you called this number" if direction == "outbound" else "they are calling from this number"
        parts.append(
            f"THE PERSON'S NUMBER: {_spoken_digits(customer_number)} ({how}). You already have it, so never ask "
            'them to say it. When you need a contact number, confirm it instead: "ఈ నంబర్‌కే కాల్ చేయమంటారా, '
            'లేక వేరే నంబర్ ఇస్తారా?" You may read back its last four digits. Only if they give a different '
            "number, take that one (10 digits, read back in words)."
        )
    return "\n".join(parts)
