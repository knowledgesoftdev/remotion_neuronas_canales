import os
import json
import anthropic
from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine
from models import ChannelStats, VideoMetrics, Project

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# Benchmark del nicho: documental tech/negocios en español
# Fuente: análisis NexLev — Money Legends, TheCollapseCo, JunkBondInvestor
INDUSTRY_CTR_BENCHMARK = 4.0      # %
INDUSTRY_RETENTION_BENCHMARK = 40.0  # %
CTR_ALERT_THRESHOLD = 2.0          # Alerta si CTR < 2% (independiente del canal avg)


def suggest_video_titles(session: Session) -> dict:
    from models import SuggestedTitle

    # Return cached pending suggestions without calling Claude
    pending = session.exec(
        select(SuggestedTitle).where(SuggestedTitle.used == False)
    ).all()
    if pending:
        return {"suggestions": [
            {"id": s.id, "title": s.title, "topic": s.topic, "reason": s.reason}
            for s in pending
        ]}

    # All 5 used (or first time) → generate new batch
    stats = session.exec(
        select(ChannelStats).order_by(ChannelStats.fetched_at.desc())
    ).first()
    videos = session.exec(select(VideoMetrics).order_by(VideoMetrics.views.desc())).all()
    projects = session.exec(select(Project)).all()
    context = _build_context(stats, videos)

    # Canal B: videos marcados explícitamente como de bajo rendimiento en LatAm
    canal_b = [v for v in videos if v.is_canal_b and v.title]

    existing = []
    for v in videos:
        if v.title:
            existing.append(f"- {v.title}  [video publicado]")
    for p in projects:
        existing.append(f"- {p.title}  [proyecto en sistema]")
    avoid_block = ""
    if existing:
        avoid_block = "\n\nTemas YA USADOS — NO repitas ninguno:\n" + "\n".join(existing)

    if canal_b:
        canal_b_titles = [v.title for v in canal_b]
        avoid_block += (
            "\n\nTemas CANAL B (bajo rendimiento en LatAm, NO sugerir ni similares):\n"
            + "\n".join(f"- {t}" for t in canal_b_titles)
            + "\n→ Estos temas tienen baja resonancia en el mercado hispanohablante. "
            "Evita empresas/productos con poca presencia en Latinoamérica."
        )

    msg = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"""Eres un estratega de contenido para YouTube especializado en tecnología e historia.

Datos del canal:
{context}{avoid_block}

Basándote en el rendimiento histórico del canal, sugiere 5 ideas NUEVAS de videos que no hayan sido cubiertas antes.
Para cada idea incluye:
- Título (máximo 60 caracteres, formato: empresa/tecnología + decisión + giro dramático)
- Tema central (1 línea)
- Por qué funcionaría según los datos del canal

Devuelve SOLO un JSON con este formato:
[
  {{"title": "...", "topic": "...", "reason": "..."}},
  ...
]"""}]
    )

    try:
        text = msg.content[0].text.strip()
        text = text[text.index('['):text.rindex(']') + 1]
        ideas = json.loads(text)
        result = []
        for idea in ideas[:5]:
            s = SuggestedTitle(
                title=idea.get("title", ""),
                topic=idea.get("topic", ""),
                reason=idea.get("reason", ""),
            )
            session.add(s)
            session.commit()
            session.refresh(s)
            result.append({"id": s.id, "title": s.title, "topic": s.topic, "reason": s.reason})
        return {"suggestions": result}
    except Exception:
        return {"suggestions": []}


