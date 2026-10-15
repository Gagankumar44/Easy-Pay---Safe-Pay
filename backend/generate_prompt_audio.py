"""Regenerate only public Kannada UI prompts; never pass private conversation text."""
import json
import re
import time
from pathlib import Path
from conversation import PROMPTS
from speech import generate_audio


def main():
    frontend = Path(__file__).resolve().parent.parent / "frontend"
    target = frontend / "public" / "audio" / "kn"
    target.mkdir(parents=True, exist_ok=True)
    keys = ["welcome", "recipient", "amount", "purpose", "review", "paused", "cancel", "receive", "bill", "history"]

    def render(key):
        path = target / (key + ".wav")
        if not path.exists():
            for attempt in range(3):
                try:
                    path.write_bytes(generate_audio(PROMPTS["kn-IN"][key], "kn-IN"))
                    print("Generated:", key, flush=True)
                    time.sleep(21)
                    break
                except Exception as exc:
                    if "429" not in str(exc) and "rate limit" not in str(exc).lower():
                        raise
                    print("Waiting for the provider's free-tier limit:", key, flush=True)
                    time.sleep(55)
            if not path.exists():
                raise RuntimeError("Audio generation is rate limited. Resume this script later.")
        return re.sub(r"[.?!।]+$", "", PROMPTS["kn-IN"][key].strip()), "/audio/kn/" + key + ".wav"

    pairs = [render(key) for key in keys]
    (frontend / "src" / "lib" / "recorded-voices.json").write_text(json.dumps(dict(pairs), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Public Kannada prompt clips ready:", len(pairs))


if __name__ == "__main__":
    main()
