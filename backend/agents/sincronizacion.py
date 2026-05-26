import os
import json
import unicodedata
import re
import anthropic

FPS = 30
CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

ICONS_AVAILABLE = [
    "server", "users", "code", "cpu", "globe", "database",
    "trending-down", "check-circle", "lightbulb", "activity",
]

COLOR_MAP = {
    "crisis":   "#ef4444",
    "logro":    "#22c55e",
    "dato":     "#3b82f6",
    "decision": "#f59e0b",
    "tech":     "#6366f1",
    "humano":   "#8b5cf6",
    "cierre":   "#06b6d4",
}

SECTION_DEFAULTS = {
    "GANCHO":    {"color": "#ef4444", "style": "chapter"},
    "CONTEXTO":  {"color": "#6366f1", "style": "chapter"},
    "ASCENSO":   {"color": "#22c55e", "style": "chapter"},
    "DECISION_1": {"color": "#f59e0b", "style": "chapter"},
    "DECISION_2": {"color": "#ef4444", "style": "chapter"},
    "DECISION_3": {"color": "#ef4444", "style": "chapter"},
    "DECISION_4": {"color": "#f97316", "style": "chapter"},
    "DECISION_5": {"color": "#ef4444", "style": "chapter"},
    "DECISION_6": {"color": "#ef4444", "style": "chapter"},
    "LEGADO":    {"color": "#22c55e", "style": "chapter"},
    "CRITERIO":  {"color": "#06b6d4", "style": "outro"},
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r'[^a-z0-9 ]', '', text.lower())


def run(project_id: int, folder: str):
    whisper_path = os.path.join(folder, "whisper_output.json")
    script_path  = os.path.join(folder, "full_script.txt")

    with open(whisper_path, "r", encoding="utf-8") as f:
        whisper = json.load(f)
    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    segments = whisper.get("segments", [])
    sections = _detect_sections(script, segments)
    _write_sequences_ts(sections, folder, whisper)

    raw_slides = _build_raw_slides(sections, segments)
    print(f"[SyncAgent] {len(raw_slides)} slides crudos. Enriqueciendo con Claude...")
    enriched = _enrich_with_claude(raw_slides, script)
    print(f"[SyncAgent] {len(enriched)} slides enriquecidos.")

    out = os.path.join(folder, "paragraphSlides.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    intro_data = _get_intro_data(script)
    with open(os.path.join(folder, "intro_data.json"), "w", encoding="utf-8") as f:
        json.dump(intro_data, f, ensure_ascii=False, indent=2)

    # Copia automática al directorio de Remotion
    remotion_src = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(folder))),
        "remotion", "src"
    )
    if os.path.isdir(remotion_src):
        import shutil
        shutil.copy(os.path.join(folder, "paragraphSlides.json"), os.path.join(remotion_src, "paragraphSlides.json"))
        shutil.copy(os.path.join(folder, "sequences.ts"),         os.path.join(remotion_src, "sequences.ts"))
        shutil.copy(os.path.join(folder, "intro_data.json"),      os.path.join(remotion_src, "introData.json"))
        print(f"[SyncAgent] Copiado paragraphSlides.json, sequences.ts e introData.json a {remotion_src}")


