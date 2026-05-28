import os
import base64
import anthropic

_CLIENT = None


def _client() -> anthropic.Anthropic:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    return _CLIENT


def _find_thumbnail(folder: str) -> str | None:
    mini_dir = os.path.join(folder, "miniatura")
    if not os.path.isdir(mini_dir):
        return None
    for f in os.listdir(mini_dir):
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            return os.path.join(mini_dir, f)
    return None


def _encode_image(path: str) -> tuple[str, str]:
    ext = os.path.splitext(path)[1].lower()
    media_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_map.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return media_type, data


def get_thumbnail_patterns() -> str:
    """
    Busca las miniaturas con mayor CTR del canal, las analiza con Claude Vision
    y devuelve un bloque de texto con los patrones visuales ganadores.
    Retorna "" si no hay suficiente data (< 2 miniaturas con CTR conocido).
    """
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import VideoMetrics, Project

        with Session(engine) as session:
            videos = session.exec(select(VideoMetrics)).all()
            projects = session.exec(select(Project)).all()

        project_map = {p.id: p for p in projects}

        candidates = []
        for v in videos:
            if not v.project_id or v.ctr <= 0:
                continue
            project = project_map.get(v.project_id)
            if not project or not project.folder:
                continue
            thumb_path = _find_thumbnail(project.folder)
            if not thumb_path:
                continue
            candidates.append({
                "title": v.title,
                "ctr": v.ctr,
                "retention_pct": v.avg_view_percentage,
                "thumb_path": thumb_path,
            })

        if len(candidates) < 2:
            return ""

        candidates.sort(key=lambda x: x["ctr"], reverse=True)
        top = candidates[:3]

        return _analyze_with_vision(top)

    except Exception as e:
        print(f"[ThumbnailVision] Error: {e}")
        return ""


def _analyze_with_vision(thumbnails: list[dict]) -> str:
    content = []

    intro = (
        "Eres un experto en miniaturas de YouTube para canales de historia tecnológica en español. "
        "Analiza las siguientes miniaturas que han obtenido el MAYOR CTR en este canal. "
        "Identifica los patrones visuales comunes: colores dominantes, estilo del texto, "
        "composición, elementos visuales, expresiones o elementos de shock, contraste, "
        "y cualquier patrón que se repita entre las miniaturas exitosas. "
        "Sé específico y conciso. El análisis se usará para guiar la creación de la próxima miniatura."
    )
    content.append({"type": "text", "text": intro})

    for i, t in enumerate(thumbnails, 1):
        try:
            media_type, data = _encode_image(t["thumb_path"])
            content.append({
                "type": "text",
                "text": f"\nMiniatura #{i} — \"{t['title']}\" | CTR: {t['ctr']}% | Retención: {t['retention_pct']}%"
            })
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": data},
            })
        except Exception as e:
            print(f"[ThumbnailVision] No se pudo cargar imagen {t['thumb_path']}: {e}")

    content.append({
        "type": "text",
        "text": (
            "\nResponde SOLO con un bloque de patrones visuales en este formato:\n\n"
            "PATRONES VISUALES DE LAS MINIATURAS CON MAYOR CTR:\n"
            "- [patrón 1]\n"
            "- [patrón 2]\n"
            "...\n\n"
            "RECOMENDACIÓN PARA LA PRÓXIMA MINIATURA:\n"
            "[2-3 frases concretas sobre qué replicar]"
        )
    })

    msg = _client().messages.create(
        model="claude-opus-4-7",
        max_tokens=600,
        messages=[{"role": "user", "content": content}],
    )

    return msg.content[0].text.strip()
