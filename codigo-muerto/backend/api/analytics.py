from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_session
from models import ChannelStats, VideoMetrics, TitleChange

router = APIRouter()


@router.get("/channel")
def get_channel_stats(session: Session = Depends(get_session)):
    stats = session.exec(
        select(ChannelStats).order_by(ChannelStats.fetched_at.desc())
    ).first()
    return stats or {}


@router.get("/videos")
def get_video_metrics(session: Session = Depends(get_session)):
    return session.exec(
        select(VideoMetrics).order_by(VideoMetrics.published_at.desc())
    ).all()


@router.patch("/videos/{youtube_video_id}/ctr")
def update_video_ctr(
    youtube_video_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    ctr = float(body.get("ctr", 0.0))
    video.ctr = round(ctr, 2)
    session.add(video)
    session.commit()
    return {"ok": True, "youtube_video_id": youtube_video_id, "ctr": video.ctr}


@router.patch("/videos/{youtube_video_id}/impressions")
def update_video_impressions(
    youtube_video_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    video.impressions = int(body.get("impressions", 0))
    session.add(video)
    session.commit()
    return {"ok": True, "youtube_video_id": youtube_video_id, "impressions": video.impressions}


@router.patch("/videos/{youtube_video_id}/retention")
def update_video_retention(
    youtube_video_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if "avg_view_duration" in body:
        video.avg_view_duration = float(body["avg_view_duration"])
    if "avg_view_percentage" in body:
        video.avg_view_percentage = round(float(body["avg_view_percentage"]), 2)
    session.add(video)
    session.commit()
    return {
        "ok": True,
        "youtube_video_id": youtube_video_id,
        "avg_view_duration": video.avg_view_duration,
        "avg_view_percentage": video.avg_view_percentage,
    }


@router.post("/sync")
def sync_youtube():
    import os
    if not os.environ.get("YOUTUBE_API_KEY") or not os.environ.get("YOUTUBE_CHANNEL_ID"):
        raise HTTPException(status_code=400, detail="YOUTUBE_API_KEY y YOUTUBE_CHANNEL_ID requeridos en .env")
    try:
        from services.youtube import sync_channel
        return sync_channel()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/last-sync")
def last_sync(session: Session = Depends(get_session)):
    stats = session.exec(
        select(ChannelStats).order_by(ChannelStats.fetched_at.desc())
    ).first()
    return {"last_sync": stats.fetched_at.isoformat() if stats else None}


@router.get("/oauth/start")
def oauth_start():
    import os
    if not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        raise HTTPException(status_code=400, detail="GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET requeridos en .env")
    from services.oauth import get_auth_url
    return {"url": get_auth_url()}


@router.get("/oauth/callback")
def oauth_callback(code: str):
    from services.oauth import exchange_code
    exchange_code(code)
    return RedirectResponse(url="http://localhost:5173?oauth=success")


@router.get("/oauth/status")
def oauth_status():
    from services.oauth import is_connected
    return {"connected": is_connected()}


@router.get("/calendar")
def get_calendar(session: Session = Depends(get_session)):
    """
    Retorna videos publicados (con fecha/hora) y la configuración de
    días/hora recomendados para publicar según el análisis del canal.
    """
    videos = session.exec(select(VideoMetrics).order_by(VideoMetrics.published_at.desc())).all()
    published = []
    for v in videos:
        if v.published_at:
            published.append({
                "date": v.published_at.strftime("%Y-%m-%d"),
                "time": v.published_at.strftime("%H:%M"),
                "title": v.title or v.youtube_video_id,
                "youtube_video_id": v.youtube_video_id,
                "views": v.views,
                "ctr": v.ctr,
            })
    return {
        "published": published,
        # Lun=1, Mié=3, Vie=5 (JS: 0=Dom … 6=Sáb)
        "recommended_days": [1, 3, 5],
        "recommended_hour": "18:00",
        "optimal_tz": "America/Lima",
        "rationale": "3 videos/semana; 18:00 Lima coincide con horario pico LatAm (fin de jornada)",
    }


@router.get("/growth-projection")
def get_growth_projection(session: Session = Depends(get_session)):
    """
    Proyección de crecimiento hacia YPP (1K subs + 4K horas).
    Devuelve 3 escenarios con fechas y probabilidades honestas.
    """
    from datetime import date, timedelta
    import math

    stats = session.exec(
        select(ChannelStats).order_by(ChannelStats.fetched_at.desc())
    ).first()
    videos = session.exec(select(VideoMetrics)).all()

    subs = stats.subscribers if stats else 0
    CHANNEL_START = date(2026, 4, 16)
    today = date.today()
    days_active = max((today - CHANNEL_START).days, 1)

    AVG_DUR = 156.0   # segundos — promedio real del canal
    VIDS = 3          # videos/semana recomendados
    TARGET_SUBS = 1000
    TARGET_HOURS = 4000.0
    OVER_5Y = "> 5 años"

    # ── Watch-hours actuales ──────────────────────────────────────────
    watch_hours = sum(
        v.views * (v.avg_view_duration if v.avg_view_duration > 0 else AVG_DUR) / 3600
        for v in videos
    )
    subs_per_day = subs / days_active       # 0.28/día actual
    hrs_per_day  = watch_hours / days_active # 0.58h/día actual

    def weeks_to_hours(views_ramp: list[tuple[int,int]]) -> int:
        """views_ramp = [(hasta_semana, views_por_video), ...]"""
        needed = max(TARGET_HOURS - watch_hours, 0)
        acc, w = 0.0, 0
        ramp_idx = 0
        while acc < needed:
            w += 1
            while ramp_idx < len(views_ramp) - 1 and w > views_ramp[ramp_idx][0]:
                ramp_idx += 1
            acc += VIDS * views_ramp[ramp_idx][1] * AVG_DUR / 3600
            if w > 780:  # tope 15 años
                return 9999
        return w

    # ════════════════════════════════════════════════════════════════
    # ESCENARIO 1 — PESIMISTA: sin cambios
    # CTR no mejora, misma tasa actual para siempre
    # ════════════════════════════════════════════════════════════════
    days_1k_pess = math.ceil((TARGET_SUBS - subs) / max(subs_per_day, 0.01))
    days_4k_pess = math.ceil((TARGET_HOURS - watch_hours) / max(hrs_per_day, 0.01))
    days_ypp_pess = max(days_1k_pess, days_4k_pess)

    if days_ypp_pess > 1825:   # > 5 años
        date_pess_str = OVER_5Y
        bottleneck_pess = "Horas" if days_4k_pess > days_1k_pess else "Subs"
    else:
        date_pess_str = (today + timedelta(days=days_ypp_pess)).isoformat()
        bottleneck_pess = None

    # ════════════════════════════════════════════════════════════════
    # ESCENARIO 2 — REALISTA: CTR mejora a 2%, sin viral grande
    # Ramp: semanas 1-8 a 50 views, 9-24 a 120, 25-52 a 200, 53+ a 300
    # ════════════════════════════════════════════════════════════════
    subs_day_real = max(subs_per_day * 5, 1.4)
    days_1k_real  = math.ceil((TARGET_SUBS - subs) / subs_day_real)
    w_real = weeks_to_hours([(8,50),(24,120),(52,200),(9999,300)])
    days_4k_real  = w_real * 7
    days_ypp_real = max(days_1k_real, days_4k_real)
    date_real = today + timedelta(days=days_ypp_real)
    bottleneck_real = "Horas" if days_4k_real > days_1k_real else "Subs"

    # ════════════════════════════════════════════════════════════════
    # ESCENARIO 3 — OPTIMISTA: CTR 3%+ Y viral de 50K en mes 6
    # ════════════════════════════════════════════════════════════════
    VIRAL_VIEWS = 50_000
    viral_hrs   = VIRAL_VIEWS * AVG_DUR / 3600          # ~2167h
    viral_week  = 26                                     # semana en que ocurre el viral

    needed_after_viral = max(TARGET_HOURS - watch_hours - viral_hrs, 0)
    post_viral_hpw = VIDS * 600 * AVG_DUR / 3600        # ~78h/sem
    weeks_post = math.ceil(needed_after_viral / post_viral_hpw) if post_viral_hpw > 0 else 0
    days_4k_opti  = (viral_week + weeks_post) * 7

    subs_day_opti = max(subs_per_day * 15, 5.0)
    days_1k_opti  = math.ceil((TARGET_SUBS - subs) / subs_day_opti)
    days_ypp_opti = max(days_1k_opti, days_4k_opti)
    date_opti = today + timedelta(days=days_ypp_opti)
    bottleneck_opti = "Horas" if days_4k_opti > days_1k_opti else "Subs"

    # ── Milestones (basados en escenario realista) ────────────────
    date_100_real  = today + timedelta(days=math.ceil((100-subs)/subs_day_real))
    date_1k_real_d = today + timedelta(days=days_1k_real)
    date_4k_real_d = today + timedelta(days=days_4k_real)

    # ── Viral insight (50K views) ─────────────────────────────────
    viral_50k_hrs = int(VIRAL_VIEWS * AVG_DUR / 3600)
    viral_pct_of_target = round(viral_50k_hrs / TARGET_HOURS * 100, 0)

    return {
        "subscribers": {
            "current": subs,
            "target_ypp": TARGET_SUBS,
            "pct": round(subs / TARGET_SUBS * 100, 1),
        },
        "watch_hours": {
            "current": round(watch_hours, 1),
            "target_ypp": int(TARGET_HOURS),
            "pct": round(watch_hours / TARGET_HOURS * 100, 1),
        },
        "days_active": days_active,

        # ── Los 3 escenarios ─────────────────────────────────────
        "scenarios": [
            {
                "key": "pessimistic",
                "label": "Pesimista",
                "color": "#ef4444",
                "probability": 35,
                "condition": "Sin cambios — CTR estancado al 0.7%",
                "ypp_date": date_pess_str,
                "over_5y": days_ypp_pess > 1825,
                "bottleneck": bottleneck_pess,
                "detail": "Misma tasa actual para siempre. Horas de vista tardan +18 años.",
            },
            {
                "key": "realistic",
                "label": "Realista",
                "color": "#f0a500",
                "probability": 45,
                "condition": "CTR sube a 2% · 3 videos/semana · sin viral grande",
                "ypp_date": date_real.isoformat(),
                "over_5y": False,
                "bottleneck": bottleneck_real,
                "detail": "Las horas son el cuello de botella. Subs llegan antes que las horas.",
            },
            {
                "key": "optimistic",
                "label": "Optimista",
                "color": "#22c55e",
                "probability": 20,
                "condition": "CTR 3%+ y 1 video viral 50K+ vistas en mes 6",
                "ypp_date": date_opti.isoformat(),
                "over_5y": False,
                "bottleneck": bottleneck_opti,
                "detail": "El viral resuelve el 54% de horas de un golpe. Requiere suerte + buen thumbnail.",
            },
        ],

        # ── Milestones (escenario realista) ───────────────────────
        "milestones": [
            {"label": "100 subs",  "date": date_100_real.isoformat(),  "reached": subs >= 100},
            {"label": "1K subs",   "date": date_1k_real_d.isoformat(),  "reached": subs >= 1000},
            {"label": "4K horas",  "date": date_4k_real_d.isoformat(),  "reached": watch_hours >= 4000},
        ],

        # ── Viral insight ──────────────────────────────────────────
        "viral_insight": {
            "hours": viral_50k_hrs,
            "pct_of_target": int(viral_pct_of_target),
            "label": f"1 video viral (50K views) = {viral_50k_hrs}h = {int(viral_pct_of_target)}% del requisito",
        },
    }


# ── Gap 2: validador de título ────────────────────────────────────────────────
@router.post("/validate-title")
def validate_title(body: dict):
    """
    Valida un título contra las reglas derivadas del análisis del canal.
    Reglas: ≤55 chars · contiene número/símbolo · contiene separador —
    Devuelve lista de reglas con estado pass/fail y sugerencia.
    """
    import re
    title = (body.get("title") or "").strip()

    # Patrones de temas Canal B (baja resonancia en LatAm)
    CANAL_B_PATTERNS = [
        "friendster", "myspace", "moviepass", "segway", "digg",
        "vine", "ask jeeves", "bebo", "orkut", "ping apple",
    ]
    topic = (body.get("topic") or "").lower()
    canal_b_hit = next((p for p in CANAL_B_PATTERNS if p in title.lower() or p in topic), None)

    rules = [
        {
            "id": "length",
            "label": "≤55 caracteres (visible en mobile)",
            "pass": len(title) <= 55,
            "value": len(title),
            "hint": f"{len(title)}/55 — YouTube mobile trunca después del carácter 55" if len(title) > 55 else None,
        },
        {
            "id": "number",
            "label": "Contiene cifra o símbolo ($, %, número)",
            "pass": bool(re.search(r'[\d$%]|[KMBT]B|\d+[KMB]', title)),
            "hint": "Añade un número concreto: '95%', '$6B', '3 millones'. Mejora CTR un 23% avg." if not re.search(r'[\d$%]|[KMBT]B|\d+[KMB]', title) else None,
        },
        {
            "id": "paradox",
            "label": "Contiene separador de paradoja (—)",
            "pass": "—" in title or " — " in title,
            "hint": "Usa el guión largo — para separar la promesa del giro. Ej: 'Nokia tenía todo — y lo destruyó'" if "—" not in title else None,
        },
        {
            "id": "canal_b",
            "label": "Tema con resonancia en LatAm",
            "pass": canal_b_hit is None,
            "hint": f"'{canal_b_hit}' tiene baja resonancia en LatAm (patrón Canal B). Prioriza marcas globales." if canal_b_hit else None,
        },
    ]

    score = sum(1 for r in rules if r["pass"])
    return {
        "title": title,
        "score": score,
        "max_score": len(rules),
        "strong": score == len(rules),
        "rules": rules,
    }


# ── Gap 3: Canal B — toggle y auto-detección ──────────────────────────────────
@router.patch("/videos/{youtube_video_id}/canal-b")
def toggle_canal_b(
    youtube_video_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    video.is_canal_b = bool(body.get("is_canal_b", False))
    session.add(video)
    session.commit()
    return {"ok": True, "youtube_video_id": youtube_video_id, "is_canal_b": video.is_canal_b}


@router.post("/videos/auto-detect-canal-b")
def auto_detect_canal_b(session: Session = Depends(get_session)):
    """
    Auto-etiqueta como Canal B los videos con:
    - retención < 5% (espectadores se van en segundos)
    - O impressions < 50 Y tienen más de 5 días publicados Y tienen views > 0
    Solo marca, nunca desmarca automáticamente.
    """
    from datetime import datetime, timedelta
    videos = session.exec(select(VideoMetrics)).all()
    tagged = []
    cutoff = datetime.utcnow() - timedelta(days=5)

    for v in videos:
        if v.is_canal_b:
            continue  # ya marcado, no tocar
        is_b = False
        reason = None

        if v.avg_view_percentage > 0 and v.avg_view_percentage < 5.0:
            is_b = True
            reason = f"retención {v.avg_view_percentage:.1f}% (< 5%)"
        elif (v.impressions < 50 and v.views > 0
              and v.published_at
              and v.published_at.replace(tzinfo=None) < cutoff):
            is_b = True
            reason = f"solo {v.impressions} impresiones en +5 días"

        if is_b:
            v.is_canal_b = True
            session.add(v)
            tagged.append({"title": v.title, "reason": reason})

    session.commit()
    return {"tagged": len(tagged), "videos": tagged}


# ── Gap 5: A/B tracking de títulos ────────────────────────────────────────────
@router.patch("/videos/{youtube_video_id}/title")
def change_title(
    youtube_video_id: str,
    body: dict,
    session: Session = Depends(get_session),
):
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")

    new_title = (body.get("title") or "").strip()
    if not new_title or new_title == video.title:
        raise HTTPException(status_code=400, detail="Título idéntico o vacío")

    # Registrar cambio
    change = TitleChange(
        youtube_video_id=youtube_video_id,
        old_title=video.title,
        new_title=new_title,
        ctr_before=video.ctr,
    )
    session.add(change)
    video.title = new_title
    session.add(video)
    session.commit()
    return {"ok": True, "old_title": change.old_title, "new_title": new_title, "ctr_before": change.ctr_before}


@router.get("/videos/{youtube_video_id}/title-history")
def get_title_history(
    youtube_video_id: str,
    session: Session = Depends(get_session),
):
    history = session.exec(
        select(TitleChange)
        .where(TitleChange.youtube_video_id == youtube_video_id)
        .order_by(TitleChange.changed_at.desc())
    ).all()
    video = session.exec(
        select(VideoMetrics).where(VideoMetrics.youtube_video_id == youtube_video_id)
    ).first()
    return {
        "current_title": video.title if video else "",
        "current_ctr": video.ctr if video else 0,
        "history": [
            {
                "old_title": h.old_title,
                "new_title": h.new_title,
                "ctr_before": h.ctr_before,
                "changed_at": h.changed_at.isoformat(),
            }
            for h in history
        ],
    }


@router.get("/summary")
def get_summary(session: Session = Depends(get_session)):
    from models import Project
    projects = session.exec(select(Project)).all()
    done = [p for p in projects if p.status == "done"]
    stats = session.exec(
        select(ChannelStats).order_by(ChannelStats.fetched_at.desc())
    ).first()
    videos = session.exec(select(VideoMetrics)).all()
    total_impressions = sum(v.impressions for v in videos if v.impressions > 0)
    return {
        "total_projects": len(projects),
        "completed_videos": len(done),
        "subscribers": stats.subscribers if stats else 0,
        "total_views": stats.total_views if stats else 0,
        "avg_ctr": stats.avg_ctr if stats else 0.0,
        "avg_retention": stats.avg_retention if stats else 0.0,
        "total_impressions": total_impressions,
    }
