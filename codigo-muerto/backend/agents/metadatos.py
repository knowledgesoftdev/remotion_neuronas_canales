import os
import json
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def run(project_id: int, folder: str):
    script_path = os.path.join(folder, "full_script.txt")
    sequences_path = os.path.join(folder, "sequences.ts")

    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    timestamps = _parse_timestamps(sequences_path)
    canal_context = _get_canal_context()

    from services.thumbnail_vision import get_thumbnail_patterns
    thumbnail_patterns = get_thumbnail_patterns()

    msg = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": _build_prompt(script, timestamps, canal_context, thumbnail_patterns),
        }]
    )

    output_path = os.path.join(folder, "metadatos.txt")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(msg.content[0].text)

    # Extraer prompt de miniatura a archivo aparte
    _extract_miniatura_prompt(msg.content[0].text, folder)


def _get_canal_context() -> str:
    """Obtiene los mejores videos del canal por CTR × retención para informar la metadata."""
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import VideoMetrics

        with Session(engine) as session:
            videos = session.exec(select(VideoMetrics)).all()

        if not videos:
            return ""

        # Score = CTR × (retención%) — prioriza videos que convierten Y retienen
        scored = []
        for v in videos:
            if v.title and v.views > 0:
                score = v.ctr * v.avg_view_percentage
                scored.append({
                    "title": v.title,
                    "ctr": v.ctr,
                    "retention_pct": v.avg_view_percentage,
                    "views": v.views,
                    "score": round(score, 2),
                })

        if not scored:
            return ""

        scored.sort(key=lambda x: x["score"], reverse=True)
        top = scored[:5]

        lines = ["ANÁLISIS DEL CANAL (videos con mejor CTR × retención):"]
        for i, v in enumerate(top, 1):
            lines.append(
                f"{i}. \"{v['title']}\" — "
                f"CTR: {v['ctr']}% | Retención: {v['retention_pct']}% | Vistas: {v['views']:,}"
            )

        # Promedio del canal vs benchmark de industria
        avg_ctr = sum(v["ctr"] for v in scored) / len(scored)
        avg_ret = sum(v["retention_pct"] for v in scored) / len(scored)
        lines.append(f"\nPromedio actual del canal → CTR: {avg_ctr:.1f}% | Retención: {avg_ret:.1f}%")
        lines.append(f"Benchmark del nicho (documental tech español) → CTR: 4.0% | Retención: 40%")
        lines.append(
            f"BRECHA A CERRAR: el CTR debe multiplicarse x{4.0/max(avg_ctr,0.1):.0f} "
            f"para alcanzar el benchmark. La miniatura es la palanca más crítica."
        )
        lines.append(
            "\nPatrón de títulos ganadores: empresa o tecnología conocida globalmente + "
            "cifra específica (%, $) + consecuencia inesperada o dramática en ≤55 caracteres."
        )

        return "\n".join(lines)

    except Exception as e:
        print(f"[MetadatosAgent] No se pudo cargar contexto del canal: {e}")
        return ""


