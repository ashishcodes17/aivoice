"""Fill {{name}} placeholders in an agent's prompt and greetings with the values set in the builder."""

import re
from datetime import datetime
from zoneinfo import ZoneInfo

_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z_][\w.]*)\s*\}\}")


def builtin_variables(now: datetime | None = None) -> dict[str, str]:
    """Values available to every agent without being defined."""
    now = now or datetime.now(ZoneInfo("Asia/Kolkata"))
    return {
        "current_date": now.strftime("%A, %d %B %Y"),
        "current_time": now.strftime("%I:%M %p").lstrip("0"),
    }


def fill_variables(text: str | None, values: dict[str, str] | None, now: datetime | None = None) -> str:
    """Replace {{name}} with its value. The agent's own values win over built-ins; unknown names are left as written."""
    if not text:
        return text or ""
    merged = {**builtin_variables(now), **{k: str(v) for k, v in (values or {}).items() if str(v).strip()}}
    return _PLACEHOLDER.sub(lambda m: merged.get(m.group(1), m.group(0)), text)
