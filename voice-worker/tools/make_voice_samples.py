"""Render a short phone-quality sample of every voice we offer, and measure each one.

Run from voice-worker/ (macOS: uses `afconvert`):  uv run python tools/make_voice_samples.py

For every provider voice and language it asks the provider for a sample greeting, converts it to
8 kHz (what a phone line carries), levels the volume so no voice wins by being loud, checks it by
transcribing it back (clarity), estimates the pitch (to label female/male by measurement, not by
name) and stores a small .m4a. A voice that fails, or that cannot be understood, is left out.

Writes web/public/voices/<provider>/<language>/<voice>.m4a and the catalog the dashboard reads:
web/lib/voice-catalog.json.
"""

import audioop
import base64
import concurrent.futures as cf
import difflib
import io
import json
import re
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import httpx
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "voice-worker"))
from worker.config import settings  # noqa: E402

OUT_DIR = ROOT / "web" / "public" / "voices"
LANGS = ["te-IN", "en-IN", "hi-IN"]
TEXT = {
    "en-IN": "Hi, this is Kumudha from Sunrise Dental. You asked for a callback, so I'm calling. Do you have two minutes to talk?",
    "hi-IN": "नमस्ते! मैं कुमुदा बोल रही हूँ, सनराइज़ डेंटल से। आपने कॉलबैक माँगा था, इसीलिए फ़ोन किया। क्या अभी दो मिनट बात कर सकते हैं?",
    "te-IN": "నమస్కారం! నేను కుముద, సన్‌రైజ్ డెంటల్ నుంచి. మీరు కాల్‌బ్యాక్ అడిగారు కదా, అందుకే కాల్ చేశా. ఇప్పుడు రెండు నిమిషాలు మాట్లాడొచ్చా?",
}
RUMIK_DESC = {
    "en-IN": "A warm, friendly, confident young woman speaking natural Indian English at a brisk, easy pace.",
    "hi-IN": "A warm, friendly, confident young woman speaking natural conversational Hindi at a brisk, easy pace.",
}
SARVAM_V3 = ["aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran", "kavya", "amit", "dev", "ishita",
             "shreya", "ratan", "varun", "manan", "sumit", "roopa", "kabir", "aayan", "shubh", "ashutosh", "advait", "amelia", "sophia"]
RUMIK = ["emma", "mia", "sophia", "ava", "ira", "siya", "aisha", "zoya", "lucas", "noah", "theo", "adam"]
ELEVEN = {  # premade voices; whichever this account can use are kept
    "EXAVITQu4vr4xnSDxMaL": "Sarah", "XrExE9yKIg1WjnnlVkGX": "Matilda", "Xb7hH8MSUJpSbSDYk0k2": "Alice",
    "21m00Tcm4TlvDq8ikWAM": "Rachel", "AZnzlk1XvdvUeBnXmlld": "Domi", "MF3mGyEYCl7XYWbV9V6O": "Elli",
    "TxGEqnHWrfWFTfGW9XjX": "Josh", "ErXwobaYiN019PkySvjV": "Antoni", "pNInz6obpgDQGcFmaJgB": "Adam",
    "XB0fDUnXU5powFXDhCwa": "Charlotte", "pFZP5JQG7iQjIQuC4Bku": "Lily", "cgSgspJ2msm6clMCkdW9": "Jessica",
    "JBFqnCBsd6RMkjVDRZzb": "George", "onwK4e9ZLuTAKqWW03F9": "Daniel", "nPczCjzI2devNBz1zQrb": "Brian",
    "FGY2WhTYpPnrIDTdsKH5": "Laura", "iP95p4xoKVk53GoZ742B": "Chris", "cjVigY5qzO86Huf0OWal": "Eric",
    "CwhRBWXzGAHq8TQ4Fs17": "Roger", "SAz9YHcvj6GT2YYXdXww": "River",
}