def check_performance_alerts(session: Session) -> dict:
    """
    Detecta videos publicados hace 2+ días con rendimiento bajo.
    Compara contra el benchmark del nicho (4% CTR, 40% retención),
    no solo contra el promedio del canal (que también es bajo).
    """
    videos = session.exec(select(VideoMetrics)).all()
    projects = session.exec(
        select(Project).where(Project.status == "done")
    ).all()

    if not videos or not projects:
        return {
            "alerts": [],
            "ref_ctr": INDUSTRY_CTR_BENCHMARK,
            "ref_retention": INDUSTRY_RETENTION_BENCHMARK,
        }

    alerts = []
    cutoff = datetime.utcnow() - timedelta(days=2)

    for project in projects:
        if not project.youtube_video_id:
            continue
        video = next((v for v in videos if v.youtube_video_id == project.youtube_video_id), None)
        if not video:
            continue
        publish_date = video.published_at.replace(tzinfo=None) if video.published_at else None
        if not publish_date or publish_date > cutoff:
            continue
        if video.views < 10:
            continue

        issues = []
        suggestions = []

        # Alerta de CTR: compara contra umbral absoluto Y benchmark
        if video.ctr > 0:
            if video.ctr < CTR_ALERT_THRESHOLD:
                gap = INDUSTRY_CTR_BENCHMARK / max(video.ctr, 0.1)
                issues.append(
                    f"CTR {video.ctr:.1f}% — {gap:.0f}x por debajo del benchmark del nicho ({INDUSTRY_CTR_BENCHMARK}%)"
                )
                suggestions.append("cambiar_miniatura")
                if video.ctr < 0.8:
                    suggestions.append("cambiar_titulo")

        # Alerta de retención: compara contra benchmark
        if video.avg_view_percentage > 0 and video.avg_view_percentage < 20.0:
            issues.append(
                f"Retención {video.avg_view_percentage:.1f}% — el gancho de los primeros 90s falla "
                f"(benchmark: {INDUSTRY_RETENTION_BENCHMARK}%)"
            )
            suggestions.append("mejorar_gancho")
        elif video.avg_view_percentage > 0 and video.avg_view_percentage < 30.0:
            issues.append(
                f"Retención {video.avg_view_percentage:.1f}% — mejorable "
                f"(benchmark: {INDUSTRY_RETENTION_BENCHMARK}%)"
            )

        if issues:
            alerts.append({
                "project_id": project.id,
                "title": project.title,
                "youtube_video_id": project.youtube_video_id,
                "issues": issues,
                "suggestions": list(set(suggestions)),
                "ctr": video.ctr,
                "retention": video.avg_view_percentage,
                "ref_ctr": INDUSTRY_CTR_BENCHMARK,
                "ref_retention": INDUSTRY_RETENTION_BENCHMARK,
            })

    return {
        "alerts": alerts,
        "ref_ctr": INDUSTRY_CTR_BENCHMARK,
        "ref_retention": INDUSTRY_RETENTION_BENCHMARK,
    }


def generate_improvement_suggestions(project_id: int, session: Session) -> dict:
    """Genera sugerencias concretas para mejorar un video con bajo rendimiento."""
    project = session.get(Project, project_id)
    if not project or not project.folder:
        return {"error": "Proyecto no encontrado"}

    script_path = os.path.join(project.folder, "full_script.txt")
    if not os.path.exists(script_path):
        return {"error": "Guion no encontrado"}

    with open(script_path, encoding="utf-8") as f:
        script = f.read()[:4000]

    videos = session.exec(select(VideoMetrics)).all()
    scored = [v for v in videos if v.ctr > 0 and v.title]
    scored.sort(key=lambda v: v.ctr * v.avg_view_percentage, reverse=True)
    top_titles = [v.title for v in scored[:3]]

    msg = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"""El video "{project.title}" lleva más de 2 días publicado y tiene bajo rendimiento.

Títulos de los mejores videos del canal (referencia de estilo):
{chr(10).join(f'- {t}' for t in top_titles)}

Guion del video con bajo rendimiento (primeras 4000 caracteres):
{script}

Genera en formato JSON:
{{
  "titulos_alternativos": ["título 1", "título 2", "título 3"],
  "mejora_gancho": "reescribe las primeras 3 oraciones del guion para que sean más impactantes",
  "prompt_miniatura_alternativo": "nuevo prompt en inglés para una miniatura diferente",
  "razon": "explicación breve de por qué el video puede estar fallando"
}}

Solo el JSON, sin explicaciones."""}]
    )

    try:
        text = msg.content[0].text.strip()
        start = text.index('{')
        end = text.rindex('}') + 1
        return json.loads(text[start:end])
    except Exception as e:
        return {"error": str(e)}


def _build_context(stats: ChannelStats | None, videos: list[VideoMetrics]) -> str:
    if not stats:
        return "Canal nuevo sin datos históricos todavía."

    scored = sorted(
        [v for v in videos if v.title],
        key=lambda v: v.ctr * v.avg_view_percentage,
        reverse=True
    )[:5]

    lines = [
        f"Suscriptores: {stats.subscribers:,}",
        f"Vistas totales: {stats.total_views:,}",
        f"CTR promedio del canal: {stats.avg_ctr:.1f}%",
        f"Retención promedio: {stats.avg_retention:.1f}s",
        "",
        "Top 5 videos por CTR × retención:",
    ]
    for v in scored:
        lines.append(
            f"  \"{v.title}\" — CTR: {v.ctr:.1f}% | Retención: {v.avg_view_percentage:.1f}% | Vistas: {v.views:,}"
        )

    return "\n".join(lines)
