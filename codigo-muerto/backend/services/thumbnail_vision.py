import os
import base64
import tempfile
import httpx
import anthropic

_CLIENT = None

# Benchmark de industria: nicho documental tech/negocios en español
INDUSTRY_CTR_BENCHMARK = 4.0
INDUSTRY_RETENTION_BENCHMARK = 40.0


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


def _download_yt_thumbnail(video_id: str) -> bytes | None:
    """Descarga la miniatura de YouTube directamente a memoria. Intenta máxima calidad primero."""
    for quality in ("maxresdefault", "hqdefault", "mqdefault"):
        url = f"https://i.ytimg.com/vi/{video_id}/{quality}.jpg"
        try:
            resp = httpx.get(url, timeout=10, follow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 5000:
                return resp.content
        except Exception:
            continue
    return None


def _encode_image(path: str) -> tuple[str, str]:
    ext = os.path.splitext(path)[1].lower()
    media_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_map.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return media_type, data


def _encode_bytes(data: bytes) -> tuple[str, str]:
    return "image/jpeg", base64.standard_b64encode(data).decode("utf-8")


def get_thumbnail_patterns() -> str:
    """
    Analiza las miniaturas con mejor score (CTR × retención) de TODOS los videos del canal,
    incluyendo los que no tienen carpeta local (descarga desde YouTube).
    Retorna un bloque de patrones visuales para guiar la próxima miniatura.
    Retorna "" si no hay suficiente data (< 2 videos con CTR > 0).
    """
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import VideoMetrics, Project

        with Session(engine) as session:
            videos = session.exec(select(VideoMetrics)).all()
            projects = session.exec(select(Project)).all()

        project_map = {p.id: p for p in projects}

        # Usar TODOS los videos con CTR conocido, no solo los del sistema
        candidates = []
        for v in videos:
            if v.ctr <= 0 or not v.youtube_video_id:
                continue
            # Score combinado: penaliza alto CTR con baja retención
            score = v.ctr * max(v.avg_view_percentage, 1.0)
            candidates.append({
                "title": v.title or v.youtube_video_id,
                "ctr": v.ctr,
                "retention_pct": v.avg_view_percentage,
                "score": score,
                "youtube_video_id": v.youtube_video_id,
                "project_id": v.project_id,
            })

        if len(candidates) < 2:
            return ""

        # Top 5 por score combinado
        candidates.sort(key=lambda x: x["score"], reverse=True)
        top = candidates[:5]

        # Resolver imagen para cada candidato
        resolved = []
        for c in top:
            image_data = None
            media_type = "image/jpeg"

            # 1. Intentar miniatura local si hay proyecto vinculado
            project = project_map.get(c["project_id"]) if c["project_id"] else None
            if project and project.folder:
                local_path = _find_thumbnail(project.folder)
                if local_path:
                    try:
                        media_type, image_data = _encode_image(local_path)
                    except Exception:
                        pass

            # 2. Fallback: descargar desde YouTube
            if not image_data:
                raw = _download_yt_thumbnail(c["youtube_video_id"])
                if raw:
                    media_type, image_data = _encode_bytes(raw)

            if image_data:
                resolved.append({**c, "media_type": media_type, "image_data": image_data})

        if len(resolved) < 2:
            return ""

        return _analyze_with_vision(resolved)

    except Exception as e:
        print(f"[ThumbnailVision] Error: {e}")
        return ""


def _analyze_with_vision(thumbnails: list[dict]) -> str:
    content = []

    intro = (
        f"Eres un experto en CTR de YouTube para canales de historia tecnológica en español. "
        f"El benchmark del nicho es CTR {INDUSTRY_CTR_BENCHMARK}% y retención {INDUSTRY_RETENTION_BENCHMARK}%. "
        f"Este canal tiene CTR promedio de 0.72% — necesita multiplicarlo x5. "
        f"Analiza las siguientes miniaturas ordenadas de mayor a menor score (CTR × retención). "
        f"Identifica con precisión: paleta de colores exacta, cantidad de palabras en el texto, "
        f"posición del texto, elemento visual principal, nivel de simplicidad vs complejidad, "
        f"presencia o ausencia de rostros, uso de números/cifras, contraste de texto. "
        f"Sé específico. El análisis debe permitir replicar exactamente lo que funciona."
    )
    content.append({"type": "text", "text": intro})

    for i, t in enumerate(thumbnails, 1):
        content.append({
            "type": "text",
            "text": (
                f"\nMiniatura #{i} — \"{t['title']}\"\n"
                f"CTR: {t['ctr']}% | Retención: {t['retention_pct']}% | Score: {t['score']:.1f}"
            )
        })
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": t["media_type"], "data": t["image_data"]},
        })

    content.append({
        "type": "text",
        "text": (
            "\nResponde SOLO con este formato exacto:\n\n"
            "PATRONES VISUALES GANADORES (CTR x retención):\n"
            "- [patrón específico]\n"
            "- [patrón específico]\n"
            "...\n\n"
            "LO QUE NO FUNCIONA (miniaturas con score bajo):\n"
            "- [elemento a evitar]\n"
            "...\n\n"
            "RECETA PARA LA PRÓXIMA MINIATURA:\n"
            "[Instrucciones concretas de 3-4 líneas: colores exactos, cantidad de palabras, "
            "elemento visual, composición. Sin ambigüedad.]"
        )
    })

    msg = _client().messages.create(
        model="claude-opus-4-7",
        max_tokens=800,
        messages=[{"role": "user", "content": content}],
    )

    return msg.content[0].text.strip()
