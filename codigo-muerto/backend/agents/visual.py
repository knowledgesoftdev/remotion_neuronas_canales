import os
import re
import json
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SECTION_COLORS = {
    "GANCHO":     "#00d4ff",
    "CONTEXTO":   "#8b5cf6",
    "DECISION_1": "#00d4ff",
    "DECISION_2": "#8b5cf6",
    "DECISION_3": "#a78bfa",
    "DECISION_4": "#f59e0b",
    "DECISION_5": "#00d4ff",
    "DECISION_6": "#cc2222",
    "LEGADO":     "#8b5cf6",
    "CRITERIO":   "#00d4ff",
}

DEFAULT_ICONS = {
    "GANCHO":     "alert",
    "CONTEXTO":   "clock",
    "DECISION_1": "database",
    "DECISION_2": "gear",
    "DECISION_3": "network",
    "DECISION_4": "team",
    "DECISION_5": "fanout",
    "DECISION_6": "alert",
    "LEGADO":     "code",
    "CRITERIO":   "jvm",
}

# Rotación de iconos por sección — cada slide dentro de la misma sección
# recibe un icono diferente para evitar la repetición visual.
SECTION_ICON_SETS: dict = {
    "GANCHO":     ["alert", "code", "gear"],
    "CONTEXTO":   ["clock", "network", "database"],
    "DECISION_1": ["jvm", "database", "code"],
    "DECISION_2": ["fanout", "jvm", "network"],
    "DECISION_3": ["network", "database", "gear"],
    "DECISION_4": ["database", "team", "alert"],
    "DECISION_5": ["fanout", "clock", "alert"],
    "DECISION_6": ["alert", "gear", "fanout"],
    "LEGADO":     ["jvm", "code", "database"],
    "CRITERIO":   ["code", "jvm", "gear"],
}

