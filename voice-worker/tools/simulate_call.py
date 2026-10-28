"""Play a whole phone call, start to hangup, through a real local worker, for any business scenario.

    cd voice-worker
    uv run python tools/simulate_call.py --list
    uv run python tools/simulate_call.py restaurant_en
    uv run python tools/simulate_call.py all --interrupt
    uv run python tools/simulate_call.py gym_en --tts smallest:zariya --llm sarvam-105b-conversations

What is real: the worker (STT, LLM, TTS, turn taking, hangup, cost, outcome), the VoiceLink WebSocket
protocol, the database writes. What is simulated: the person. An LLM plays the caller from the
scenario's persona, and Sarvam speaks its lines as telephone audio.

It creates a throwaway organisation, agent and call row, runs the worker on a spare port, and deletes
the organisation afterwards. A run costs roughly 1 to 3 rupees of provider credit per call. Needs the
web app's .env.local (Supabase) and the worker's .env (provider keys).
"""

import argparse
import asyncio
import audioop
import base64
import json
import os
import re
import statistics
import subprocess
import sys
import time
import wave
from pathlib import Path

import httpx
import websockets

ROOT = Path(__file__).resolve().parents[2]
WORKER_DIR = ROOT / "voice-worker"
sys.path.insert(0, str(WORKER_DIR))
sys.path.insert(0, str(Path(__file__).parent))

from scenarios import SCENARIOS  # noqa: E402
from worker.config import settings  # noqa: E402

TEMPLATE_AGENT = "b25df6ab-0721-4196-ae05-2a0c9243338f"  # supplies voice, LLM and STT defaults
ORG_NAME = "SimCall Test Org"
SCRIPT_RANGES = {"te-IN": r"[ఀ-౿]", "hi-IN": r"[ऀ-ॿ]", "en-IN": r"[A-Za-z]"}
# Voices used for the agent when the scenario's language is not the template agent's own.
DEFAULT_VOICE = {"en-IN": ("sarvam", "priya", "bulbul:v3"), "hi-IN": ("sarvam", "priya", "bulbul:v3")}


def env_file(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


WEB = env_file(ROOT / "web" / ".env.local")
SUPA, SUPA_KEY = WEB["NEXT_PUBLIC_SUPABASE_URL"], WEB["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}


def rest(path: str, method: str = "GET", body=None):
    r = httpx.request(method, f"{SUPA}/rest/v1/{path}", headers=HEADERS, json=body, timeout=30)
    if r.status_code >= 300:
        raise RuntimeError(f"{method} {path}: {r.status_code} {r.text[:200]}")
    return r.json() if r.text else None


def caller_say(text: str, lang: str, speaker: str) -> bytes:
    for attempt in range(4):
        r = httpx.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": settings.sarvam_api_key},
            json={"text": text, "target_language_code": lang, "model": "bulbul:v3", "speaker": speaker, "speech_sample_rate": 8000, "output_audio_codec": "alaw"},
            timeout=60,
        )
        j = r.json()
        if "audios" in j:
            return base64.b64decode(j["audios"][0])
        time.sleep(3 * (attempt + 1))
    raise RuntimeError("the simulated caller's voice (Sarvam TTS) is unavailable")


def caller_think(persona: str, language: str, business: str, history: list[tuple[str, str]], last_turn: bool) -> str:
    """The caller's next line, from their persona and what the agent just said."""
    system = (
        persona + f" You are on a phone call with {business}. Reply with only what you say out loud, one or two "
        "short sentences, no quotes, no stage directions. Do not repeat information you already gave. "
        f"Language: {language}. "
        + ("This is your last line: say a short goodbye. " if last_turn else "When your questions are answered and the plan is settled, say a short goodbye as your line. ")
    )
    messages = [{"role": "system", "content": system}]
    for who, text in history:
        messages.append({"role": "user" if who == "agent" else "assistant", "content": text})
    r = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
        json={"model": "deepseek/deepseek-v4.1-flash", "messages": messages, "max_tokens": 90, "reasoning": {"enabled": False}, "provider": {"sort": "latency"}},
        timeout=60,
    ).json()
    return r["choices"][0]["message"]["content"].strip().strip('"')


