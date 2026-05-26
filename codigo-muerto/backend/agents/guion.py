import os
import httpx
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")

SEARCH_TOOL = {
    "name": "web_search",
    "description": (
        "Busca información real y verificada en internet. Úsala para obtener "
        "fechas exactas, cifras reales, nombres correctos y hechos verificables "
        "antes de escribir el guion. Puedes buscar en español o inglés."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "La consulta de búsqueda",
            }
        },
        "required": ["query"],
    },
}


def _search(query: str) -> str:
    try:
        resp = httpx.get(
            "https://serpapi.com/search",
            params={
                "q": query,
                "api_key": SERPAPI_KEY,
                "hl": "es",
                "num": 6,
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for r in data.get("organic_results", []):
            results.append(
                f"Título: {r.get('title', '')}\n"
                f"Contenido: {r.get('snippet', '')}\n"
                f"Fuente: {r.get('link', '')}"
            )
        return "\n\n---\n\n".join(results) if results else "Sin resultados para esa búsqueda."
    except Exception as e:
        return f"Error en búsqueda: {e}"


def _build_prompt(title: str, topic: str) -> str:
    return f"""Eres uno de los mejores guionistas de YouTube del mundo hispanohablante.
Has trabajado en canales que desde su primer video superaron el millón de vistas.
Tu especialidad son los documentales histórico-tecnológicos: sabes convertir una
decisión técnica aburrida en una historia que deja al espectador con la boca abierta.

Tu secreto: no informas, narras. Cada sección termina con una pregunta implícita
que obliga al espectador a seguir viendo. Usas el método "pero entonces" — cada
párrafo genera una consecuencia que nadie esperaba.

Tienes acceso a la herramienta web_search. DEBES usarla exhaustivamente.
Un guion con datos inventados o sin verificar destruye la credibilidad del canal.

PROTOCOLO DE INVESTIGACIÓN OBLIGATORIO — sigue este orden exacto:

FASE 1 — Contexto general (2-3 búsquedas):
  Busca el tema principal en español e inglés para obtener una visión amplia.
  Ejemplo: "Sun Microsystems historia" y "Sun Microsystems history timeline"

FASE 2 — Cifras y fechas críticas (3-4 búsquedas):
  Por cada número relevante que vayas a incluir (valoración, empleados, ventas,
  fechas de lanzamiento, precios de adquisición), haz una búsqueda específica
  para confirmarlo. Si dos fuentes discrepan, usa la más conservadora y menciónalo.
  Ejemplo: "Sun Microsystems valoración 2000 máximo", "Oracle adquiere Sun precio 2010"

FASE 3 — Anécdotas y personajes (2-3 búsquedas):
  Busca las historias humanas: frases célebres, decisiones polémicas, momentos
  exactos. Estas son las que hacen memorable el video.
  Ejemplo: "Scott McNealy frases controvertidas", "Java creación historia James Gosling"

FASE 4 — Verificación cruzada (1-2 búsquedas):
  Antes de escribir, busca "errores comunes sobre [tema]" o "[tema] myths debunked"
  para asegurarte de no repetir datos incorrectos que circulan en internet.

Mínimo 8 búsquedas en total. Sin excepción.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENCARGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tema: {topic}
Título: {title}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LONGITUD OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El guion narrado debe tener entre doce mil y quince mil caracteres.
Desarrolla cada sección con profundidad real: anécdotas concretas, fechas exactas,
nombres reales, cifras que sorprendan, citas que impacten.
Un guion corto o superficial no es aceptable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE ORO (no negociables)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOCABULARIO: español simple y cotidiano. El espectador promedio tiene dieciséis
años. Nada de tecnicismos innecesarios. Si debes usar un término técnico,
explícalo en la misma oración.

NÚMEROS: siempre en texto, nunca en dígitos.
  Correcto: "cuatro millones de dólares", "mil novecientos noventa y ocho",
            "el doble", "apenas el dos por ciento"
  Incorrecto: "4 millones", "1998", "3x", "2%"

SIGLAS: deletréalas con guiones o sustitúyelas por su significado.
  Correcto: "C-E-O", "I-A", "la Unión Europea", "el director ejecutivo"
  Incorrecto: "CEO", "AI", "UE"

TONO: documental de Netflix en español. Cercano, apasionado, con energía.
Como si le contaras algo increíble a tu mejor amigo que no puede creerlo.
Alterna frases cortas con frases largas para crear ritmo.
Usa preguntas retóricas para mantener la tensión: "¿Y sabes qué pasó después?"

CONECTORES DRAMÁTICOS: usa "pero entonces", "lo que nadie sabía era",
"el problema fue", "y aquí viene lo increíble", "lo que cambió todo fue".

ETIQUETAS DE ENTONACIÓN S2-Pro (muy importante):
El motor de voz que leerá este guion es Fish Audio S2-Pro. Entiende etiquetas
entre corchetes escritas en inglés para modular la voz en tiempo real.
Úsalas con inteligencia — solo en los momentos que realmente lo ameriten:
  [professional broadcast tone] — pon esta etiqueta UNA SOLA VEZ al inicio del guion
  [emphasis] — para cifras o palabras clave impactantes: "valía [emphasis] doscientos mil millones [emphasis] de dólares"
  [pause] — pausa dramática justo antes de una revelación importante
  [excited] — cuando describes un logro enorme o un giro inesperado positivo
  [serious] — en momentos de caída, fracaso o consecuencias graves
  [laughing] — si describes algo irónico o absurdo
No abuses de las etiquetas. Máximo una por párrafo. Van INLINE dentro del texto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOOD_VISUAL: [elige uno: urgente / nostálgico / técnico-frío / épico / dramático]

[GANCHO]
Seis a ocho oraciones. Abre con el hecho más sorprendente o la paradoja central
del tema. El espectador debe pensar "espera, ¿cómo es posible?" en los primeros
veinte segundos. No empieces con "Hoy vamos a hablar de...".

[CONTEXTO]
El mundo antes de que ocurriera esto. Quién era el protagonista, qué poder tenía,
por qué todos creían que era invencible. Tres párrafos mínimo.

[ASCENSO]
Cómo llegaron al pico. Los logros reales, los números que impresionaban,
la razón por la que todos en la industria los miraban. Dos o tres párrafos.

[DECISIÓN 1] — ponle un nombre dramático
Qué era exactamente. Por qué parecía una buena idea en ese momento.
Qué consecuencia real tuvo. Datos concretos. Mínimo tres párrafos.

[DECISIÓN 2] — ídem
[DECISIÓN 3] — ídem
[DECISIÓN 4] — ídem (si aplica)
[DECISIÓN 5] — ídem (si aplica)

[PUNTO DE QUIEBRE]
El momento exacto — día, mes, año si es posible — en que todo se derrumbó
o cambió para siempre. Una o dos frases que sean como un puñetazo.
Luego el desarrollo de qué ocurrió.

[CAÍDA O TRANSFORMACIÓN]
Qué pasó después. Cómo reaccionó el mundo. Qué perdieron o ganaron.
Datos de impacto real. Dos o tres párrafos.

[LEGADO]
Qué quedó de todo esto hoy. Cómo cambió la industria para siempre.
Qué usamos hoy gracias o a pesar de sus decisiones. Dos párrafos.

[CRITERIO FINAL]
La lección que el espectador se lleva. Concreta, aplicable, memorable.
Termina con una frase que quiera compartir. Uno o dos párrafos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANTE: Sigue el protocolo de investigación (mínimo 8 búsquedas) antes de escribir.
Cuando termines de investigar, escribe el guion DIRECTAMENTE.
La primera línea que escribas debe ser: MOOD_VISUAL: ...
NO escribas frases como "Tengo suficiente información", "Ahora escribo",
"Basándome en la investigación" ni ningún comentario previo.
Sin markdown, sin explicaciones, solo el guion en español neutro.

Si durante la escritura te das cuenta de que necesitas verificar un dato,
usa web_search aunque ya hayas empezado a escribir. La precisión va primero.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


def _build_prompt_en_UNUSED(title: str, topic: str, channel: dict) -> str:
    # Guardado aquí para referencia — se usa en phantom-directive/backend/agents/guion.py
    s = channel.get("sections", {})
    return f"""You are one of the best YouTube scriptwriters in the English-speaking world.
You have worked on channels that surpassed one million views from their very first video.
Your specialty is historical-tech documentaries: you turn a boring technical decision
into a story that leaves the viewer speechless.

Your secret: you don't inform, you narrate. Every section ends with an implicit question
that forces the viewer to keep watching. You use the "but then" method — each paragraph
generates a consequence nobody expected.

You have access to the web_search tool. You MUST use it exhaustively.
A script with invented or unverified data destroys the channel's credibility.

MANDATORY RESEARCH PROTOCOL — follow this exact order:

PHASE 1 — General context (2-3 searches):
  Search the main topic in English and other languages for a broad perspective.
  Example: "Sun Microsystems history" and "Sun Microsystems timeline collapse"

PHASE 2 — Critical figures and dates (3-4 searches):
  For every relevant number you plan to include (valuation, employees, sales,
  launch dates, acquisition prices), run a specific search to confirm it.
  If two sources disagree, use the more conservative figure and mention it.

PHASE 3 — Anecdotes and characters (2-3 searches):
  Search for human stories: famous quotes, controversial decisions, exact moments.
  These are what make the video memorable.

PHASE 4 — Cross-verification (1-2 searches):
  Before writing, search "common myths about [topic]" or "[topic] misconceptions"
  to avoid repeating incorrect data that circulates online.

Minimum 8 searches total. No exceptions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic: {topic}
Title: {title}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY LENGTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The narrated script must be between twelve thousand and fifteen thousand characters.
Develop each section with real depth: concrete anecdotes, exact dates,
real names, surprising figures, impactful quotes.
A short or superficial script is not acceptable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOLDEN RULES (non-negotiable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOCABULARY: simple, everyday English. The average viewer is sixteen years old.
No unnecessary jargon. If you must use a technical term, explain it in the same sentence.

NUMBERS: always in words, never in digits.
  Correct: "four billion dollars", "nineteen ninety-eight", "double", "barely two percent"
  Incorrect: "4 billion", "1998", "3x", "2%"

ACRONYMS: spell them out or replace with full meaning.
  Correct: "C-E-O", "A-I", "the European Union", "the chief executive"
  Incorrect: "CEO", "AI", "EU"

TONE: Netflix documentary in English. Conversational, passionate, with energy.
Like telling something incredible to your best friend who can't believe it.
Alternate short sentences with long ones to create rhythm.
Use rhetorical questions to maintain tension: "And do you know what happened next?"

DRAMATIC CONNECTORS: use "but then", "what nobody knew was",
"the problem was", "and here's the incredible part", "what changed everything was".

S2-Pro INTONATION TAGS (very important):
The voice engine that will read this script is Fish Audio S2-Pro. It understands
tags in square brackets written in English to modulate the voice in real time.
Use them intelligently — only in moments that truly merit it:
  [professional broadcast tone] — use this tag ONCE at the start of the script
  [emphasis] — for impactful key figures or words
  [pause] — dramatic pause just before an important reveal
  [excited] — when describing a huge achievement or unexpected positive twist
  [serious] — in moments of collapse, failure or grave consequences
  [laughing] — if describing something ironic or absurd
Don't overuse the tags. Maximum one per paragraph. They go INLINE within the text.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOOD_VISUAL: [choose one: urgent / nostalgic / cold-technical / epic / dramatic]

[{s['hook']}]
Six to eight sentences. Open with the most surprising fact or the central paradox
of the topic. The viewer must think "wait, how is that possible?" in the first
twenty seconds. Do NOT start with "Today we're going to talk about...".

[{s['context']}]
The world before this happened. Who the protagonist was, what power they had,
why everyone believed they were untouchable. At least three paragraphs.

[{s['rise']}]
How they reached the peak. The real achievements, the impressive numbers,
the reason everyone in the industry was watching them. Two or three paragraphs.

[{s['decision']} 1] — give it a dramatic name
What it was exactly. Why it seemed like a good idea at the time.
What real consequence it had. Concrete data. At least three paragraphs.

[{s['decision']} 2] — same
[{s['decision']} 3] — same
[{s['decision']} 4] — same (if applicable)
[{s['decision']} 5] — same (if applicable)

[{s['turning_point']}]
The exact moment — day, month, year if possible — when everything collapsed
or changed forever. One or two sentences like a punch.
Then the development of what happened.

[{s['fall']}]
What happened next. How the world reacted. What they lost or gained.
Real impact data. Two or three paragraphs.

[{s['legacy']}]
What remains of all this today. How the industry changed forever.
What we use today thanks to or despite their decisions. Two paragraphs.

[{s['criteria']}]
The lesson the viewer takes away. Concrete, applicable, memorable.
End with a sentence they'll want to share. One or two paragraphs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: Follow the research protocol (minimum 8 searches) before writing.
When you finish researching, write the script DIRECTLY.
The first line you write must be: MOOD_VISUAL: ...
Do NOT write phrases like "I have enough information", "Now I'll write",
"Based on my research" or any prior commentary.
No markdown, no explanations, just the script in plain English.

If during writing you realize you need to verify a fact,
use web_search even if you've already started writing. Accuracy comes first.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


def run(project_id: int, title: str, topic: str, folder: str, force: bool = False):
    full_path = os.path.join(folder, "full_script.txt")
    narration_path = os.path.join(folder, "narration.txt")

    if not force and os.path.exists(full_path) and os.path.exists(narration_path):
        print(f"[GuionAgent] Guion ya existe en {folder}, saltando llamada a Claude.")
        _save_mood(project_id, open(full_path, encoding="utf-8").read())
        return

    messages = [{"role": "user", "content": _build_prompt(title, topic)}]

    # Loop agéntico: Claude busca, obtiene resultados, escribe
    while True:
        response = CLIENT.messages.create(
            model="claude-opus-4-7",
            max_tokens=16000,
            tools=[SEARCH_TOOL],
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    print(f"[GuionAgent] Buscando: {block.input['query']}")
                    result = _search(block.input["query"])
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            messages.append({"role": "user", "content": tool_results})

        else:
            script = ""
            for block in response.content:
                if hasattr(block, "text"):
                    script += block.text
            break

    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "full_script.txt"), "w", encoding="utf-8") as f:
        f.write(script)

    narration = _extract_narration(script)
    with open(os.path.join(folder, "narration.txt"), "w", encoding="utf-8") as f:
        f.write(narration)

    _save_mood(project_id, script)


def _extract_narration(script: str) -> str:
    import re
    lines = script.split("\n")
    result = []
    in_script = False

    # Headers de sección: líneas que son SOLO [TEXTO EN MAYÚSCULAS]
    # Las etiquetas de emoción S2-Pro van inline dentro de oraciones y en minúsculas
    section_header = re.compile(r'^\[[A-ZÁÉÍÓÚÑ\s\d:°\/\-]+\]$')

    for line in lines:
        stripped = line.strip()

        if not in_script:
            if stripped.startswith("MOOD_VISUAL:") or section_header.match(stripped):
                in_script = True
            else:
                continue

        if not stripped:
            result.append("")
            continue
        if stripped.startswith("MOOD_VISUAL:"):
            continue
        if re.match(r'^\[ANIMACI[ÓO]N', stripped, re.IGNORECASE):
            continue
        # Solo eliminar líneas que son ÚNICAMENTE un header de sección en mayúsculas
        if section_header.match(stripped):
            continue

        result.append(stripped)

    return "\n".join(result).strip()


def _save_mood(project_id: int, script: str):
    import re
    from sqlmodel import Session
    from database import engine
    from models import Project

    match = re.search(r'MOOD_VISUAL:\s*(.+)', script)
    if not match:
        return
    mood = match.group(1).strip()
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if project:
            project.mood = mood
            session.add(project)
            session.commit()
