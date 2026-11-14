"""Lay out the demo video: which screenshot is on screen while which audio plays.

Writes mix.wav (narration + scenario calls on one timeline) and schedule.json (what to show when).
    python3 plan.py <frames_dir_with_names> <narration_dir> <calls_dir> <out_dir>
"""
import json, sys, wave
from pathlib import Path

RATE = 16000
GAP = 0.3
frames_dir, narr_dir, calls_dir, out = map(Path, sys.argv[1:5])
out.mkdir(parents=True, exist_ok=True)
narr = {s["name"]: s for s in json.loads((narr_dir / "segments.json").read_text())}

def pcm(path, start=0.0, end=None):
    with wave.open(str(path)) as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1
        w.setpos(int(start * RATE))
        n = w.getnframes() - int(start * RATE) if end is None else int((end - start) * RATE)
        return w.readframes(n)

audio = bytearray()
schedule = []

def add(frame_names, wav, caption, start=0.0, end=None):
    data = pcm(wav, start, end)
    dur = len(data) / 2 / RATE
    t0 = len(audio) / 2 / RATE
    audio.extend(data)
    audio.extend(b"\x00\x00" * int(RATE * GAP))
    dur += GAP
    per = dur / len(frame_names)
    for i, f in enumerate(frame_names):
        schedule.append({"image": str(frames_dir / f), "start": round(t0 + i * per, 3), "end": round(t0 + (i + 1) * per, 3), "caption": caption})

def say(name, frames):
    add(frames, narr_dir / f"{name}.wav", narr[name]["text"])

say("intro", ["hero.jpg"])
say("demo", ["demo.jpg"])
add(["emi1.jpg", "emi2.jpg", "emi3.jpg"], calls_dir / "emi-hi.wav", "Hindi EMI reminder call. Both voices by Gnani Timbre v3.", 0, 26.3)
say("demo2", ["tel1.jpg"])
add(["tel1.jpg"], calls_dir / "realty-te.wav", "Telugu site-visit booking call. Both voices by Gnani Timbre v3.", 0, 14.8)
say("overview", ["overview.jpg"])
say("agents", ["agentnew.jpg"])
say("voice", ["voice.jpg"])
say("numbers", ["numbers.jpg"])
say("voices", ["voices.jpg"])
say("calls", ["calls.jpg"])
say("wallet", ["wallet.jpg"])
say("tech", ["how.jpg", "stack.jpg"])
say("outro", ["hero.jpg"])

with wave.open(str(out / "mix.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(audio))
(out / "schedule.json").write_text(json.dumps(schedule, indent=1, ensure_ascii=False))
print(f"{len(audio)/2/RATE:.1f}s, {len(schedule)} shots")
