import hmac
import json

from fastapi import FastAPI, WebSocket
from loguru import logger

from worker.bot import run_bot
from worker.config import settings
from worker.store import Store

app = FastAPI()
store = Store()


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.websocket("/ws")
async def voicelink_ws(websocket: WebSocket, token: str = ""):
    # VoiceLink can't sign requests, so the shared secret rides on the wss:// URL.
    if not settings.ws_token or not hmac.compare_digest(token, settings.ws_token):
        await websocket.close(code=1008)
        return
    await websocket.accept()

    # VoiceLink sends `connected`, then `start` carrying the call metadata.
    start = None
    for _ in range(5):
        msg = json.loads(await websocket.receive_text())
        if msg.get("event") == "start":
            start = msg["start"]
            start.setdefault("stream_sid", msg.get("stream_sid"))
            break
    if start is None:
        await websocket.close(code=1002)
        return

    number, direction = await store.find_agent(start.get("to"), start.get("from"))
    if number is None:
        logger.warning(f"No agent for call {start.get('call_sid')} ({start.get('from')} -> {start.get('to')})")
        await websocket.close(code=1008)
        return

    agent = number["agents"]
    call_id = await store.upsert_call(
        org_id=number["org_id"],
        agent_id=agent["id"],
        call_sid=start["call_sid"],
        direction=direction,
        from_number=start.get("from"),
        to_number=start.get("to"),
    )
    logger.info(f"Call {start['call_sid']} -> agent {agent['name']!r} ({direction})")
    await run_bot(websocket, start, agent, number["org_id"], call_id, store)
