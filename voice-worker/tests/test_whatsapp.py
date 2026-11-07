"""WhatsApp: signature check, payload parsing, Gnani STT/TTS framing against fake local servers,
and the full text / voice-note reply flow with a fake store and fake Meta + LLM.
Run: .venv/bin/python tests/test_whatsapp.py   (no network; the voice-note case needs ffmpeg)"""
import asyncio, base64, hashlib, hmac, json, os, shutil, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import websockets
from worker import whatsapp
from worker.config import settings

settings.gnani_api_key = "k"


def payload(msg, name="Asha"):
    return {"object": "whatsapp_business_account", "entry": [{"id": "w", "changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": "P1"}, "contacts": [{"wa_id": "919999", "profile": {"name": name}}], "messages": [msg]}}]}]}


def test_signature_and_parsing():
    body = b'{"a":1}'
    good = "sha256=" + hmac.new(b"s", body, hashlib.sha256).hexdigest()
    assert whatsapp.verify_signature(body, good, "s")
    assert not whatsapp.verify_signature(body, good, "other")
    assert not whatsapp.verify_signature(body, None, "s")
    assert not whatsapp.verify_signature(body, good, "")  # no secret configured: refuse, never trust
    t = whatsapp.parse_inbound(payload({"id": "m1", "from": "919999", "type": "text", "text": {"body": " hi "}}))
    assert t == [{"phone_number_id": "P1", "wa_message_id": "m1", "from": "919999", "name": "Asha", "kind": "text", "text": "hi", "media_id": None}]
    a = whatsapp.parse_inbound(payload({"id": "m2", "from": "919999", "type": "audio", "audio": {"id": "MED"}}))
    assert a[0]["kind"] == "audio" and a[0]["media_id"] == "MED"
    b = whatsapp.parse_inbound(payload({"id": "m3", "from": "919999", "type": "interactive", "interactive": {"button_reply": {"title": "Yes"}}}))
    assert b[0]["kind"] == "text" and b[0]["text"] == "Yes"
    assert whatsapp.parse_inbound(payload({"id": "m4", "from": "919999", "type": "image"})) == []
    assert whatsapp.parse_inbound({"object": "instagram"}) == []
    status = {"object": "whatsapp_business_account", "entry": [{"changes": [{"field": "messages", "value": {"statuses": [{}]}}]}]}
    assert whatsapp.parse_inbound(status) == []


async def test_gnani_sockets():
    seen = {"hdr": None, "sizes": []}

    async def stt(ws):
        seen["hdr"] = dict(ws.request.headers)
        async for m in ws:
            seen["sizes"].append(len(m))
            if len(seen["sizes"]) == 3:
                await ws.send(json.dumps({"type": "transcript", "text": " namaste "}))
                await ws.send(json.dumps({"type": "transcript", "text": "doctor"}))

    async def tts(ws):
        req = json.loads(await ws.recv())
        seen["tts"] = req
        for chunk in (b"\x01\x00" * 10, b"\x02\x00" * 10):
            await ws.send(json.dumps({"type": "audio", "data": {"audio": base64.b64encode(chunk).decode()}}))
        await ws.send(json.dumps({"type": "complete", "data": {"audio": ""}}))
        await ws.send(json.dumps({"type": "complete", "message": "Streaming completed"}))

    async with websockets.serve(stt, "127.0.0.1", 0) as s1, websockets.serve(tts, "127.0.0.1", 0) as s2:
        text = await whatsapp.transcribe(b"\x01\x00" * 3000, "hi-IN", url=f"ws://127.0.0.1:{s1.sockets[0].getsockname()[1]}")
        assert text == "namaste doctor", text
        assert set(seen["sizes"]) == {1024}, "Gnani rejects any frame size but 1,024 bytes"
        assert seen["hdr"]["language_code"] == "hi-IN" and seen["hdr"]["x-api-key-id"] == "k"
        pcm = await whatsapp.synthesize("  hello   there ", "xx-YY", url=f"ws://127.0.0.1:{s2.sockets[0].getsockname()[1]}")
        assert len(pcm) == 40
        assert seen["tts"]["text"] == "hello there" and seen["tts"]["language"] == "auto"


