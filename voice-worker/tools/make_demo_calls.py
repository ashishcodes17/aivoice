"""Generate the landing-page demo calls entirely with Gnani Timbre v3.

Each scenario is a written script. Every line is synthesised with Gnani (the agent with one voice,
the caller with another), the lines are stitched into one recording with short natural pauses, and
the timestamps of each line are written next to the audio so the player can highlight them.

Needs only the Python standard library and `afconvert` (macOS) for the AAC export.

    python3 tools/make_demo_calls.py            # all scenarios
    python3 tools/make_demo_calls.py emi-hi     # one scenario
"""

import io
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
RATE = 16000
GAP_SECONDS = 0.38

SCENARIOS = [
    {
        "id": "emi-hi",
        "tab": "EMI reminder",
        "agent": "Reena · Mitra Finance",
        "language": "Hindi",
        "lang": "hi-IN",
        "agent_voice": "Lakshmi",
        "caller_voice": "Prakash",
        "outcome": "Customer promised to pay on the 7th by UPI",
        "lines": [
            ("caller", "हेलो?"),
            ("agent", "नमस्ते जी! मैं रीना बोल रही हूँ, मित्र फाइनेंस से। आपकी ईएमआई की डेट पास आ रही है, उसी के बारे में कॉल किया है। क्या अभी दो मिनट बात हो सकती है?"),
            ("caller", "हाँ बोलिए, पर जल्दी बताइए, मैं थोड़ा बिज़ी हूँ।"),
            ("agent", "जी, आपकी दो पहिया गाड़ी की लोन ईएमआई तीन हज़ार दो सौ रुपये इस महीने की पाँच तारीख को देय है। आप भुगतान कैसे करेंगे, ऐप से, यूपीआई से या ब्रांच जाकर?"),
            ("caller", "देखिए, सैलरी लेट हो गई है, पैसा सात तारीख को आएगा। लेट फीस माफ़ हो सकती है क्या?"),
            ("agent", "समझ सकती हूँ। देय तारीख के बाद भुगतान होने पर दो सौ रुपये लेट फीस लग सकती है। मैं माफ़ी का वादा नहीं कर सकती, पर अगर परेशानी हो तो हमारी टीम विकल्पों पर बात कर लेगी।"),
            ("caller", "ठीक है, सात तारीख को यूपीआई से पे कर दूँगा। बाय!"),
            ("agent", "ठीक है जी, धन्यवाद! नमस्ते!"),
        ],
    },
    {
        "id": "clinic-en",
        "tab": "Clinic appointment",
        "agent": "Aarti · Sunrise Clinic",
        "language": "English",
        "lang": "en-IN",
        "agent_voice": "Riyaa",
        "caller_voice": "Avinash",
        "outcome": "Consultation booked, Wednesday 6:15 PM",
        "lines": [
            ("caller", "Hello, I'd like to book an appointment with the doctor."),
            ("agent", "Hi, this is Aarti from Sunrise Clinic. Of course, which day suits you?"),
            ("caller", "Tomorrow evening, if possible. Around six."),
            ("agent", "Tomorrow, Wednesday the eleventh, has a six fifteen slot open. Shall I book that for you?"),
            ("caller", "Yes please. The name is Rahul Verma."),
            ("agent", "Done, Rahul. Your consultation is booked for tomorrow at six fifteen. The fee is five hundred rupees, and please carry any previous reports."),
            ("caller", "Great, thank you."),
            ("agent", "You're welcome. You'll get a reminder message before the visit. Have a lovely day!"),
        ],
    },
    {
        "id": "realty-te",
        "tab": "Site visit booking",
        "agent": "Priya · Green Valley Homes",
        "language": "Telugu",
        "lang": "te-IN",
        "agent_voice": "Chetana",
        "caller_voice": "Prakash",
        "outcome": "Site visit booked, Sunday 11 AM",
        "lines": [
            ("caller", "హలో?"),
            ("agent", "నమస్కారం అండి, నేను గ్రీన్ వ్యాలీ హోమ్స్ నుండి ప్రియ మాట్లాడుతున్నాను. మీరు మా ప్రాజెక్ట్ గురించి అడిగారు కదా, ఇప్పుడు రెండు నిమిషాలు మాట్లాడవచ్చా?"),
            ("caller", "అవును చెప్పండి. రెండు బెడ్రూమ్ ఫ్లాట్ గురించి తెలుసుకోవాలి."),
            ("agent", "తప్పకుండా అండి. రెండు బెడ్రూమ్ ఫ్లాట్లు ఇప్పుడు అందుబాటులో ఉన్నాయి. మీరు ఎప్పుడైనా వచ్చి సైట్ చూడాలనుకుంటున్నారా?"),
            ("caller", "ఈ ఆదివారం ఉదయం పదకొండు గంటలకు వస్తాను."),
            ("agent", "చాలా బాగుంది అండి. ఆదివారం ఉదయం పదకొండు గంటలకు సైట్ విజిట్ బుక్ చేశాను. మా ప్రతినిధి మిమ్మల్ని అక్కడ కలుస్తారు. ధన్యవాదాలు!"),
            ("caller", "సరే, ధన్యవాదాలు."),
        ],
    },
]


