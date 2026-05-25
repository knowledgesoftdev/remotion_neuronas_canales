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

Tienes acceso a la herramienta web_search. DEBES usarla para investigar el tema
antes de escribir. Busca fechas exactas, cifras reales, nombres correctos,
anécdotas verificables. Un guion con datos inventados no es aceptable.
Haz entre tres y seis búsquedas para cubrir los aspectos más importantes del tema.

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
IMPORTANTE: Primero investiga con web_search cuantas veces necesites.
Cuando termines de investigar, escribe el guion DIRECTAMENTE.
La primera línea que escribas debe ser: MOOD_VISUAL: ...
NO escribas frases como "Tengo suficiente información", "Ahora escribo",
"Basándome en la investigación" ni ningún comentario previo.
Sin markdown, sin explicaciones, solo el guion en español neutro.
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