class FakeStore:
    def __init__(self):
        self.msgs, self.seen = [], set()

    async def find_whatsapp_account(self, pid):
        return {"id": "A", "org_id": "O", "enabled": True, "access_token": "T", "agents": {"language": "en-IN", "system_prompt": "be nice", "llm_model": "x/y"}}

    async def add_whatsapp_message(self, account, wid, num, name, direction, kind, content):
        if wid and wid in self.seen:
            return False
        self.seen.add(wid)
        self.msgs.append((direction, kind, content))
        return True

    async def set_whatsapp_content(self, wid, content):
        self.msgs.append(("transcript", "audio", content))

    async def whatsapp_history(self, *a, **k):
        return []


class FakeMeta:
    sent = []

    def __init__(self, *a): pass
    async def mark_read(self, _): pass
    async def send_text(self, to, text): FakeMeta.sent.append(("text", text))
    async def send_voice_note(self, to, ogg): FakeMeta.sent.append(("voice", len(ogg)))
    async def download_media(self, _): return b"ogg"


async def test_flow():
    whatsapp.Meta = FakeMeta
    whatsapp.generate_reply = lambda agent, history, text, http=None: _reply(text)
    store = FakeStore()
    msg = {"phone_number_id": "P1", "wa_message_id": "m1", "from": "9", "name": "A", "kind": "text", "text": "price?", "media_id": None}
    await whatsapp.handle_message(store, msg)
    await whatsapp.handle_message(store, msg)  # Meta retry: must not answer twice
    assert FakeMeta.sent == [("text", "echo: price?")], FakeMeta.sent
    assert store.msgs == [("inbound", "text", "price?"), ("outbound", "text", "echo: price?")]

    # voice note: speech steps stubbed so only the orchestration is tested here
    FakeMeta.sent.clear()
    async def pcm(_): return b"pcm"
    async def stt(_p, _l): return "kitna hai"
    async def tts(_t, _l, _v=None): return b"\x00\x00" * 24000
    whatsapp.to_pcm16k, whatsapp.transcribe, whatsapp.synthesize = pcm, stt, tts
    if shutil.which("ffmpeg"):
        v = {**msg, "wa_message_id": "m2", "kind": "audio", "text": "", "media_id": "MED"}
        await whatsapp.handle_message(store, v)
        assert FakeMeta.sent and FakeMeta.sent[0][0] == "voice" and FakeMeta.sent[0][1] > 100, FakeMeta.sent
        assert ("transcript", "audio", "kitna hai") in store.msgs
    else:
        print("ffmpeg not installed: skipped the voice-note flow")

    # a failing model gets the customer a short apology, not silence or a stack trace
    FakeMeta.sent.clear()
    async def boom(*a, **k): raise RuntimeError("model down")
    whatsapp.generate_reply = boom
    await whatsapp.handle_message(store, {**msg, "wa_message_id": "m3"})
    assert FakeMeta.sent == [("text", whatsapp.FALLBACK_TEXT)]


async def _reply(text): return "echo: " + text


async def test_ffmpeg_roundtrip():
    if not shutil.which("ffmpeg"):
        print("ffmpeg not installed: skipped the conversion round trip"); return
    import math, struct
    tone = b"".join(struct.pack("<h", int(8000 * math.sin(i / 8))) for i in range(24000))
    ogg = await whatsapp.pcm_to_voice_note(tone)
    assert ogg[:4] == b"OggS"
    back = await whatsapp.to_pcm16k(ogg)
    assert 28000 < len(back) < 36000  # ~1 s at 16 kHz mono 16-bit


test_signature_and_parsing()
asyncio.run(test_gnani_sockets())
asyncio.run(test_flow())
asyncio.run(test_ffmpeg_roundtrip())
print("whatsapp tests passed")
