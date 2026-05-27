import os
import re
import json
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SECTION_COLORS = {
    "HOOK":       "#ef4444",   # red — danger, the revelation that opens everything
    "CONTEXT":    "#6366f1",   # indigo — political landscape, the world before
    "ORIGIN":     "#f59e0b",   # amber — classified creation, the decision to build it
    "OPERATIONS": "#00d4ff",   # cyan — intelligence, signals, covert action
    "COVERUP":    "#dc2626",   # dark red — erasure, denial, institutional deception
    "CLOSING":    "#64748b",   # slate — gravity, what remains, the file still open
}

DEFAULT_ICONS = {
    "HOOK":       "alert",
    "CONTEXT":    "clock",
    "ORIGIN":     "database",
    "OPERATIONS": "network",
    "COVERUP":    "gear",
    "CLOSING":    "code",
}

# Icon rotation per section — each slide within the same section
# gets a different icon to avoid visual repetition.
SECTION_ICON_SETS: dict = {
    "HOOK":       ["alert", "code", "gear"],
    "CONTEXT":    ["clock", "network", "database"],
    "ORIGIN":     ["database", "gear", "clock"],
    "OPERATIONS": ["network", "alert", "database", "gear", "code"],
    "COVERUP":    ["gear", "alert", "network", "database"],
    "CLOSING":    ["code", "clock", "alert"],
}

# Palabras que no deben quedar al final del displayText
_BAD_ENDINGS = {
    'de','del','y','a','o','en','la','el','un','lo','al','por','con','su',
    'que','no','se','las','los','una','como','pero','si','cuando','donde',
    'durante','fue','era','han','hay','ya','más','sin','ni','sobre','entre',
    'hasta','desde','para','porque','aunque','mientras','también','esto',
}


def _extract_number(text: str):
    for p in [
        r'\$[\d,.]+ (?:mil millones|millones|billones)',
        r'[\d]+%',
        r'[\d,]+ millones',
        r'\b(19|20)\d{2}\b',
    ]:
        m = re.search(p, text)
        if m:
            return m.group(0)
    return None


def _display_text(text: str) -> str:
    # 1. Buscar fin de oración natural (punto, exclamación, interrogación)
    for sep in ['. ', '.\n', '! ', '? ', '… ']:
        idx = text.find(sep)
        if 28 < idx < 105:
            result = text[:idx + 1].strip()
            return result[0].upper() + result[1:] if result else result

    # 2. Corte en límite de palabra antes de los 95 caracteres
    raw = text[:100] if len(text) > 100 else text
    cut = raw.rfind(' ')
    if cut > 30:
        result = raw[:cut].strip()
    else:
        result = raw.strip()

    # 3. Eliminar palabras cortas o de enlace al final (evitar "…de", "…y", etc.)
    words = result.split()
    while words and words[-1].lower().rstrip('.,;:') in _BAD_ENDINGS:
        words.pop()
    result = ' '.join(words)

    # 4. Añadir elipsis si no termina en puntuación
    if result and result[-1] not in '.!?…':
        result += '…'

    return result[0].upper() + result[1:] if result else result


def _enrich_slides(slides: list, section_icons: dict) -> list:
    counters: dict = {}
    result = []
    for s in slides:
        section = s["section"]
        counters[section] = counters.get(section, 0) + 1
        count = counters[section]
        is_decision = section.startswith("DECISION_")
        dec_num = int(section.split("_")[1]) if is_decision else None
        style = "chapter" if (is_decision and count == 1) else "newscard"
        # Rotación de iconos: el icono varía slide a slide dentro de la sección
        primary = section_icons.get(section, DEFAULT_ICONS.get(section, "code"))
        icon_pool = SECTION_ICON_SETS.get(section, [primary, "code", "gear"])
        if primary not in icon_pool:
            icon_pool = [primary] + icon_pool[:2]
        icon = icon_pool[(count - 1) % len(icon_pool)]

        result.append({
            **s,
            "style": style,
            "decisionNum": dec_num,
            "displayText": _display_text(s["text"]),
            "icon": icon,
            "color": SECTION_COLORS.get(section, "#00d4ff"),
            "number": _extract_number(s["text"]) if count == 1 else None,
            "lowerThird": section.replace("_", " ") if count == 1 else "",
        })
    return result


