import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("usage: faster_whisper_transcribe.py <audio> <model> <cache-dir> [language]")

    audio_path = Path(sys.argv[1]).resolve()
    model_name = sys.argv[2]
    cache_dir = Path(sys.argv[3]).resolve()
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
    cache_dir.mkdir(parents=True, exist_ok=True)

    model = WhisperModel(
        model_name,
        device="cpu",
        compute_type="int8",
        download_root=str(cache_dir),
    )
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
    )

    text_parts = []
    words = []
    probabilities = []
    duration = 0.0
    for segment in segments:
        text_parts.append(segment.text.strip())
        duration = max(duration, float(segment.end))
        probabilities.append(max(0.0, min(1.0, 1.0 - float(segment.no_speech_prob))))
        for word in segment.words or []:
            probability = float(word.probability or 0.0)
            words.append({
                "word": word.word.strip(),
                "startSec": float(word.start),
                "endSec": float(word.end),
                "confidence": probability,
            })
            probabilities.append(probability)

    confidence = sum(probabilities) / len(probabilities) if probabilities else 0.0
    print(json.dumps({
        "text": " ".join(part for part in text_parts if part).strip(),
        "confidence": confidence,
        "durationSec": duration,
        "language": info.language or language or "unknown",
        "words": words,
    }))


if __name__ == "__main__":
    main()