def _detect_sections(script: str, segments: list) -> dict:
    section_keys = [
        "GANCHO", "CONTEXTO",
        "DECISION_1", "DECISION_2", "DECISION_3",
        "DECISION_4", "DECISION_5", "DECISION_6",
        "LEGADO", "CRITERIO",
    ]
    result = {}
    for i, key in enumerate(section_keys):
        start_time = segments[i * max(1, len(segments) // len(section_keys))]["start"]
        result[key] = {"start": start_time}

    for i, key in enumerate(section_keys):
        next_key = section_keys[i + 1] if i + 1 < len(section_keys) else None
        end = segments[-1]["end"] if not next_key else result[next_key]["start"]
        result[key]["end"]      = end
        result[key]["from"]     = int(result[key]["start"] * FPS)
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

    with open(os.path.join(folder, "sequences.ts"), "w", encoding="utf-8") as f:
        f.writelines(lines)


def _build_raw_slides(sections: dict, segments: list) -> list:
    """Agrupa segmentos Whisper en ventanas de 300 frames por sección."""
    WINDOW = 300
    slides = []
    for key, val in sections.items():
        start_frame = val["from"]
        end_frame   = start_frame + val["duration"]
        window_start = start_frame
        is_first_in_section = True
        while window_start < end_frame:
            window_end = window_start + WINDOW
            matching = [
                s["text"].strip()
                for s in segments
                if s["start"] * FPS >= window_start and s["start"] * FPS < window_end
            ]
            text = " ".join(matching).strip() or "..."
            dec_num = None
            if key.startswith("DECISION_"):
                try:
                    dec_num = int(key.split("_")[1])
                except ValueError:
                    pass
            slides.append({
                "section":     key,
                "from":        window_start,
                "duration":    WINDOW,
                "text":        text,
                "is_first":    is_first_in_section,
                "decisionNum": dec_num,
            })
            is_first_in_section = False
            window_start += WINDOW
    return slides


def _enrich_with_claude(slides: list, script: str) -> list:
    """Extrae N ideas por sección según su duración y las distribuye entre los slides.
    Sección de 30s → 1 idea. Sección de 1min → 2-3 ideas. Sección de 2min → 4-5 ideas."""

    # Agrupa slides por sección y calcula cuántas ideas pedir
    from collections import defaultdict
    by_section = defaultdict(list)
    for s in slides:
        by_section[s["section"]].append(s)

    section_idea_counts = {}
    for sec, sec_slides in by_section.items():
        n_slides = len(sec_slides)
        # 1 idea cada ~3 slides (30s), mínimo 1, máximo 6
        n_ideas = max(1, min(6, round(n_slides / 3)))
        section_idea_counts[sec] = n_ideas

    section_map = _get_section_visuals(script, section_idea_counts)

    result = []
    for sec, sec_slides in by_section.items():
        ideas = section_map.get(sec, [])
        if not ideas:
            default = SECTION_DEFAULTS.get(sec, {"color": "#6366f1", "style": "newscard"})
            ideas = [{
                "displayText": sec_slides[0]["text"][:100],
                "icon": "activity",
                "color": default["color"],
                "style": default["style"],
                "number": None,
                "lowerThird": None,
            }]

        n_ideas = len(ideas)
        n_slides = len(sec_slides)
        # Distribuye las ideas uniformemente entre los slides
        for i, slide in enumerate(sec_slides):
            idea_idx = min(int(i * n_ideas / n_slides), n_ideas - 1)
            visual = ideas[idea_idx]
            slide.pop("is_first", None)
            result.append({
                "from":        slide["from"],
                "duration":    slide["duration"],
                "section":     sec,
                "text":        slide["text"],
                "displayText": visual.get("displayText", slide["text"][:100]),
                "style":       visual.get("style", "newscard"),
                "number":      visual.get("number", None),
                "icon":        visual.get("icon", "activity"),
                "color":       visual.get("color", "#6366f1"),
                "lowerThird":  visual.get("lowerThird", None),
                "decisionNum": slide["decisionNum"],
            })

    # Reordena por frame de inicio
    result.sort(key=lambda s: s["from"])
    return result


def _get_section_visuals(script: str, section_idea_counts: dict) -> dict:
    """Una sola llamada a Claude. Por cada sección devuelve un array de N ideas distintas,
    donde N viene dado por la duración de la sección."""

    sections_desc = "\n".join(
        f'- {sec}: {n} idea{"s" if n > 1 else ""} distinta{"s" if n > 1 else ""}'
        for sec, n in section_idea_counts.items()
    )

    prompt = f"""Eres el director visual de un canal de YouTube de tecnología en español.
Leerás el guion completo y extraerás ideas visuales para cada sección.

GUION:
{script}

SECCIONES Y CANTIDAD DE IDEAS A EXTRAER (según duración de cada sección):
{sections_desc}

ICONOS DISPONIBLES: {', '.join(ICONS_AVAILABLE)}

COLORES SEMÁNTICOS:
- "#ef4444" → crisis, caída, problema, fracaso
- "#22c55e" → logro, éxito, crecimiento, récord
- "#3b82f6" → dato estadístico, número técnico
- "#f59e0b" → decisión, pivote, momento clave
- "#6366f1" → tecnología, sistema, arquitectura
- "#8b5cf6" → impacto humano, equipo, personas
- "#06b6d4" → cierre, legado, reflexión final

ESTILOS:
- "chapter"  → primera idea de una sección (el titular del capítulo)
- "stat"     → hay un número impactante para mostrar en grande
- "newscard" → narración general
- "outro"    → solo para sección CRITERIO

FORMATO DE RESPUESTA (JSON exacto):
{{
  "NOMBRE_SECCION": [
    {{
      "displayText": "primera idea en 6-10 palabras, impactante",
      "icon": "nombre_icono",
      "color": "#hexcolor",
      "style": "chapter|stat|newscard|outro",
      "number": "96%" o null,
      "lowerThird": "ETIQUETA CORTA" o null
    }},
    {{
      "displayText": "segunda idea distinta a la primera",
      "icon": "otro_icono_diferente",
      ...
    }}
  ],
  ...
}}

REGLAS CRÍTICAS:
1. displayText es el TITULAR VISUAL — no copias del guion, sino la esencia destilada.
2. Dentro de cada sección, las ideas deben ser DISTINTAS entre sí (diferente aspecto del tema).
3. Dentro de cada sección, usa ICONOS DIFERENTES en cada idea cuando sea posible.
4. La primera idea de cada sección usa style "chapter". Las siguientes "newscard" o "stat".
5. CRITERIO siempre usa style "outro" en todas sus ideas.
6. Responde ÚNICAMENTE con el JSON. Sin explicaciones ni markdown.
"""

    print(f"[SyncAgent] Extrayendo ideas visuales por sección con Claude...")
    response = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[SyncAgent] Error JSON en visuals: {e}. Usando defaults.")
        return {}


def _get_intro_data(script: str) -> dict:
    """Extrae los datos del intro (título, subtítulos, stat de impacto) del guion."""
    prompt = f"""Lee el GANCHO de este guion y extrae los datos para la pantalla de introducción del video.

GUION (primeros 3000 caracteres):
{script[:3000]}

Devuelve este JSON exacto:
{{
  "title": "Nombre corto del protagonista (2-4 palabras, sin artículos)",
  "subtitle1": "Primera línea dramática (6-10 palabras)",
  "subtitle2": "Segunda línea de cierre (4-8 palabras)",
  "dateRange": "AAAA — AAAA",
  "stat": "El número más impactante del gancho (ej: 96%, $7B, 45.000)",
  "statDesc": "Descripción del stat en 3-5 palabras EN MAYÚSCULAS",
  "statLine1": "Frase que contextualiza el stat (sin markdown)",
  "statLine2": "Frase que cierra el impacto (sin markdown)"
}}

REGLAS:
- title: solo el nombre del protagonista/empresa/producto
- subtitle1 + subtitle2 forman juntas una frase dramática sobre su historia
- dateRange: años de inicio y fin del tema (ej: "1982 — 2010")
- stat: el dato más sorprendente en formato corto
- statDesc: qué representa ese número (ej: "DESCUENTO AL VENDERSE", "EMPLEOS PERDIDOS")
- statLine1/statLine2: dos frases cortas que dan contexto, extraídas fielmente del guion
- Responde ÚNICAMENTE con el JSON. Sin explicaciones ni markdown.
"""
    print("[SyncAgent] Generando datos del intro con Claude...")
    response = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[SyncAgent] Error JSON en intro_data: {e}. Usando defaults.")
        return {
            "title": "Neural Studio",
            "subtitle1": "La historia que cambió la tecnología",
            "subtitle2": "para siempre",
            "dateRange": "1980 — 2010",
            "stat": "100%",
            "statDesc": "HISTORIA VERIFICADA",
            "statLine1": "Un documental tecnológico",
            "statLine2": "contado como nunca antes",
        }