def retry(fn, tries=4):
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def to_pcm8k(path: Path) -> np.ndarray:
    """Any audio file -> mono 16-bit samples at 8 kHz."""
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "x.wav"
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@8000", "-c", "1", str(path), str(wav)], check=True, capture_output=True)
        with wave.open(str(wav)) as w:
            return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).copy()


# ---- providers -------------------------------------------------------------------------------

def sarvam(voice: str, lang: str, model: str = "bulbul:v3") -> bytes:
    def go():
        r = httpx.post("https://api.sarvam.ai/text-to-speech", headers={"api-subscription-key": settings.sarvam_api_key},
                       json={"text": TEXT[lang], "target_language_code": lang, "model": model, "speaker": voice, "speech_sample_rate": 8000}, timeout=60)
        j = r.json()
        if "audios" not in j:
            raise RuntimeError(f"sarvam {r.status_code}: {str(j)[:120]}")
        return base64.b64decode(j["audios"][0])
    return retry(go)


def eleven(voice: str, lang: str) -> bytes:
    def go():
        r = httpx.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_22050_32", headers={"xi-api-key": settings.elevenlabs_api_key},
                       json={"text": TEXT[lang], "model_id": "eleven_flash_v2_5", "language_code": lang[:2]}, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"elevenlabs {r.status_code}: {r.text[:120]}")
        return r.content
    return retry(go)


def rumik(voice: str, lang: str) -> bytes:
    def go():
        r = httpx.post("https://silk-api.rumik.ai/v1/tts", headers={"Authorization": f"Bearer {settings.rumik_api_key}"},
                       json={"model": "mulberry", "text": TEXT[lang], "speaker": voice, "description": RUMIK_DESC[lang], "audio_format": "alaw"}, timeout=90)
        if r.status_code != 200:
            raise RuntimeError(f"rumik {r.status_code}: {r.text[:120]}")
        return r.content
    return retry(go)


# ---- measurement -----------------------------------------------------------------------------

def clarity(pcm: np.ndarray, lang: str) -> float:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(pcm.tobytes())

    def go():
        r = httpx.post("https://api.sarvam.ai/speech-to-text", headers={"api-subscription-key": settings.sarvam_api_key},
                       files={"file": ("a.wav", buf.getvalue(), "audio/wav")}, data={"model": "saarika:v2.5", "language_code": lang}, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"stt {r.status_code}")
        return r.json().get("transcript", "")
    heard = retry(go)
    pat = {"en-IN": r"[^a-z ]", "hi-IN": r"[^ऀ-ॿ ]", "te-IN": r"[^ఀ-౿ ]"}[lang]
    norm = lambda t: re.sub(pat, "", t.lower() if lang == "en-IN" else t)  # noqa: E731
    return difflib.SequenceMatcher(None, norm(heard), norm(TEXT[lang])).ratio()


def pitch_hz(pcm: np.ndarray) -> float:
    """Median fundamental frequency over voiced 40 ms frames (autocorrelation). Female voices sit well above male ones."""
    x = pcm.astype(np.float64)
    n, hop = 320, 160
    f0 = []
    for k in range(0, len(x) - n, hop):
        f = x[k:k + n] - x[k:k + n].mean()
        if np.sqrt((f ** 2).mean()) < 400:
            continue
        ac = np.correlate(f, f, "full")[n - 1:]
        lo, hi = 8000 // 400, 8000 // 70
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.35 * ac[0]:
            f0.append(8000 / lag)
    return float(np.median(f0)) if f0 else 0.0


def level(pcm: np.ndarray, target_rms: float = 2800.0) -> np.ndarray:
    """Same loudness for every voice, so the best-sounding one is not simply the loudest."""
    loud = np.abs(pcm) > 300
    rms = float(np.sqrt((pcm[loud].astype(np.float64) ** 2).mean())) if loud.any() else 1.0
    out = pcm.astype(np.float64) * (target_rms / max(rms, 1.0))
    return np.clip(out, -32000, 32000).astype(np.int16)


