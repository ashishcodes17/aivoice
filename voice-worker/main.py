import hmac
import json
import sys
import time

from fastapi import BackgroundTasks, FastAPI, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from loguru import logger

from worker import events, probe, version, whatsapp
from worker.bot import run_bot
from worker.config import settings
from worker.store import Store
from worker.voices import apply_voice_override, ensure_provider_ready

logger.remove()
logger.add(sys.stderr, level=settings.log_level.upper())

app = FastAPI()
store = Store()


def _token_ok(token: str) -> bool:
    return bool(settings.ws_token) and hmac.compare_digest(token, settings.ws_token)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/wa/webhook")
async def whatsapp_verify(request: Request):
    """Meta's one-time check when the webhook URL is saved: echo the challenge if the token matches."""
    q = request.query_params
    expected = settings.whatsapp_verify_token
    if expected and q.get("hub.mode") == "subscribe" and hmac.compare_digest(q.get("hub.verify_token", ""), expected):
        return Response(q.get("hub.challenge", ""), media_type="text/plain")
    return Response("forbidden", status_code=403)


@app.post("/wa/webhook")
async def whatsapp_webhook(request: Request, background: BackgroundTasks):
    """Customer messages from WhatsApp. Answer Meta at once (it retries slow webhooks) and reply in the background."""
    raw = await request.body()
    if not whatsapp.verify_signature(raw, request.headers.get("x-hub-signature-256"), settings.meta_app_secret):
        return Response("forbidden", status_code=403)
    try:
        messages = whatsapp.parse_inbound(json.loads(raw))
    except ValueError:
        return Response("bad request", status_code=400)
    for msg in messages:
        background.add_task(whatsapp.handle_message, store, msg)
    return {"ok": True}


@app.get("/debug/status")
async def debug_status(token: str = ""):
    """Which code is running and which provider keys are set (booleans only)."""
    if not _token_ok(token):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return version.status()


@app.get("/debug/probe")
async def debug_probe(token: str = ""):
    """Time every configured LLM and voice provider from this server (a few paise; takes ~20 s)."""
    if not _token_ok(token):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return await probe.run()


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

    # A call the dashboard asked VoiceLink to place carries the ids of its call row, so use that
    # instead of guessing from the numbers (which side is the DID differs between directions).
    params = start.get("custom_parameters") or {}
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except ValueError:
            params = {}
    callback = None
    if params.get("call_row_id"):
        callback = await store.get_callback(params["call_row_id"], params.get("org_id"), params.get("agent_id"))
        if callback is None:
            events.log("callback.rejected", "WARNING", call_sid=call_sid, call_row_id=params.get("call_row_id"))

    if callback:
        agent, org_id, direction, call_id = callback["agents"], callback["org_id"], "outbound", callback["id"]
        agent = apply_voice_override(agent, (callback.get("metadata") or {}).get("voice"), call_sid)
        await store.attach_call(call_id, call_sid)
    else:
        number, direction = await store.find_agent(start.get("to"), start.get("from"))
        if number is None:
            events.log("agent.not_found", "WARNING", call_sid=call_sid, from_=start.get("from"), to=start.get("to"))
            await websocket.close(code=1008)
            return
        agent, org_id = number["agents"], number["org_id"]
        call_id = await store.upsert_call(
            org_id=org_id,
            agent_id=agent["id"],
            call_sid=call_sid,
            direction=direction,
            from_number=start.get("from"),
            to_number=start.get("to"),
        )
    agent = ensure_provider_ready(agent, call_sid)
    events.log("agent.matched", call_sid=call_sid, agent=agent["name"], direction=direction, call_id=call_id, callback=bool(callback))

    began = time.monotonic()
    try:
        # The person on the other end: whoever we called, or whoever called us.
        customer = start.get("to") if direction == "outbound" else start.get("from")
        # A test call is short: it spends the free credit and rings from a shared number.
        is_test = bool(callback and (callback.get("metadata") or {}).get("kind") == "test")
        await run_bot(
            websocket, start, agent, org_id, call_id, store, direction=direction, customer_number=customer,
            max_call_secs=settings.test_call_max_secs if is_test else None,
        )
    except Exception as e:  # keep the process alive; the log line explains what went wrong
        events.log("call.error", "ERROR", call_sid=call_sid, error=f"{type(e).__name__}: {e}")
        raise
    finally:
        events.log("call.finished", call_sid=call_sid, seconds=round(time.monotonic() - began, 1))
        try:
            await websocket.close()  # VoiceLink may leave it open after `stop`
        except Exception:
            pass
