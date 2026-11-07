"""WhatsApp (Meta Cloud API): answer a customer's text or voice note with the business's agent.

Flow for one inbound message:
  webhook (signed by Meta) -> find the connected number and its agent in Supabase
  text        -> LLM -> text reply
  voice note  -> download (OGG/Opus) -> ffmpeg -> Gnani STT -> LLM -> Gnani TTS -> ffmpeg -> voice note

The Gnani sockets are the same realtime ones the phone pipeline uses; here each request opens one,
sends the whole clip, and closes it. Nothing is stored except the transcript text.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import re

import httpx
from loguru import logger
from websockets.asyncio.client import connect as websocket_connect

from .config import settings
from .gnani_stt import FRAME_BYTES, LANGUAGES as STT_LANGUAGES, URL as STT_URL
from .gnani_tts import DEFAULT_MODEL, DEFAULT_VOICE, LANGUAGES as TTS_LANGUAGES, URL as TTS_URL

STT_RATE = 16000
TTS_RATE = 24000
HISTORY_TURNS = 8
MAX_VOICE_NOTE_SECS = 120
# What a WhatsApp reader sees if something fails; never a stack trace.
FALLBACK_TEXT = "Sorry, I couldn't process that. Please try again in a moment."

SYSTEM_SUFFIX = (
    "\n\nYou are replying on WhatsApp. Keep replies short (1 to 3 sentences) and plain: no markdown, "
    "no lists. Reply in the language the customer used."
)


def verify_signature(raw_body: bytes, header: str | None, app_secret: str) -> bool:
    """Meta signs each webhook body with the app secret: header is 'sha256=<hex hmac>'."""
    if not header or not app_secret:
        return False
    expected = "sha256=" + hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header, expected)


def parse_inbound(payload: dict) -> list[dict]:
    """The customer messages in a webhook payload (status updates and other events are skipped)."""
    out: list[dict] = []
    if payload.get("object") != "whatsapp_business_account":
        return out
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            if change.get("field") != "messages":
                continue
            value = change.get("value") or {}
            phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
            names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts") or []}
            for m in value.get("messages") or []:
                kind = m.get("type")
                item = {
                    "phone_number_id": phone_number_id,
                    "wa_message_id": m.get("id"),
                    "from": m.get("from"),
                    "name": names.get(m.get("from")),
                    "kind": kind,
                    "text": "",
                    "media_id": None,
                }
                if kind == "text":
                    item["text"] = ((m.get("text") or {}).get("body") or "").strip()
                elif kind == "audio":
                    item["media_id"] = (m.get("audio") or {}).get("id")
                elif kind == "interactive":
                    reply = (m.get("interactive") or {}).get("button_reply") or (m.get("interactive") or {}).get("list_reply") or {}
                    item["kind"], item["text"] = "text", (reply.get("title") or "").strip()
                else:
                    continue  # images, stickers, locations...: not handled yet
                if item["phone_number_id"] and item["from"] and item["wa_message_id"]:
                    out.append(item)
    return out


# ---- audio conversion (needs ffmpeg on the server) --------------------------------------------

async def _ffmpeg(args: list[str], data: bytes) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-hide_banner", "-loglevel", "error", *args,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, err = await asyncio.wait_for(proc.communicate(data), timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {err.decode(errors='replace')[:300]}")
    return out


async def to_pcm16k(audio: bytes) -> bytes:
    """Any audio WhatsApp sends (OGG/Opus) -> raw 16-bit mono PCM at 16 kHz, capped in length."""
    return await _ffmpeg(
        ["-i", "pipe:0", "-t", str(MAX_VOICE_NOTE_SECS), "-f", "s16le", "-ac", "1", "-ar", str(STT_RATE), "pipe:1"], audio
    )


async def pcm_to_voice_note(pcm: bytes, rate: int = TTS_RATE) -> bytes:
    """Raw 16-bit mono PCM -> OGG/Opus, the only format WhatsApp shows as a voice note."""
    return await _ffmpeg(
        ["-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0", "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"], pcm
    )


# ---- Gnani speech ------------------------------------------------------------------------------

async def transcribe(pcm: bytes, language: str = "en-IN", *, url: str = STT_URL) -> str:
    """Gnani STT over its realtime socket: stream the clip, plus a little silence so its VAD closes
    the last segment, then collect the transcripts."""
    if not settings.gnani_api_key:
        raise RuntimeError("GNANI_API_KEY is not set")
    headers = {
        "x-api-key-id": settings.gnani_api_key,
        "language_code": language if language in STT_LANGUAGES else "en-IN",
        "x-sample-rate": str(STT_RATE),
        "x-idle-timeout-sec": "60",
    }
    if settings.gnani_stt_model:
        headers["model"] = settings.gnani_stt_model
    pcm = pcm + b"\x00" * (STT_RATE * 2)  # one second of silence
    pcm += b"\x00" * (-len(pcm) % FRAME_BYTES)
    parts: list[str] = []
    async with websocket_connect(url, additional_headers=headers, max_size=None) as ws:
        async def send():
            for i in range(0, len(pcm), FRAME_BYTES):
                await ws.send(pcm[i : i + FRAME_BYTES])
                await asyncio.sleep(0)  # let the receiver run

        sender = asyncio.create_task(send())
        try:
            # Done when the clip is sent and Gnani has been quiet for a couple of seconds.
            while True:
                timeout = 2.5 if sender.done() else 20
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=timeout)
                except asyncio.TimeoutError:
                    break
                if isinstance(message, bytes):
                    continue
                data = json.loads(message)
                if data.get("type") == "transcript" and (data.get("text") or "").strip():
                    parts.append(data["text"].strip())
                elif data.get("type") == "error":
                    raise RuntimeError(f"Gnani STT error: {data.get('message') or data}")
        finally:
            sender.cancel()
    return " ".join(parts)


async def synthesize(text: str, language: str = "en-IN", voice: str | None = None, *, url: str = TTS_URL) -> bytes:
    """Gnani TTS over its realtime socket: one sentence batch in, raw 16-bit mono PCM out."""
    if not settings.gnani_api_key:
        raise RuntimeError("GNANI_API_KEY is not set")
    payload = {
        "text": re.sub(r"\s+", " ", text).strip(),
        "voice": voice or DEFAULT_VOICE,
        "model": DEFAULT_MODEL,
        "language": language if language in TTS_LANGUAGES else "auto",
        "audio_config": {"sample_rate": TTS_RATE, "num_channels": 1, "sample_width": 2, "encoding": "linear_pcm", "container": "raw"},
    }
    pcm = bytearray()
    async with websocket_connect(url, additional_headers={"X-API-Key-ID": settings.gnani_api_key}, max_size=None) as ws:
        await ws.send(json.dumps(payload))
        while True:
            message = await asyncio.wait_for(ws.recv(), timeout=20)
            try:
                data = json.loads(message)
            except (TypeError, json.JSONDecodeError):
                continue
            kind = data.get("type")
            if kind == "audio":
                pcm += base64.b64decode((data.get("data") or {}).get("audio") or "")
            elif kind == "complete" and data.get("data") is not None:
                break  # the first "complete" carries the final chunk; the second is just "Streaming completed"
            elif kind == "error":
                raise RuntimeError(f"Gnani TTS error: {data.get('message') or data}")
    return bytes(pcm)


# ---- Meta Cloud API ----------------------------------------------------------------------------

class Meta:
    def __init__(self, access_token: str, phone_number_id: str, http: httpx.AsyncClient | None = None):
        self.phone_number_id = phone_number_id
        self._http = http or httpx.AsyncClient(timeout=30)
        self._auth = {"Authorization": f"Bearer {access_token}"}
        self._base = f"https://graph.facebook.com/{settings.meta_graph_version}"

    async def _json(self, response: httpx.Response) -> dict:
        data = response.json()
        if response.status_code >= 400 or "error" in data:
            raise RuntimeError(f"Meta API error: {(data.get('error') or {}).get('message') or response.text[:200]}")
        return data

    async def download_media(self, media_id: str) -> bytes:
        info = await self._json(await self._http.get(f"{self._base}/{media_id}", headers=self._auth))
        r = await self._http.get(info["url"], headers=self._auth)  # the media URL needs the token too
        r.raise_for_status()
        return r.content

    async def upload_media(self, ogg: bytes) -> str:
        data = await self._json(
            await self._http.post(
                f"{self._base}/{self.phone_number_id}/media",
                headers=self._auth,
                data={"messaging_product": "whatsapp", "type": "audio/ogg"},
                files={"file": ("reply.ogg", ogg, "audio/ogg")},
            )
        )
        return data["id"]

    async def _send(self, to: str, body: dict) -> dict:
        return await self._json(
            await self._http.post(
                f"{self._base}/{self.phone_number_id}/messages",
                headers=self._auth,
                json={"messaging_product": "whatsapp", "recipient_type": "individual", "to": to, **body},
            )
        )

    async def send_text(self, to: str, text: str) -> dict:
        return await self._send(to, {"type": "text", "text": {"preview_url": False, "body": text[:4000]}})

    async def send_voice_note(self, to: str, ogg: bytes) -> dict:
        media_id = await self.upload_media(ogg)
        return await self._send(to, {"type": "audio", "audio": {"id": media_id}})

    async def mark_read(self, wa_message_id: str) -> None:
        try:
            await self._http.post(
                f"{self._base}/{self.phone_number_id}/messages",
                headers=self._auth,
                json={"messaging_product": "whatsapp", "status": "read", "message_id": wa_message_id},
            )
        except httpx.HTTPError:
            pass  # a missing read receipt is not worth failing the reply


# ---- the reply ---------------------------------------------------------------------------------

def reply_model(agent: dict) -> str:
    model = agent.get("llm_model") or settings.sarvam_llm_backup_model
    # Sarvam-hosted models run on Sarvam's own API on calls; WhatsApp replies go through OpenRouter.
    return settings.sarvam_llm_backup_model if model.startswith("sarvam") else model


async def generate_reply(agent: dict, history: list[dict], user_text: str, http: httpx.AsyncClient | None = None) -> str:
    """history: [{'role': 'user'|'assistant', 'content': str}], oldest first."""
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    messages = [{"role": "system", "content": (agent.get("system_prompt") or "You are a helpful assistant.") + SYSTEM_SUFFIX}]
    messages += history[-HISTORY_TURNS:] + [{"role": "user", "content": user_text}]
    client = http or httpx.AsyncClient(timeout=30)
    r = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
        json={"model": reply_model(agent), "messages": messages, "max_tokens": 300},
    )
    r.raise_for_status()
    return (r.json()["choices"][0]["message"]["content"] or "").strip()


async def handle_message(store, msg: dict) -> None:
    """Answer one inbound message. Never raises: a failure is logged and the customer gets a short apology."""
    account = await store.find_whatsapp_account(msg["phone_number_id"])
    if not account or not account.get("enabled", True):
        logger.warning(f"WhatsApp: no enabled account for phone_number_id={msg['phone_number_id']}")
        return
    agent = account.get("agents")
    if not agent:
        logger.warning(f"WhatsApp: account {account['id']} has no agent")
        return

    # Meta retries a webhook it thinks failed; the unique message id makes that harmless.
    if not await store.add_whatsapp_message(account, msg["wa_message_id"], msg["from"], msg["name"], "inbound", msg["kind"], msg["text"]):
        return

    meta = Meta(account["access_token"], msg["phone_number_id"])
    language = agent.get("language") or "en-IN"
    try:
        await meta.mark_read(msg["wa_message_id"])
        text = msg["text"]
        if msg["kind"] == "audio":
            pcm = await to_pcm16k(await meta.download_media(msg["media_id"]))
            text = await transcribe(pcm, language)
            await store.set_whatsapp_content(msg["wa_message_id"], text)
        if not text:
            await meta.send_text(msg["from"], "Sorry, I couldn't make that out. Could you try again?")
            return

        history = await store.whatsapp_history(account["id"], msg["from"], before=msg["wa_message_id"])
        reply = await generate_reply(agent, history, text)
        if not reply:
            raise RuntimeError("the model returned no text")

        if msg["kind"] == "audio":  # a voice note gets a voice note back; text gets text
            try:
                ogg = await pcm_to_voice_note(await synthesize(reply, language, agent.get("tts_voice") if agent.get("tts_provider") == "gnani" else None))
                await meta.send_voice_note(msg["from"], ogg)
            except Exception as e:  # keep the customer served even if speech fails
                logger.error(f"WhatsApp voice reply failed, sending text: {e}")
                await meta.send_text(msg["from"], reply)
        else:
            await meta.send_text(msg["from"], reply)
        await store.add_whatsapp_message(account, None, msg["from"], msg["name"], "outbound", msg["kind"], reply)
    except Exception as e:
        logger.error(f"WhatsApp message {msg['wa_message_id']} failed: {e}")
        try:
            await meta.send_text(msg["from"], FALLBACK_TEXT)
        except Exception as e2:
            logger.error(f"WhatsApp fallback reply failed: {e2}")