def run(project_id: int, folder: str, force: bool = False):
    visual_path = os.path.join(folder, "visual_data.json")
    slides_path = os.path.join(folder, "paragraphSlides.json")
    script_path = os.path.join(folder, "full_script.txt")

    if not force and os.path.exists(visual_path):
        print("[VisualAgent] visual_data.json ya existe, saltando.")
        return

    if not os.path.exists(slides_path) or not os.path.exists(script_path):
        raise FileNotFoundError("Faltan archivos de sync. Ejecuta SincronizacionAgent primero.")

    with open(slides_path, "r", encoding="utf-8") as f:
        slides = json.load(f)
    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()[:3500]

    print("[VisualAgent] Generando datos de escenas con Claude...")

    msg = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"""You are the creative director of Phantom Directive — a classified military history YouTube channel.
Slogan: "Classified History. Declassified."

Read the script excerpt below and generate the visual data for this video.
Every field must feel like it belongs to a declassified document, not a tech documentary.
Tone: dark, cinematic, serious. Colors should reflect danger, secrecy, and classified operations.

Script (first 3500 characters):
{script}

Video sections: HOOK, CONTEXT, ORIGIN, OPERATIONS, COVERUP, CLOSING

Available icons (choose the most thematically representative for each section):
database, rails, jvm, network, fanout, team, gear, alert, clock, code

Generate ONLY this JSON with no additional explanations:
{{
  "channel_header": "short dramatic video title (max 55 chars) — like a classified file subject line",
  "date_range": "start_year – end_year of the story",
  "section_icons": {{
    "HOOK":       "icon",
    "CONTEXT":    "icon",
    "ORIGIN":     "icon",
    "OPERATIONS": "icon",
    "COVERUP":    "icon",
    "CLOSING":    "icon"
  }},
  "gancho_icon": "icon representing the main subject (database|rails|jvm|network|fanout|team|gear|alert|clock|code)",
  "gancho_stat": "the most impactful number, year, or percentage in the story (e.g., 1980, –96%, $200M, 40yrs)",
  "gancho_stat_desc": "short description of that stat (max 6 words in ALL CAPS with ·, e.g., YEARS CLASSIFIED · DENIED BY PENTAGON)",
  "gancho_lines": [
    {{"text": "line 1 — a concrete fact or shocking detail from the hook", "from": 10, "size": 52, "color": "text", "weight": 300}},
    {{"text": "line 2 — short and powerful — maximum 8 words", "from": 50, "size": 68, "color": "accent", "weight": 700}},
    {{"text": "line 3 — creates contrast or tension — the thing that was buried", "from": 90, "size": 48, "color": "muted", "weight": 300}},
    {{"text": "line 4 — the dramatic turn that hooks the viewer", "from": 130, "size": 44, "color": "text", "weight": 400}}
  ],
  "legado_title": "short dramatic title for the cover-up / legacy section (max 40 chars, e.g., Erased · Denied · Still Active)",
  "criterio_title": "title for the closing reflection (max 30 chars, e.g., The File Is Still Open)",
  "legado_items": [
    {{"label": "specific concrete legacy item 1", "desc": "real impact it left on military history, intelligence, or policy"}},
    {{"label": "specific concrete legacy item 2", "desc": "real impact it left"}},
    {{"label": "specific concrete legacy item 3", "desc": "real impact or lesson that remains unresolved"}}
  ],
  "criterio_lines": [
    {{"text": "line 1: poses the central uncomfortable question of the video"}},
    {{"text": "line 2: the direct, powerful conclusion (the most impactful line)"}},
    {{"text": "line 3: final dichotomy in format: Concept A  ·  vs  ·  Concept B"}}
  ]
}}"""}]
    )

    try:
        text = msg.content[0].text.strip()
        start = text.index('{')
        end = text.rindex('}') + 1
        claude_data = json.loads(text[start:end])
    except Exception as e:
        print(f"[VisualAgent] Error parseando Claude: {e}, usando defaults.")
        claude_data = _default_data()

    section_icons = claude_data.get("section_icons", DEFAULT_ICONS)
    enriched = _enrich_slides(slides, section_icons)

    visual_data = {
        "channel_header": claude_data.get("channel_header", "Phantom Directive"),
        "date_range":     claude_data.get("date_range", ""),
        "gancho_lines":   claude_data.get("gancho_lines", _default_data()["gancho_lines"]),
        "legado_items":   claude_data.get("legado_items", _default_data()["legado_items"]),
        "criterio_lines": claude_data.get("criterio_lines", _default_data()["criterio_lines"]),
    }

    with open(slides_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    with open(visual_path, "w", encoding="utf-8") as f:
        json.dump(visual_data, f, ensure_ascii=False, indent=2)

    print("[VisualAgent] Listo.")


def _default_data():
    return {
        "channel_header": "Phantom Directive",
        "date_range": "",
        "section_icons": DEFAULT_ICONS,
        "gancho_icon": "alert",
        "gancho_stat": "CLASSIFIED",
        "gancho_stat_desc": "DENIED BY THE PENTAGON",
        "legado_title": "Erased · Denied · Still Active",
        "criterio_title": "The File Is Still Open",
        "gancho_lines": [
            {"text": "A unit with no name. No record.", "from": 10, "size": 52, "color": "text", "weight": 300},
            {"text": "They said it didn't exist.", "from": 50, "size": 68, "color": "accent", "weight": 700},
            {"text": "But the operations happened.", "from": 90, "size": 48, "color": "muted", "weight": 300},
            {"text": "And the file is still open.", "from": 130, "size": 44, "color": "text", "weight": 400},
        ],
        "legado_items": [
            {"label": "Classified by design", "desc": "Erased from official records before it was ever operational"},
            {"label": "The operators denied everything", "desc": "Men told to lie under oath about where they served"},
            {"label": "The pattern continues", "desc": "The same architecture of secrecy exists in units today"},
        ],
        "criterio_lines": [
            {"text": "If they erased this unit from history —"},
            {"text": "what else is still classified?"},
            {"text": "Official record  ·  vs  ·  What actually happened"},
        ],
    }
