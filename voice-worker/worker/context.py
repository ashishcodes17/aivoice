"""Facts about this particular call that the agent should not have to ask for or guess."""

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

_DAYS = {
    "te": ["సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం", "ఆదివారం"],
    "hi": ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"],
}
_CONFIRM_NUMBER = {
    "te": "ఈ నంబర్‌కే కాల్ చేయమంటారా, లేక వేరే నంబర్ ఇస్తారా?",
    "hi": "क्या हमारी टीम इसी नंबर पर कॉल करे, या कोई और नंबर देंगे?",
    "en": "Is it okay if our team calls you on this same number, or would you like to give another?",
}
_READ_BACK = {"te": "in Telugu words", "hi": "in Hindi words", "en": "in English words"}


def _coming_days(now: datetime, lang: str) -> str:
    """The next week spelled out. Left to work out "tomorrow" or "this Saturday" itself, the model
    gets the weekday or the date wrong often enough to book people on the wrong day."""
    out = []
    for i in range(0, 8):
        d = now + timedelta(days=i)
        label = "today" if i == 0 else "tomorrow" if i == 1 else ""
        local = f" = {_DAYS[lang][d.weekday()]}" if lang in _DAYS else ""
        out.append(f"{d.strftime('%A')} {d.day} {d.strftime('%B')}{local}" + (f" ({label})" if label else ""))
    return "; ".join(out)


def national_number(raw: str | None) -> str | None:
    """The caller's 10-digit mobile number from whatever spelling VoiceLink sent."""
    digits = re.sub(r"\D", "", raw or "")
    return digits[-10:] if len(digits) >= 10 else None


def _spoken_digits(number: str) -> str:
    return " ".join(number)


def call_context_note(
    direction: str, customer_number: str | None, now: datetime | None = None, language: str = "te-IN"
) -> str:
    lang = language.split("-")[0]
    now = now or datetime.now(IST)
    parts = [
        f"RIGHT NOW (India time): {now.strftime('%A, %d %B %Y, %I:%M %p').replace(' 0', ' ')}. "
        "Use it: \"tomorrow\" means the real next date and weekday, and a day or time outside the clinic's "
        "opening hours must be corrected kindly with the nearest time that is open. If they ask whether "
        "the clinic is open now, answer from the timings and this time."
    ]
    aloud = {"te": "say the Telugu weekday aloud", "hi": "say the Hindi weekday aloud"}.get(lang, "say the weekday in English")
    parts.append(f"THE NEXT DAYS (use exactly these; {aloud}): " + _coming_days(now, lang) + ".")
    if customer_number:
        how = "you called this number" if direction == "outbound" else "they are calling from this number"
        confirm = _CONFIRM_NUMBER.get(lang, _CONFIRM_NUMBER["en"])
        parts.append(
            f"THE PERSON'S NUMBER: {_spoken_digits(customer_number)} ({how}). You already have it, so never ask "
            f'them to say it. When you need a contact number, confirm it instead: "{confirm}" Never read the whole number out '
            f"loud: say \"this number\", or at most its last four digits. Only if they give a different number, take that one (10 digits, read back "
            f"{_READ_BACK.get(lang, _READ_BACK['en'])})."
        )
    return "\n".join(parts)