def build_agent(scn: dict, org: str, args) -> dict:
    src = rest(f"agents?id=eq.{TEMPLATE_AGENT}&select=*")[0]
    for k in ("id", "created_at", "updated_at"):
        src.pop(k, None)
    cfg = {k: v for k, v in (src.get("config") or {}).items() if k.startswith("tts_")}
    lang = scn["language"]
    if lang != src.get("language"):
        provider, voice, model = DEFAULT_VOICE[lang]
        cfg = {"tts_model": model}
        src.update(tts_provider=provider, tts_voice=voice)
    if args.tts:
        provider, voice = args.tts.split(":", 1)
        src.update(tts_provider=provider, tts_voice=voice)
        cfg = {"tts_model": "lightning_v3.1_pro"} if provider == "smallest" else {k: v for k, v in cfg.items() if k != "tts_model"}
    if args.llm:
        src["llm_model"] = args.llm
    cfg["outbound_first_message"] = scn["greeting"]
    src.update(org_id=org, name=scn["agent_name"], system_prompt=scn["prompt"], language=lang, first_message=scn["greeting"], config=cfg)
    return rest("agents", "POST", src)[0]


async def run_call(scn: dict, port: int, org: str, agent: dict, args) -> dict:
    row = rest("calls", "POST", {"org_id": org, "agent_id": agent["id"], "direction": "outbound", "status": "initiated", "from_number": "919000000055", "to_number": "9876543210", "metadata": {"kind": "callback"}})[0]["id"]
    out_log = Path(args.out) / f"{args.stamp}_{scn['key']}.worker.log"
    srv = subprocess.Popen(
        ["uv", "run", "uvicorn", "main:app", "--port", str(port), "--no-access-log"],
        cwd=WORKER_DIR, stdout=open(out_log, "w"), stderr=subprocess.STDOUT,
        env={**os.environ, "SUPABASE_URL": SUPA, "SUPABASE_SERVICE_ROLE_KEY": SUPA_KEY, "NUDGE_SECS": "30", "SILENCE_HANGUP_SECS": "40"},
    )
    frames: list[tuple[float, bytes]] = []
    transcript: list[tuple[str, str]] = []
    timeline: list[tuple[float, str, str]] = []
    result = {"closed_by_worker": False, "turns": 0, "caller_last_line_at": None, "closed_at": None}
    try:
        for _ in range(60):
            try:
                if httpx.get(f"http://127.0.0.1:{port}/healthz", timeout=2).status_code == 200:
                    break
            except Exception:  # noqa: BLE001
                time.sleep(1)
        lang = scn["language"]
        voice_lang, speaker = scn["caller_voice"]
        t0 = time.time()
        sid = f"sim-{port}-{int(t0)}"
        box = bytearray()
        last_out = [0.0]
        done = asyncio.Event()

        def events() -> list[dict]:
            try:
                return httpx.get(f"http://127.0.0.1:{port}/debug/events", params={"token": settings.ws_token, "limit": 400}, timeout=5).json()
            except Exception:  # noqa: BLE001
                return []

        async with websockets.connect(f"ws://127.0.0.1:{port}/ws?token={settings.ws_token}", max_size=None) as ws:
            await ws.send(json.dumps({"event": "start", "stream_sid": sid, "start": {"stream_sid": sid, "call_sid": sid, "from": "+910000000001", "to": "+910000000002",
                                    "custom_parameters": {"call_row_id": row, "org_id": org, "agent_id": agent["id"], "kind": "callback"}, "media_format": {"encoding": "audio/alaw", "sample_rate": "8000"}}}))

            async def feed():
                t = time.monotonic()
                while True:
                    c = bytes(box[:160]); del box[:160]; c += b"\xd5" * (160 - len(c))
                    await ws.send(json.dumps({"event": "media", "streamSid": sid, "media": {"track": "inbound", "payload": base64.b64encode(c).decode()}}))
                    t += 0.02
                    await asyncio.sleep(max(0, t - time.monotonic()))

            async def read():
                try:
                    async for m in ws:
                        d = json.loads(m)
                        if d.get("event") == "media":
                            frames.append((time.time() - t0, base64.b64decode(d["media"]["payload"])))
                            last_out[0] = time.time()
                except Exception:  # noqa: BLE001
                    pass
                result["closed_by_worker"] = True
                result["closed_at"] = time.time() - t0
                done.set()

            feeder, reader = asyncio.create_task(feed()), asyncio.create_task(read())

            def speak(line: str):
                audio = caller_say(line, voice_lang, speaker)
                box.extend(audio)
                transcript.append(("caller", line))
                timeline.append((time.time() - t0, "caller", line))
                return len(audio) / 8000  # seconds of speech

            async def agent_reply(interrupt_after: float | None) -> bool:
                """Wait for the agent to answer. Returns False if it never did or the call ended."""
                before = len(frames)
                deadline = time.time() + 25
                while len(frames) == before and not done.is_set() and time.time() < deadline:
                    await asyncio.sleep(0.1)
                if len(frames) == before:
                    return False
                if interrupt_after is not None:
                    await asyncio.sleep(interrupt_after)
                    return True
                while time.time() - last_out[0] < 1.4 and not done.is_set():
                    await asyncio.sleep(0.1)
                return True

            n_seen = [0]

            def new_agent_text() -> str:
                """What the agent has finished saying since the last look (spoken lines are logged as they end)."""
                texts = [e["text"] for e in events() if e["kind"] == "call.agent_said" and e.get("text")]
                fresh = texts[n_seen[0]:]
                n_seen[0] = len(texts)
                return " ".join(fresh)

            await asyncio.sleep(0.8)
            speak(scn["hello"])
            interrupted = False
            for turn in range(1, args.max_turns + 1):
                if not await agent_reply(None):
                    break
                result["turns"] = turn
                await asyncio.sleep(0.4)  # the agent's text is logged as it finishes speaking
                text = new_agent_text()
                if text:
                    transcript.append(("agent", text))
                    timeline.append((time.time() - t0, "agent", text))
                if done.is_set() or any(e["kind"] == "call.end_requested" for e in events()):
                    break
                last = turn == args.max_turns
                line = await asyncio.to_thread(caller_think, scn["caller"], lang, scn["agent_name"], list(transcript), last)
                if args.interrupt and turn == 3 and not interrupted:
                    interrupted = True
                    speak(line)  # talk over the agent: she has just started the next reply
                    timeline.append((time.time() - t0, "note", "caller interrupted"))
                else:
                    speak(line)
                if re.search(r"\b(bye|goodbye)\b|बाय|अलविदा|బై|ధన్యవాదాలు", line, re.I):
                    result["caller_last_line_at"] = time.time() - t0
                    break
            if result["caller_last_line_at"] is None and not done.is_set():
                result["caller_last_line_at"] = time.time() - t0
            # let the agent say its last words and hang up
            try:
                await asyncio.wait_for(done.wait(), timeout=args.hangup_wait)
            except asyncio.TimeoutError:
                pass
            if not done.is_set():
                while time.time() - last_out[0] < 2.0 and time.time() - t0 < 600:
                    await asyncio.sleep(0.2)
            feeder.cancel(); reader.cancel()
        # the cost line and the outcome summary are written after the call
        await asyncio.sleep(args.settle)
        evs = events()
        closing = [e["text"] for e in evs if e["kind"] == "call.agent_said" and e.get("text")][n_seen[0]:]
        for text in closing:
            transcript.append(("agent", text))
            timeline.append((result["closed_at"] or time.time() - t0, "agent", text))
        result["events"] = evs
        result["db"] = rest(f"calls?id=eq.{row}&select=metadata,status,duration_seconds")[0]
        result["transcript"] = transcript
        result["timeline"] = timeline
        result["frames"] = frames
    finally:
        srv.terminate()
        try:
            srv.wait(10)
        except subprocess.TimeoutExpired:
            srv.kill()
    return result


