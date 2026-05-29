import os
import httpx

FISH_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
FISH_VOICE_ID = os.environ.get("FISH_VOICE_ID", "")

CHUNK_MAX_CHARS = 4500


def run(project_id: int, folder: str, force: bool = False):
    audio_path = os.path.join(folder, "audio.mp3")
    whisper_path = os.path.join(folder, "whisper_output.json")

    audio_exists = os.path.exists(audio_path)
    whisper_exists = os.path.exists(whisper_path)

    if not force and audio_exists and whisper_exists:
        print("[AudioAgent] Audio and Whisper already exist, skipping.")
        return

    if not force and audio_exists and not whisper_exists:
        print("[AudioAgent] Audio already exists, skipping Fish Audio — running Whisper only.")
        _transcribe(audio_path, folder, project_id)
        return

    narration_path = os.path.join(folder, "narration.txt")
    with open(narration_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    print(f"[AudioAgent] Narración: {len(text)} caracteres")

    chunks = _split_by_paragraphs(text, CHUNK_MAX_CHARS)
    print(f"[AudioAgent] Dividido en {len(chunks)} chunk(s) para Fish Audio")

    audio_parts = []
    for i, chunk in enumerate(chunks):
        print(f"[AudioAgent] Generando chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)...")
        audio_parts.append(_tts(chunk))

    full_audio = b"".join(audio_parts)
    with open(audio_path, "wb") as f:
        f.write(full_audio)

    print(f"[AudioAgent] Audio guardado ({len(full_audio) / 1024:.0f} KB). Iniciando Whisper...")
    _transcribe(audio_path, folder, project_id)


def _split_by_paragraphs(text: str, max_chars: int) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    current = []
    current_len = 0

    for para in paragraphs:
        para_len = len(para)
        if current_len + para_len + 1 > max_chars and current:
            chunks.append("\n".join(current))
            current = [para]
            current_len = para_len
        else:
            current.append(para)
            current_len += para_len + 1

    if current:
        chunks.append("\n".join(current))

    return chunks


def _tts(text: str) -> bytes:
    resp = httpx.post(
        "https://api.fish.audio/v1/tts",
        headers={"Authorization": f"Bearer {FISH_API_KEY}"},
        json={
            "text": text,
            "reference_id": FISH_VOICE_ID,
            "format": "mp3",
            "mp3_bitrate": 192,
            "latency": "normal",
            "normalize": True,
            "chunk_length": 500,
            "prosody": {
                "speed": 0.94,
                "volume": 3,
            },
        },
        timeout=300,
    )
    resp.raise_for_status()
    return resp.content


def _transcribe(audio_path: str, folder: str, project_id: int | None = None):
    import json
    import torch
    import whisper

    if project_id is not None:
        try:
            from progress import emit
            emit(project_id, "whisper", "Transcribing audio with Whisper (may take a few minutes)...")
        except Exception:
            pass

    device = "cuda" if torch.cuda.is_available() else "cpu"
    fp16 = device == "cuda"
    print(f"[AudioAgent] Whisper usando device: {device}, model: base")

    model = whisper.load_model("base", device=device)
    result = model.transcribe(audio_path, language="en", fp16=fp16, verbose=False)

    dest = os.path.join(folder, "whisper_output.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("[AudioAgent] Whisper completado.")
