import os
import json
import anthropic
from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine
from models import ChannelStats, VideoMetrics, Project

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


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

    existing = []
    for v in videos:
        if v.title:
            existing.append(f"- {v.title}  [published video]")
    for p in projects:
        existing.append(f"- {p.title}  [project in system]")
    avoid_block = ""
    if existing:
        avoid_block = "\n\nALREADY USED topics — do NOT repeat any:\n" + "\n".join(existing)

    msg = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"""You are a YouTube content strategist specialized in technology and history.

Channel data:
{context}{avoid_block}

Based on the channel's historical performance, suggest 5 NEW video ideas that have not been covered before.
For each idea include:
- Title (maximum 60 characters, format: company/technology + decision + dramatic twist)
- Core topic (1 line)
- Why it would work based on the channel's data

Return ONLY a JSON with this format:
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
    Detecta videos publicados hace 2+ días con rendimiento bajo
    y genera sugerencias de mejora comparando con los mejores videos del canal.
    """
    videos = session.exec(select(VideoMetrics)).all()
    projects = session.exec(
        select(Project).where(Project.status == "done")
    ).all()

    if not videos or not projects:
        return {"alerts": []}

    # Métricas de referencia: top 3 por score
    scored = [v for v in videos if v.ctr > 0 and v.avg_view_percentage > 0]
    if not scored:
        return {"alerts": []}

    scored.sort(key=lambda v: v.ctr * v.avg_view_percentage, reverse=True)
    ref_ctr = sum(v.ctr for v in scored[:3]) / min(3, len(scored))
    ref_ret = sum(v.avg_view_percentage for v in scored[:3]) / min(3, len(scored))

    alerts = []
    cutoff = datetime.utcnow() - timedelta(days=2)

    for project in projects:
        if not project.youtube_video_id:
            continue
        # Buscar el video en métricas
        video = next((v for v in videos if v.youtube_video_id == project.youtube_video_id), None)
        if not video:
            continue
        # Solo analizar si fue publicado hace 2+ días (usamos updated_at como proxy)
        if project.updated_at > cutoff:
            continue

        issues = []
        suggestions = []

        if video.ctr < ref_ctr * 0.7:
            issues.append(f"CTR bajo ({video.ctr:.1f}% vs {ref_ctr:.1f}% de referencia)")
            suggestions.append("cambiar_titulo")
            suggestions.append("cambiar_miniatura")

        if video.avg_view_percentage < ref_ret * 0.7:
            issues.append(f"Retención baja ({video.avg_view_percentage:.1f}% vs {ref_ret:.1f}% de referencia)")
            suggestions.append("mejorar_gancho")

        if issues:
            alerts.append({
                "project_id": project.id,
                "title": project.title,
                "youtube_video_id": project.youtube_video_id,
                "issues": issues,
                "suggestions": suggestions,
                "ctr": video.ctr,
                "retention": video.avg_view_percentage,
                "ref_ctr": round(ref_ctr, 1),
                "ref_retention": round(ref_ret, 1),
            })

    return {"alerts": alerts, "ref_ctr": round(ref_ctr, 1), "ref_retention": round(ref_ret, 1)}


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
        messages=[{"role": "user", "content": f"""The video "{project.title}" has been published for more than 2 days and is underperforming.

Titles of the channel's best-performing videos (style reference):
{chr(10).join(f'- {t}' for t in top_titles)}

Script of the underperforming video (first 4000 characters):
{script}

Generate in JSON format:
{{
  "titulos_alternativos": ["title 1", "title 2", "title 3"],
  "mejora_gancho": "rewrite the first 3 sentences of the script to make them more impactful",
  "prompt_miniatura_alternativo": "new English prompt for a different thumbnail",
  "razon": "brief explanation of why the video might be underperforming"
}}

JSON only, no explanations."""}]
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
        return "New channel with no historical data yet."

    scored = sorted(
        [v for v in videos if v.title],
        key=lambda v: v.ctr * v.avg_view_percentage,
        reverse=True
    )[:5]

    lines = [
        f"Subscribers: {stats.subscribers:,}",
        f"Total views: {stats.total_views:,}",
        f"Channel avg CTR: {stats.avg_ctr:.1f}%",
        f"Avg retention: {stats.avg_retention:.1f}s",
        "",
        "Top 5 videos by CTR × retention:",
    ]
    for v in scored:
        lines.append(
            f"  \"{v.title}\" — CTR: {v.ctr:.1f}% | Retention: {v.avg_view_percentage:.1f}% | Views: {v.views:,}"
        )

    return "\n".join(lines)
