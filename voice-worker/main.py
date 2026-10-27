import hmac
import json
import time

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from worker import events
from worker.bot import run_bot
from worker.config import settings
from worker.store import Store

app = FastAPI()
store = Store()


def _token_ok(token: str) -> bool:
    return bool(settings.ws_token) and hmac.compare_digest(token, settings.ws_token)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/debug/events")
async def debug_events(token: str = "", limit: int = Query(100, le=500)):
    """Recent call events (connections, rejections, audio counters, errors)."""
    if not _token_ok(token):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return events.recent(limit)


@app.websocket("/ws")
async def voicelink_ws(websocket: WebSocket, token: str = ""):
    ip = websocket.headers.get("x-forwarded-for") or (websocket.client.host if websocket.client else "?")
    ua = websocket.headers.get("user-agent", "")

    # VoiceLink can't sign requests, so the shared secret rides on the wss:// URL.
    if not _token_ok(token):
        events.log("ws.rejected", "WARNING", reason="bad token" if token else "missing token", ip=ip, ua=ua)
        await websocket.close(code=1008)
        return
    await websocket.accept()
    events.log("ws.accepted", ip=ip, ua=ua)

    # VoiceLink sends `start` first (a `connected` event is documented but never sent).
    start = None
    try:
        for _ in range(5):
            msg = json.loads(await websocket.receive_text())
            events.log("ws.message", event=msg.get("event"), keys=sorted(msg.keys()))
            if msg.get("event") == "start":
                start = msg["start"]
                start.setdefault("stream_sid", msg.get("stream_sid"))
                break
    except WebSocketDisconnect as e:
        # VoiceLink's reachability probe connects and hangs up without a call.
        events.log("ws.closed_before_start", code=e.code, note="reachability probe or dropped call")
        return
    if start is None:
        events.log("ws.no_start", "WARNING")
        await websocket.close(code=1002)
        return

    call_sid = start.get("call_sid")
    events.log(
        "call.start",
        call_sid=call_sid,
        stream_sid=start.get("stream_sid"),
        from_=start.get("from"),
        to=start.get("to"),
        media_format=start.get("media_format"),
        custom_parameters=start.get("custom_parameters"),
    )

    number, direction = await store.find_agent(start.get("to"), start.get("from"))
    if number is None:
        events.log("agent.not_found", "WARNING", call_sid=call_sid, from_=start.get("from"), to=start.get("to"))
        await websocket.close(code=1008)
        return

    agent = number["agents"]
    call_id = await store.upsert_call(
        org_id=number["org_id"],
        agent_id=agent["id"],
        call_sid=call_sid,
        direction=direction,
        from_number=start.get("from"),
        to_number=start.get("to"),
    )
    events.log("agent.matched", call_sid=call_sid, agent=agent["name"], direction=direction, call_id=call_id)

    began = time.monotonic()
    try:
        await run_bot(websocket, start, agent, number["org_id"], call_id, store)
    except Exception as e:  # keep the process alive; the log line explains what went wrong
        events.log("call.error", "ERROR", call_sid=call_sid, error=f"{type(e).__name__}: {e}")
        raise
    finally:
        events.log("call.finished", call_sid=call_sid, seconds=round(time.monotonic() - began, 1))
