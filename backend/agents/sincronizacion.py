import os
import json
import unicodedata
import re

FPS = 30


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r'[^a-z0-9 ]', '', text.lower())


def run(project_id: int, folder: str):
    whisper_path = os.path.join(folder, "whisper_output.json")
    script_path = os.path.join(folder, "full_script.txt")

    with open(whisper_path, "r", encoding="utf-8") as f:
        whisper = json.load(f)
    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    segments = whisper.get("segments", [])
    sections = _detect_sections(script, segments)
    _write_sequences_ts(sections, folder, whisper)
    _write_paragraph_slides(sections, segments, folder)


def _detect_sections(script: str, segments: list) -> dict:
    section_keys = [
        "GANCHO", "CONTEXTO",
        "DECISION_1", "DECISION_2", "DECISION_3",
        "DECISION_4", "DECISION_5", "DECISION_6",
        "LEGADO", "CRITERIO",
    ]
    result = {}
    seg_texts = [(_normalize(s["text"]), s["start"]) for s in segments]

    for i, key in enumerate(section_keys):
        start_time = 0.0
        if i < len(seg_texts):
            start_time = segments[i * max(1, len(segments) // len(section_keys))]["start"]
        result[key] = {"start": start_time}

    for i, key in enumerate(section_keys):
        next_key = section_keys[i + 1] if i + 1 < len(section_keys) else None
        end = segments[-1]["end"] if not next_key else result[next_key]["start"]
        result[key]["end"] = end
        result[key]["from"] = int(result[key]["start"] * FPS)
        result[key]["duration"] = max(30, int((end - result[key]["start"]) * FPS))

    return result


def _write_sequences_ts(sections: dict, folder: str, whisper: dict):
    total_frames = int(whisper["segments"][-1]["end"] * FPS) + 30
    lines = ["// AUTO-GENERADO por SincronizacionAgent\n",
             f"export const FPS = {FPS};\n\n",
             "export const SEQUENCES = {\n"]
    for key, val in sections.items():
        lines.append(f'  {key:<12}: {{ from: {val["from"]:>7}, duration: {val["duration"]:>5} }},\n')
    lines.append("} as const;\n\n")
    lines.append(f"export const TOTAL_FRAMES = {total_frames};\n")

    out = os.path.join(folder, "sequences.ts")
    with open(out, "w", encoding="utf-8") as f:
        f.writelines(lines)


def _write_paragraph_slides(sections: dict, segments: list, folder: str):
    WINDOW = 300
    slides = []
    for key, val in sections.items():
        start_frame = val["from"]
        end_frame = start_frame + val["duration"]
        window_start = start_frame
        while window_start < end_frame:
            window_end = window_start + WINDOW
            matching = [
                s["text"].strip()
                for s in segments
                if s["start"] * FPS >= window_start and s["start"] * FPS < window_end
            ]
            text = " ".join(matching).strip() or "..."
            slides.append({"section": key, "from": window_start, "duration": WINDOW, "text": text})
            window_start += WINDOW

    out = os.path.join(folder, "paragraphSlides.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(slides, f, ensure_ascii=False, indent=2)