def _build_prompt(script: str, timestamps: dict, canal_context: str, thumbnail_patterns: str = "") -> str:
    context_block = f"""
{canal_context}

Con base en este análisis, aplica los patrones que mejor funcionan en este canal:
- El título debe seguir el formato de los videos más exitosos
- La descripción debe tener el mismo gancho energético
- El prompt de miniatura debe replicar el estilo visual que genera más clics
""" if canal_context else ""

    thumbnail_block = f"""
{thumbnail_patterns}

Al generar el PROMPT DE MINIATURA, replica estos patrones visuales exactamente.
""" if thumbnail_patterns else ""

    return f"""Eres un estratega de contenido YouTube especializado en canales de documentales tecnológicos hispanohablantes.
Tu misión es generar metadata que maximice CTR y retención basándose en el historial real del canal.
{context_block}{thumbnail_block}
GUION DEL VIDEO:
{script[:6000]}

TIMESTAMPS DE SECCIONES:
{json.dumps(timestamps, ensure_ascii=False, indent=2)}

Genera la metadata con este formato EXACTO — sin agregar texto fuera de los bloques:

================================================================
TÍTULO
================================================================
[Máximo 60 caracteres. Usa el patrón ganador del canal: empresa conocida + decisión + giro dramático.
Ejemplo del mejor video del canal: "Kodak inventó la cámara digital — y la enterró"]

================================================================
DESCRIPCIÓN
================================================================
[Gancho de 2-3 líneas que genere curiosidad inmediata]

[Desarrollo: qué aprenderá el espectador, por qué importa]

📌 CAPÍTULOS
[Timestamps reales en formato MM:SS — uno por cada sección del guion]

🔔 Suscríbete para más historias de tecnología que cambiaron el mundo.

================================================================
ETIQUETAS
================================================================
[Etiquetas separadas por comas. Máximo 500 caracteres. Mezcla: tema específico, empresa, tecnología, historia tech]

================================================================
HASHTAGS
================================================================
[15 hashtags en español relevantes al tema]

================================================================
MINIATURA — PROMPT
================================================================
[Prompt en inglés para generar la miniatura con IA.

REGLA CRÍTICA: el CTR actual del canal es 0.72% cuando el benchmark del nicho es 4%.
La miniatura es la causa principal. Sigue esta receta exacta sin desvíos:

COMPOSICIÓN (no negociable):
- Fondo oscuro puro: negro profundo o gris muy oscuro (#0a0a0a o #111111)
- UN solo elemento visual hero a la izquierda: el logo o producto icónico de la empresa,
  visualmente dañado/destruido/fragmentado. No añadas humo Y chispas Y polvo simultáneamente —
  elige UNO de esos efectos de destrucción.
- Texto a la derecha: EXACTAMENTE 2-3 palabras en inglés o español SIN tildes NI caracteres
  especiales. Ejemplo aceptable: "SE SUICIDO", "EL COLAPSO", "$99B PERDIDOS", "LA TRAICION"
- Sin stock charts, sin emojis, sin flechas, sin elementos decorativos adicionales.

TEXTO EN LA MINIATURA (crítico para CTR):
- Fuente: bold sans-serif, blanco (#FFFFFF) con contorno negro de 3px O amarillo (#FFE000)
- Tamaño: ocupa el 40-50% de la altura del área de texto
- Legible en miniatura de 120×90px (vista mobile)

PALETA:
- Fondo: negro (#0a0a0a)
- Texto principal: blanco (#FFFFFF) o amarillo (#FFE000) — elige uno, no ambos
- Acento: rojo sangre (#CC0000) solo para el elemento visual (el logo dañado)
- Sin gradientes complejos, sin colores adicionales

ESTILO TÉCNICO:
- Cinematic, photorealistic 4K, alta nitidez, film grain sutil
- Iluminación dramática lateral en el elemento visual
- Regla de tercios: elemento visual izquierdo, texto derecho
- Formato final: YouTube thumbnail 1280×720

PROHIBIDO en este prompt:
- Más de 3 elementos simultáneos de destrucción (humo + chispas + polvo + embers = NO)
- Texto con caracteres especiales en español (tildes, ñ, comillas tipográficas)
- Más de 3 palabras en la miniatura
- Fondos con gradientes de color o texturas complejas]"""


def _parse_timestamps(sequences_path: str) -> dict:
    import re
    result = {}
    if not os.path.exists(sequences_path):
        return result
    with open(sequences_path, "r", encoding="utf-8") as f:
        content = f.read()
    for match in re.finditer(r'(\w+)\s*:\s*\{\s*from:\s*(\d+),\s*duration:\s*(\d+)', content):
        key = match.group(1)
        from_frame = int(match.group(2))
        seconds = from_frame // 30
        m, s = divmod(seconds, 60)
        result[key] = f"{m}:{s:02d}"
    return result


def _extract_miniatura_prompt(content: str, folder: str):
    import re
    match = re.search(
        r'MINIATURA.*?PROMPT\s*={3,}\s*\n(.*?)(?:={3,}|$)',
        content, re.DOTALL | re.IGNORECASE
    )
    if match:
        prompt = match.group(1).strip()
        with open(os.path.join(folder, "prompt_miniatura.txt"), "w", encoding="utf-8") as f:
            f.write(prompt)