SECTION_LABELS = {
    "GANCHO":     "",
    "CONTEXTO":   "Contexto",
    "DECISION_1": "El Inicio",
    "DECISION_2": "La Expansión",
    "DECISION_3": "El Problema",
    "DECISION_4": "La Crisis",
    "DECISION_5": "El Intento",
    "DECISION_6": "El Colapso",
    "LEGADO":     "El Legado",
    "CRITERIO":   "Reflexión Final",
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


def _rewrite_slides(slides: list) -> list:
    ICONS = "database, code, server, cpu, globe, clock, gear, alert, network, rails, jvm, fanout, team, money, bullish, trending-down, calendar, statistics, manager, approval, document, expired, broken, workflow, lightbulb, activity"
    items = [{"i": i, "s": s["section"], "t": s["text"][:120]} for i, s in enumerate(slides)]

    print(f"[VisualAgent] Reescribiendo {len(slides)} slides con Claude...")
    try:
        msg = CLIENT.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            messages=[{"role": "user", "content": f"""Eres director creativo de un documental tech para YouTube en español.

Para cada slide tienes la sección y el texto literal que se está narrando.
Genera un displayText visual e impactante (máx 8 palabras) que NO sea transcripción literal:
sintetiza la idea clave del momento, usa sustantivos fuertes y datos concretos cuando los haya.
También elige el icono más representativo del contenido de ese slide.

Iconos disponibles: {ICONS}

Slides:
{json.dumps(items, ensure_ascii=False)}

Devuelve SOLO un JSON array sin texto adicional:
[{{"i": 0, "d": "frase visual", "ic": "icono"}}, ...]"""}],
        )
        text = msg.content[0].text.strip()
        rewrites = json.loads(text[text.index('['):text.rindex(']') + 1])
        rmap = {r["i"]: r for r in rewrites}
    except Exception as e:
        print(f"[VisualAgent] Reescritura fallida: {e}, usando displayText original.")
        return slides

    result = []
    for i, s in enumerate(slides):
        rw = rmap.get(i, {})
        result.append({
            **s,
            "displayText": rw.get("d", s.get("displayText", s["text"][:80])),
            "icon":        rw.get("ic", s.get("icon", "code")),
        })
    return result


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
            "lowerThird": SECTION_LABELS.get(section, section.replace("_", " ")) if count == 1 else "",
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
        messages=[{"role": "user", "content": f"""Eres un director creativo de documentales para YouTube en español.

Guion (primeros 3500 caracteres):
{script}

Secciones del video: GANCHO, CONTEXTO, DECISION_1, DECISION_2, DECISION_3, DECISION_4, DECISION_5, DECISION_6, LEGADO, CRITERIO

Iconos disponibles (elige el más representativo para cada sección basándote en el contenido real):
database, code, server, cpu, globe, clock, gear, alert, network, rails, jvm, fanout, team, money, bullish, trending-down, calendar, statistics, manager, approval, document, expired, broken, workflow, lightbulb, activity

Genera SOLO este JSON sin explicaciones adicionales:
{{
  "channel_header": "título corto dramático del video (máx 55 chars)",
  "date_range": "año_inicio – año_fin de la historia",
  "section_icons": {{
    "GANCHO": "icono",
    "CONTEXTO": "icono",
    "DECISION_1": "icono",
    "DECISION_2": "icono",
    "DECISION_3": "icono",
    "DECISION_4": "icono",
    "DECISION_5": "icono",
    "DECISION_6": "icono",
    "LEGADO": "icono",
    "CRITERIO": "icono"
  }},
  "gancho_icon": "icono del tema principal (database|rails|jvm|network|fanout|team|gear|alert|clock|code)",
  "intro_title": "nombre corto de la empresa o producto protagonista (máx 3 palabras)",
  "intro_subtitle1": "frase descriptiva del video (máx 8 palabras, qué fue o qué hizo)",
  "intro_subtitle2": "frase de contraste dramático (máx 7 palabras, el giro o la caída)",
  "gancho_stat": "el número o porcentaje más impactante de la historia (ej: –96%, $200B, 80%)",
  "gancho_stat_desc": "descripción corta del stat (máx 6 palabras en mayúsculas con ·, ej: Caída en valor · 2000 → 2010)",
  "intro_stat_line1": "oración que explica el stat (máx 12 palabras, número incluido)",
  "intro_stat_line2": "oración de contraste dramático que cierra la intro (máx 12 palabras)",
  "gancho_lines": [
    {{"text": "frase 1 impactante sobre el tema (dato o hecho concreto)", "from": 10, "size": 52, "color": "text", "weight": 300}},
    {{"text": "frase 2 corta y poderosa — máximo 8 palabras", "from": 50, "size": 68, "color": "accent", "weight": 700}},
    {{"text": "frase 3 que genera contraste o tensión", "from": 90, "size": 48, "color": "muted", "weight": 300}},
    {{"text": "frase 4 el giro dramático que engancha al viewer", "from": 130, "size": 44, "color": "text", "weight": 400}}
  ],
  "legado_title": "título breve y dramático para la sección de legado (máx 40 chars, ej: Java · Unix · Open Source)",
  "criterio_title": "título para la reflexión final (máx 30 chars, ej: Reflexión Final)",
  "legado_items": [
    {{"label": "nombre concreto del legado 1", "desc": "impacto real que dejó en el sector tech o en la industria"}},
    {{"label": "nombre concreto del legado 2", "desc": "impacto real que dejó"}},
    {{"label": "nombre concreto del legado 3", "desc": "impacto real que dejó o lección aprendida"}}
  ],
  "criterio_lines": [
    {{"text": "frase 1: plantea el dilema o reflexión central del video"}},
    {{"text": "frase 2: la conclusión poderosa y directa (esta es la más impactante)"}},
    {{"text": "frase 3: dicotomía final en formato: Concepto A  ·  vs  ·  Concepto B"}}
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
    enriched = _rewrite_slides(enriched)

    gancho_lines = claude_data.get("gancho_lines", _default_data()["gancho_lines"])
    visual_data = {
        "channel_header": claude_data.get("channel_header", "Neural Studio"),
        "date_range":     claude_data.get("date_range", ""),
        "gancho_lines":   gancho_lines,
        "legado_items":   claude_data.get("legado_items", _default_data()["legado_items"]),
        "criterio_lines": claude_data.get("criterio_lines", _default_data()["criterio_lines"]),
    }
    intro_data = {
        "title":     claude_data.get("intro_title", visual_data["channel_header"].split("·")[0].strip()),
        "subtitle1": claude_data.get("intro_subtitle1", gancho_lines[0]["text"] if gancho_lines else ""),
        "subtitle2": claude_data.get("intro_subtitle2", gancho_lines[2]["text"] if len(gancho_lines) > 2 else ""),
        "dateRange": claude_data.get("date_range", ""),
        "stat":      claude_data.get("gancho_stat", ""),
        "statDesc":  claude_data.get("gancho_stat_desc", ""),
        "statLine1": claude_data.get("intro_stat_line1", gancho_lines[0]["text"] if gancho_lines else ""),
        "statLine2": claude_data.get("intro_stat_line2", gancho_lines[3]["text"] if len(gancho_lines) > 3 else ""),
    }

    with open(slides_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    with open(visual_path, "w", encoding="utf-8") as f:
        json.dump(visual_data, f, ensure_ascii=False, indent=2)

    intro_path = os.path.join(folder, "intro_data.json")
    with open(intro_path, "w", encoding="utf-8") as f:
        json.dump(intro_data, f, ensure_ascii=False, indent=2)

    print("[VisualAgent] Listo.")


def _default_data():
    return {
        "channel_header": "Neural Studio",
        "date_range": "",
        "section_icons": DEFAULT_ICONS,
        "gancho_icon": "code",
        "gancho_stat": "–∞",
        "gancho_stat_desc": "El dato que lo cambió todo",
        "legado_title": "El Legado",
        "criterio_title": "Reflexión Final",
        "gancho_lines": [
            {"text": "Una historia que cambió todo.", "from": 10, "size": 52, "color": "text", "weight": 300},
            {"text": "Que nadie supo ver venir.", "from": 50, "size": 68, "color": "accent", "weight": 700},
            {"text": "Hasta que fue demasiado tarde.", "from": 90, "size": 48, "color": "muted", "weight": 300},
            {"text": "Esta es esa historia.", "from": 130, "size": 44, "color": "text", "weight": 400},
        ],
        "legado_items": [
            {"label": "Impacto tecnológico", "desc": "Su tecnología sobrevivió a la empresa que la creó"},
            {"label": "Lección de negocio", "desc": "Las decisiones técnicas tienen consecuencias décadas después"},
            {"label": "El patrón se repite", "desc": "La misma historia ocurre hoy en otras empresas"},
        ],
        "criterio_lines": [
            {"text": "La próxima vez que evalúes una decisión técnica crítica,"},
            {"text": "pregúntate si estás eligiendo por el sistema o por las personas."},
            {"text": "Deuda técnica gestionada  ·  vs  ·  Deuda técnica heredada"},
        ],
    }
