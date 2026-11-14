"""Narration for the product demo video, spoken by a Gnani Timbre v3 voice.

Each segment is one beat of the walkthrough. Writes one WAV per segment (16 kHz mono) plus
segments.json with their durations, into the output folder given as the first argument.

    python3 tools/make_narration.py /path/to/out [Voice]
"""

import json
import sys
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from make_demo_calls import RATE, api_key, synth  # noqa: E402

SEGMENTS = [
    ("intro", "Meet Lynksy, powered by Gnani AI. Lynksy lets any Indian business build AI phone agents that answer and place calls in their customers' own language, with no code."),
    ("demo", "First, how it sounds. This is a scripted scenario, spoken end to end by Gnani Timbre v3. A finance agent calls a customer about an upcoming loan instalment, in Hindi."),
    ("demo2", "And the same platform speaks Telugu. Here, a real estate agent books a site visit."),
    ("overview", "Once you sign in, the dashboard shows your wallet balance, calls, talk time and agents at a glance."),
    ("agents", "Building an agent takes a minute. Start from a ready template, like appointments, collections, lead qualification or support, or write your own prompt."),
    ("voice", "Then choose the language, and listen to the Gnani voices to pick how your agent sounds. Speech recognition and voice are both powered by Gnani AI."),
    ("numbers", "Connect an Indian phone number and route it to your agent, or request a test call to your own phone."),
    ("voices", "The voices page lets you audition every Gnani voice, in Hindi, English or Telugu, before you commit."),
    ("calls", "Every call is saved, with the full transcript, an outcome summary with the details collected, and a cost breakdown."),
    ("wallet", "Billing is simple. Rupees per minute, from a prepaid wallet topped up with UPI or card."),
    ("tech", "Under the hood, a voice worker streams audio from the phone line through Gnani speech recognition, a language model, and Gnani voices, with automatic failover so a call never goes silent."),
    ("outro", "Lynksy. Voice agents for every Indian language, powered by Gnani AI."),
]


def main():
    out = Path(sys.argv[1])
    voice = sys.argv[2] if len(sys.argv) > 2 else "Shivani"
    out.mkdir(parents=True, exist_ok=True)
    key = api_key()
    meta = []
    for name, text in SEGMENTS:
        pcm = synth(key, text, voice, "en-IN")
        path = out / f"{name}.wav"
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)
        seconds = len(pcm) / 2 / RATE
        meta.append({"name": name, "text": text, "seconds": round(seconds, 2), "file": str(path)})
        print(f"{name:9} {seconds:5.1f}s")
    (out / "segments.json").write_text(json.dumps(meta, indent=2))
    print(f"total {sum(m['seconds'] for m in meta):.1f}s with voice {voice}")


if __name__ == "__main__":
    main()