def encode_m4a(pcm: np.ndarray, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "x.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(pcm.tobytes())
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "24000", str(wav), str(dest)], check=True, capture_output=True)


def render(job):
    provider, voice, label, lang, extra = job
    try:
        if provider == "sarvam":
            raw = sarvam(voice, lang, extra.get("model", "bulbul:v3"))
            with tempfile.NamedTemporaryFile(suffix=".wav") as f:
                f.write(raw); f.flush(); pcm = to_pcm8k(Path(f.name))
        elif provider == "elevenlabs":
            raw = eleven(voice, lang)
            with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
                f.write(raw); f.flush(); pcm = to_pcm8k(Path(f.name))
        else:
            raw = rumik(voice, lang)
            pcm = np.frombuffer(audioop.alaw2lin(raw, 2), dtype=np.int16).copy()
        seconds = len(pcm) / 8000
        if seconds < 1.5:
            return job, None, f"too short ({seconds:.1f}s)"
        score = clarity(pcm, lang)
        pitch = pitch_hz(pcm)
        pcm = level(pcm)
        dest = OUT_DIR / provider / lang / f"{voice}.m4a"
        encode_m4a(pcm, dest)
        return job, {"seconds": round(seconds, 1), "clarity": round(score, 2), "pitch_hz": round(pitch), "file": f"/voices/{provider}/{lang}/{voice}.m4a"}, None
    except Exception as e:  # noqa: BLE001
        return job, None, f"{type(e).__name__}: {str(e)[:110]}"


def main():
    jobs = []
    for lang in LANGS:
        for v in SARVAM_V3:
            jobs.append(("sarvam", v, v.capitalize(), lang, {"model": "bulbul:v3"}))
    jobs.append(("sarvam", "kavitha_te_conversation", "Kavitha (conversation)", "te-IN", {"model": "bulbul:v4-flash"}))
    jobs.append(("sarvam", "kavitha", "Kavitha", "te-IN", {"model": "bulbul:v3"}))
    for lang in ("en-IN", "hi-IN"):
        for vid, name in ELEVEN.items():
            jobs.append(("elevenlabs", vid, name, lang, {}))
        for v in RUMIK:
            jobs.append(("rumik", v, v.capitalize(), lang, {}))
    print(f"{len(jobs)} samples to render", flush=True)

    catalog: dict[tuple, dict] = {}
    failed = []
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for i, (job, result, err) in enumerate(pool.map(render, jobs), 1):
            provider, voice, label, lang, extra = job
            if err or result is None:
                failed.append((provider, voice, lang, err)); print(f"[{i}/{len(jobs)}] FAIL {provider} {voice} {lang}: {err}", flush=True); continue
            print(f"[{i}/{len(jobs)}] ok   {provider:10s} {voice[:24]:24s} {lang} clarity {result['clarity']:.2f} pitch {result['pitch_hz']} Hz", flush=True)
            entry = catalog.setdefault((provider, voice), {"provider": provider, "voice": voice, "label": label, "model": extra.get("model"), "languages": {}})
            entry["languages"][lang] = result

    voices = []
    for entry in catalog.values():
        kept = {l: r for l, r in entry["languages"].items() if r["clarity"] >= 0.80}
        if not kept:
            continue
        pitch = float(np.median([r["pitch_hz"] for r in kept.values() if r["pitch_hz"]] or [0]))
        entry["languages"] = kept
        entry["gender"] = "female" if pitch >= 165 else "male" if pitch > 0 else "unknown"
        voices.append(entry)
    voices.sort(key=lambda e: (e["provider"], e["label"]))
    (ROOT / "web" / "lib" / "voice-catalog.json").write_text(json.dumps({"generated": time.strftime("%Y-%m-%d"), "voices": voices}, ensure_ascii=False, indent=1))
    print(f"\nkept {sum(len(e['languages']) for e in voices)} samples from {len(voices)} voices; {len(failed)} failed", flush=True)


if __name__ == "__main__":
    main()
