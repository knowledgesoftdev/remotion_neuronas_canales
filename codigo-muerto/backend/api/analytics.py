from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_session
from models import ChannelStats, VideoMetrics

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