def write_wav(frames: list[tuple[float, bytes]], path: Path) -> None:
    """The agent's side of the call as heard on the phone, with the real gaps between replies."""
    pcm = bytearray()
    for t, alaw in frames:
        want = int(t * 8000) * 2
        if want > len(pcm):
            pcm.extend(b"\x00" * (want - len(pcm)))
        pcm.extend(audioop.alaw2lin(alaw, 2))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(bytes(pcm))


def judge(scn: dict, res: dict) -> list[tuple[bool, str]]:
    evs = res["events"]
    kinds = [e["kind"] for e in evs]
    checks = []
    agent_lines = [t for who, t in res["transcript"] if who == "agent"]
    lat = [e["turn_end_to_audio_ms"] for e in evs if e["kind"] == "latency" and "turn_end_to_audio_ms" in e]
    checks.append((res["turns"] >= 3, f"real conversation: {res['turns']} agent replies"))
    checks.append(("call.end_requested" in kinds, "the agent hung up by itself (end_call)"))
    checks.append((res["closed_by_worker"], "the worker closed the call"))
    if res["closed_at"] and res["frames"]:
        gap = res["closed_at"] - res["frames"][-1][0]
        checks.append((gap < 8, f"hung up {gap:.1f}s after the agent's last word"))
    checks.append((not [k for k in kinds if k in ("call.error", "tts.failover", "llm.failover", "voice.provider_unavailable")], "no errors or failovers"))
    checks.append(("call.silence_hangup" not in kinds, "did not end on silence"))
    if lat:
        checks.append((max(lat) < 2500, f"latency after the caller stops: median {statistics.median(lat):.0f} ms, worst {max(lat):.0f} ms"))
    pat = re.compile(SCRIPT_RANGES[scn["language"]])
    letters = [c for line in agent_lines for c in line if c.isalpha()]
    share = sum(1 for c in letters if pat.match(c)) / max(len(letters), 1)
    checks.append((share > 0.8, f"agent spoke in the right script ({share:.0%} {scn['language']})"))
    checks.append((not [k for k in kinds if k == "llm.stray_script_removed"], "no wrong-script text filtered out"))
    repeats = len(agent_lines) - len({line.strip() for line in agent_lines})
    checks.append((repeats == 0, "no identical reply repeated"))
    cost = next((e for e in evs if e["kind"] == "call.cost"), None)
    checks.append((bool(cost and cost.get("complete")), f"cost recorded: {cost['total_inr']:.2f} INR" if cost else "cost recorded"))
    outcome = (res["db"].get("metadata") or {}).get("outcome")
    checks.append((bool(outcome and outcome.get("summary")), "outcome summary extracted"))
    return checks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", nargs="?", help="scenario name, or 'all'")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--port", type=int, default=8801)
    ap.add_argument("--interrupt", action="store_true", help="the caller talks over the agent once, on the third turn")
    ap.add_argument("--tts", help="override the agent's voice, e.g. smallest:zariya or sarvam:pooja")
    ap.add_argument("--llm", help="override the agent's model, e.g. sarvam-105b-conversations")
    ap.add_argument("--max-turns", type=int, default=12)
    ap.add_argument("--hangup-wait", type=float, default=18.0)
    ap.add_argument("--settle", type=float, default=9.0)
    ap.add_argument("--out", default="sim_out")
    args = ap.parse_args()
    if args.list or not args.scenario:
        for k, v in SCENARIOS.items():
            print(f"{k:16s} {v['title']}")
        return
    names = list(SCENARIOS) if args.scenario == "all" else [args.scenario]
    for n in names:
        if n not in SCENARIOS:
            sys.exit(f"unknown scenario {n!r}; try --list")
    Path(args.out).mkdir(exist_ok=True)
    args.stamp = time.strftime("%Y%m%d-%H%M%S")
    # an earlier run that was killed may have left its throwaway organisation behind
    rest(f"organizations?name=eq.{ORG_NAME.replace(' ', '%20')}", "DELETE")
    summary = []
    for i, name in enumerate(names):
        scn = {**SCENARIOS[name], "key": name}
        org = rest("organizations", "POST", {"name": ORG_NAME})[0]["id"]
        print(f"\n=== {name}: {scn['title']}", flush=True)
        try:
            agent = build_agent(scn, org, args)
            print(f"agent voice {agent['tts_provider']}:{agent['tts_voice']}  model {agent['llm_model']}  language {agent['language']}", flush=True)
            res = asyncio.run(run_call(scn, args.port + i, org, agent, args))
        finally:
            rest(f"organizations?id=eq.{org}", "DELETE")
        for t, who, text in res["timeline"]:
            print(f"  {t:5.1f}s {who:7s} {text}")
        checks = judge(scn, res)
        for ok, what in checks:
            print(f"  [{'PASS' if ok else 'FAIL'}] {what}")
        wav = Path(args.out) / f"{args.stamp}_{name}.agent.wav"
        write_wav(res["frames"], wav)
        (Path(args.out) / f"{args.stamp}_{name}.json").write_text(json.dumps({k: v for k, v in res.items() if k != "frames"}, ensure_ascii=False, indent=1, default=str))
        print(f"  agent audio: {wav}")
        outcome = ((res["db"].get("metadata") or {}).get("outcome") or {})
        if outcome:
            print(f"  outcome: {outcome.get('outcome')} | {outcome.get('summary')}")
        summary.append((name, sum(ok for ok, _ in checks), len(checks)))
    print("\nSUMMARY")
    for name, ok, total in summary:
        print(f"  {name:16s} {ok}/{total} checks passed")


if __name__ == "__main__":
    main()
