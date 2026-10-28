"""Time each provider from THIS machine, which is where calls actually run.

Latency measured from a laptop includes the laptop's own network, so it says little about a live
call. This sends one short request to every configured provider and reports how long the first
reply (LLM) or first audio (voice) takes, so providers can be compared fairly. Each probe costs a
few paise. Opened on demand from /debug/probe; never run during a call.
"""

import asyncio
import base64
import json
import time
import uuid

import httpx
import websockets

from .config import settings

LINE_TE = "అవును అండి, రేపు సాయంత్రం ఆరు గంటలకి చూద్దాం, మీ పేరు చెప్తారా?"
SYSTEM_TE = "You are a Telugu-speaking phone agent. Reply in one short Telugu sentence."
RUNS = 3


def _summary(values: list[float]) -> dict:
    if not values:
        return {"ok": False}
    values = sorted(values)
    return {"ok": True, "runs": len(values), "median_ms": round(values[len(values) // 2]), "worst_ms": round(values[-1])}


async def _llm_stream(url: str, headers: dict, body: dict) -> float:
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=20) as client:
        async with client.stream("POST", url, headers=headers, json={**body, "stream": True, "max_tokens": 60}) as r:
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if line.startswith("data:") and not line.endswith("[DONE]"):
                    choices = json.loads(line[5:]).get("choices") or []
                    if choices and (choices[0].get("delta") or {}).get("content"):
                        return (time.monotonic() - t0) * 1000
    raise RuntimeError("no text")


async def _llms() -> dict:
    out = {}
    msgs = [{"role": "system", "content": SYSTEM_TE}, {"role": "user", "content": "పార్కింగ్ ఉందా?"}]
    jobs = {}
    if settings.sarvam_api_key:
        jobs["sarvam-105b-conversations"] = ("https://api.sarvam.ai/v1/chat/completions", {"api-subscription-key": settings.sarvam_api_key},
                                             {"model": "sarvam-105b-conversations", "messages": msgs})
    if settings.openrouter_api_key:
        jobs["openrouter deepseek-v4.1-flash"] = ("https://openrouter.ai/api/v1/chat/completions", {"Authorization": f"Bearer {settings.openrouter_api_key}"},
                                                  {"model": "deepseek/deepseek-v4.1-flash", "messages": msgs, "reasoning": {"enabled": False}, "provider": {"sort": "latency"}})
    for name, (url, headers, body) in jobs.items():
        values, err = [], None
        for _ in range(RUNS):
            try:
                values.append(await _llm_stream(url, headers, body))
            except Exception as e:  # noqa: BLE001
                err = f"{type(e).__name__}: {e}"[:100]
        out[name] = {**_summary(values), **({"error": err} if err else {})}
    return out


async def _first_audio_ws(connect_url: str, headers: dict, hello: dict | None, request, is_audio) -> float:
    async with websockets.connect(connect_url, additional_headers=headers, max_size=None) as ws:
        if hello:
            await ws.send(json.dumps(hello))
        t0 = time.monotonic()
        await ws.send(json.dumps(request))
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 15))
            if is_audio(msg):
                return (time.monotonic() - t0) * 1000
            if msg.get("type") == "error" or msg.get("status") == "error":
                raise RuntimeError(str(msg)[:80])


async def _voices() -> dict:
    out = {}
    probes = {}
    if settings.sarvam_api_key:
        for model, speaker in (("bulbul:v3", "pooja"), ("bulbul:v4-flash", "pooja_te_conversation")):
            probes[f"sarvam {model}"] = (
                f"wss://api.sarvam.ai/text-to-speech/ws?model={model}", {"api-subscription-key": settings.sarvam_api_key},
                {"type": "config", "data": {"target_language_code": "te-IN", "speaker": speaker, "speech_sample_rate": 8000, "model": model, "output_audio_codec": "linear16"}},
                lambda: {"type": "text", "data": {"text": LINE_TE}}, lambda m: m.get("type") == "audio")
    if settings.smallest_api_key:
        probes["smallest lightning_v3.1_pro"] = (
            "wss://api.smallest.ai/waves/v1/tts/live", {"Authorization": f"Bearer {settings.smallest_api_key}"}, None,
            lambda: {"text": LINE_TE, "voice_id": "zariya", "model": "lightning_v3.1_pro", "language": "te", "sample_rate": 8000, "context_id": uuid.uuid4().hex, "continue": False, "output_format": "pcm"},
            lambda m: m.get("status") == "chunk")
    if settings.gnani_api_key:
        probes["gnani timbre-v3.0"] = (
            "wss://api.vachana.ai/api/v1/tts", {"X-API-Key-ID": settings.gnani_api_key}, None,
            lambda: {"text": LINE_TE, "voice": "Lakshmi", "model": "timbre-v3.0", "language": "te-IN", "audio_config": {"sample_rate": 8000, "num_channels": 1, "sample_width": 2, "encoding": "linear_pcm", "container": "raw"}},
            lambda m: m.get("type") == "audio" and bool((m.get("data") or {}).get("audio")))
    for name, (url, headers, hello, make_request, is_audio) in probes.items():
        values, err = [], None
        for _ in range(RUNS):
            try:
                request = make_request()
                if name.startswith("sarvam"):
                    # Sarvam wants text then a flush; the helper sends one message, so do both here.
                    async with websockets.connect(url, additional_headers=headers, max_size=None) as ws:
                        await ws.send(json.dumps(hello))
                        t0 = time.monotonic()
                        await ws.send(json.dumps(request))
                        await ws.send(json.dumps({"type": "flush"}))
                        while True:
                            msg = json.loads(await asyncio.wait_for(ws.recv(), 15))
                            if is_audio(msg):
                                values.append((time.monotonic() - t0) * 1000)
                                break
                            if msg.get("type") == "error":
                                raise RuntimeError(str(msg)[:80])
                else:
                    values.append(await _first_audio_ws(url, headers, hello, request, is_audio))
            except Exception as e:  # noqa: BLE001
                err = f"{type(e).__name__}: {e}"[:100]
        out[name] = {**_summary(values), **({"error": err} if err else {})}
    return out


async def run() -> dict:
    llms, voices = await asyncio.gather(_llms(), _voices())
    return {"note": "first reply / first audio, measured on the worker's own server; a connection is opened for every run", "llm_first_text_ms": llms, "voice_first_audio_ms": voices}
