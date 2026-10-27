"""One place for everything the worker wants to say about calls.

Each event is written to the log AND kept in a small in-memory ring buffer so it can be
read back over HTTP (see /debug/events in main.py) without digging through Coolify logs.
Never pass secrets in here: callers must not include the WebSocket token.
"""

import json
import time
from collections import deque
from typing import Any

from loguru import logger

_buffer: deque[dict[str, Any]] = deque(maxlen=500)


def log(kind: str, level: str = "INFO", **fields: Any) -> None:
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z", "ts": round(time.time(), 3), "kind": kind, **fields}
    _buffer.append(entry)
    logger.log(level, f"[{kind}] " + json.dumps(fields, default=str, ensure_ascii=False))


def recent(limit: int = 100) -> list[dict[str, Any]]:
    return list(_buffer)[-limit:]
