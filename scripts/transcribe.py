import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe a media file with faster-whisper.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        args.input,
        language=args.language if args.language != "auto" else None,
        vad_filter=True,
    )

    rendered = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        rendered.append(
            {
                "startSec": round(float(segment.start), 2),
                "endSec": round(float(segment.end), 2),
                "text": text,
            }
        )

    payload = {
        "language": getattr(info, "language", args.language) or args.language,
        "duration": round(float(getattr(info, "duration", 0) or 0), 2),
        "text": " ".join(item["text"] for item in rendered),
        "segments": rendered,
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
