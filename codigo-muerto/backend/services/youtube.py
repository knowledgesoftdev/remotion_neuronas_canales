import os
import json
import shutil
import httpx
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import Session, select
from database import engine
from models import ChannelStats, VideoMetrics

API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "")
BASE = "https://www.googleapis.com/youtube/v3"

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "neural_studio.db")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "backups")


def _now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))


def _backup_db():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"neural_studio_{ts}.db")
    shutil.copy2(os.path.abspath(DB_PATH), dest)
    # Mantener solo los últimos 10 backups
    backups = sorted(f for f in os.listdir(BACKUP_DIR) if f.endswith(".db"))
    for old in backups[:-10]:
        os.remove(os.path.join(BACKUP_DIR, old))
    print(f"[Sync] Backup creado: {os.path.basename(dest)}")


def sync_channel() -> dict:
    from services.oauth import is_connected
    from services.youtube_analytics import fetch_retention_per_video, fetch_channel_retention

    _backup_db()
    channel = _fetch_channel()
    videos = _fetch_all_videos(channel["uploads_playlist"])

    analytics = {}
    channel_analytics = {"avg_retention_pct": 0.0, "avg_view_duration": 0.0}
    if is_connected():
        video_ids = [v["video_id"] for v in videos]
        analytics = fetch_retention_per_video(video_ids)
        channel_analytics = fetch_channel_retention()

    total_views = sum(v["views"] for v in videos)
    total_likes = sum(v["likes"] for v in videos)
    engagement_rate = round((total_likes / total_views * 100), 2) if total_views > 0 else 0.0

    _save_stats(channel, videos, analytics, channel_analytics, engagement_rate)
    return {
        "channel": channel,
        "videos_synced": len(videos),
        "ctr_available": is_connected(),
        "synced_at": _now_lima().isoformat(),
    }


def _fetch_channel() -> dict:
    resp = httpx.get(f"{BASE}/channels", params={
        "part": "snippet,statistics,contentDetails",
        "id": CHANNEL_ID,
        "key": API_KEY,
    }, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if not data.get("items"):
        raise ValueError(f"Canal no encontrado: {CHANNEL_ID}")

    item = data["items"][0]
    stats = item["statistics"]
    uploads = item["contentDetails"]["relatedPlaylists"]["uploads"]

    return {
        "title": item["snippet"]["title"],
        "subscribers": int(stats.get("subscriberCount", 0)),
        "total_views": int(stats.get("viewCount", 0)),
        "total_videos": int(stats.get("videoCount", 0)),
        "uploads_playlist": uploads,
    }


def _fetch_all_videos(playlist_id: str) -> list[dict]:
    videos = []
    page_token = None

    while True:
        params = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": 50,
            "key": API_KEY,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = httpx.get(f"{BASE}/playlistItems", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        video_ids = [i["contentDetails"]["videoId"] for i in data.get("items", [])]
        if video_ids:
            videos.extend(_fetch_video_stats(video_ids))

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return videos


def _fetch_video_stats(video_ids: list[str]) -> list[dict]:
    resp = httpx.get(f"{BASE}/videos", params={
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(video_ids),
        "key": API_KEY,
    }, timeout=30)
    resp.raise_for_status()

    results = []
    for item in resp.json().get("items", []):
        stats = item.get("statistics", {})
        duration_iso = item.get("contentDetails", {}).get("duration", "PT0S")
        published_raw = item.get("snippet", {}).get("publishedAt")
        published_at = None
        if published_raw:
            utc_dt = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
            published_at = utc_dt.astimezone(ZoneInfo("America/Lima"))
        results.append({
            "video_id": item["id"],
            "title": item["snippet"]["title"],
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "duration_seconds": _parse_duration(duration_iso),
            "published_at": published_at,
        })
    return results


def _parse_duration(iso: str) -> float:
    import re
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso)
    if not match:
        return 0.0
    h, m, s = (int(x) if x else 0 for x in match.groups())
    return float(h * 3600 + m * 60 + s)


def _save_stats(channel: dict, videos: list[dict], analytics: dict, channel_analytics: dict, engagement_rate: float):
    from models import Project

    top_topics = [v["title"] for v in sorted(videos, key=lambda x: x["views"], reverse=True)[:5]]

    with Session(engine) as session:
        # Build lookup: youtube_video_id -> project_id
        projects = session.exec(select(Project)).all()
        project_map = {p.youtube_video_id: p.id for p in projects if p.youtube_video_id}

        # CTR y retención reales: calculados desde datos ingresados manualmente
        existing_videos = session.exec(select(VideoMetrics)).all()
        ctrs = [v.ctr for v in existing_videos if v.ctr > 0]
        rets = [v.avg_view_duration for v in existing_videos if v.avg_view_duration > 0]
        real_avg_ctr = round(sum(ctrs) / len(ctrs), 2) if ctrs else 0.0
        real_avg_ret = round(sum(rets) / len(rets), 1) if rets else channel_analytics.get("avg_view_duration", 0.0)

        stats = ChannelStats(
            subscribers=channel["subscribers"],
            total_views=channel["total_views"],
            total_videos=channel["total_videos"],
            avg_ctr=real_avg_ctr,
            avg_retention=real_avg_ret,
            top_topics=json.dumps(top_topics, ensure_ascii=False),
            top_styles="[]",
        )
        session.add(stats)

        for v in videos:
            a = analytics.get(v["video_id"], {})
            project_id = project_map.get(v["video_id"])
            existing = session.exec(
                select(VideoMetrics).where(VideoMetrics.youtube_video_id == v["video_id"])
            ).first()

            if existing:
                from sqlalchemy import update as sa_update
                values = {
                    "title": v["title"],
                    "views": v["views"],
                    "likes": v["likes"],
                    "comments": v["comments"],
                    "fetched_at": _now_lima(),
                }
                if v["published_at"] is not None:
                    values["published_at"] = v["published_at"]
                if project_id and existing.project_id is None:
                    values["project_id"] = project_id
                if "avg_view_duration" in a:
                    values["avg_view_duration"] = a["avg_view_duration"]
                if "avg_view_percentage" in a:
                    values["avg_view_percentage"] = a["avg_view_percentage"]
                session.execute(
                    sa_update(VideoMetrics)
                    .where(VideoMetrics.youtube_video_id == v["video_id"])
                    .values(**values)
                )
            else:
                session.add(VideoMetrics(
                    youtube_video_id=v["video_id"],
                    title=v["title"],
                    views=v["views"],
                    likes=v["likes"],
                    comments=v["comments"],
                    avg_view_duration=a.get("avg_view_duration", 0.0),
                    avg_view_percentage=a.get("avg_view_percentage", 0.0),
                    ctr=0.0,
                    published_at=v["published_at"],
                    project_id=project_id,
                ))

        session.commit()