def api_key() -> str:
    for line in (ROOT / "voice-worker" / ".env").read_text().splitlines():
        if line.startswith("GNANI_API_KEY="):
            return line.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("GNANI_API_KEY missing from voice-worker/.env")


def synth(key: str, text: str, voice: str, lang: str) -> bytes:
    """One line of speech as raw 16-bit mono PCM at RATE."""
    body = json.dumps({
        "text": text, "model": "timbre-v3.0", "voice": voice, "language": lang,
        "audio_config": {"sample_rate": RATE, "encoding": "linear_pcm", "container": "wav"},
    }).encode()
    for wait in (0, 2, 4, 8, 16):
        time.sleep(wait)
        req = urllib.request.Request(
            "https://api.vachana.ai/api/v1/tts/inference", data=body,
            headers={"X-API-Key-ID": key, "Content-Type": "application/json", "User-Agent": "curl/8.7.1", "Accept": "*/*"},
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            break
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise SystemExit(f"Gnani error {e.code}: {e.read()[:200]!r}")
    else:
        raise SystemExit("Gnani kept rate-limiting")
    with wave.open(io.BytesIO(data)) as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1 and w.getsampwidth() == 2
        return w.readframes(w.getnframes())


def build(key: str, sc: dict) -> dict:
    pcm = bytearray()
    gap = b"\x00\x00" * int(RATE * GAP_SECONDS)
    lines = []
    for who, text in sc["lines"]:
        voice = sc["agent_voice"] if who == "agent" else sc["caller_voice"]
        start = len(pcm) / 2 / RATE
        pcm += synth(key, text, voice, sc["lang"])
        pcm += gap
        lines.append({"who": who, "text": text, "at": round(start, 2)})
        print(f"  {sc['id']} {who:6} {start:6.1f}s  {text[:48]}")
    wav_path = Path("/private/tmp/claude-501") / f"{sc['id']}.wav"
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(pcm))
    out = WEB / "public" / "demo" / f"{sc['id']}.m4a"
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "48000", str(wav_path), str(out)], check=True)
    return {
        "id": sc["id"], "tab": sc["tab"], "agent": sc["agent"], "language": sc["language"],
        "outcome": sc["outcome"], "audio": f"/demo/{sc['id']}.m4a",
        "duration": round(len(pcm) / 2 / RATE, 1), "lines": lines,
    }


def main():
    wanted = set(sys.argv[1:])
    key = api_key()
    out_json = WEB / "lib" / "demo-calls.gnani.json"
    existing = {c["id"]: c for c in json.loads(out_json.read_text())} if out_json.exists() else {}
    for sc in SCENARIOS:
        if wanted and sc["id"] not in wanted:
            continue
        print(f"== {sc['id']}")
        existing[sc["id"]] = build(key, sc)
    ordered = [existing[s["id"]] for s in SCENARIOS if s["id"] in existing]
    out_json.write_text(json.dumps(ordered, ensure_ascii=False, indent=2))
    print(f"wrote {out_json} ({len(ordered)} calls)")


if __name__ == "__main__":
    main()
