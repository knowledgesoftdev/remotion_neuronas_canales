import os
import json
import httpx
from datetime import datetime
from sqlmodel import Session, select
from database import engine
from models import ChannelStats, VideoMetrics

API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "")
BASE = "https://www.googleapis.com/youtube/v3"


def sync_channel() -> dict:
    from services.oauth import is_connected
    from services.youtube_analytics import fetch_retention_per_video, fetch_channel_retention

    channel = _fetch_channel()
    videos = _fetch_all_videos(channel["uploads_playlist"])

    analytics = {}
    channel_analytics = {"avg_retention_pct": 0.0, "avg_view_duration": 0.0}
    if is_connected():
        video_ids = [v["video_id"] for v in videos]
        analytics = fetch_retention_per_video(video_ids)
        channel_analytics = fetch_channel_retention()

    # Calcular engagement rate (likes/vistas %) como proxy de CTR
    total_views = sum(v["views"] for v in videos)
    total_likes = sum(v["likes"] for v in videos)
    engagement_rate = round((total_likes / total_views * 100), 2) if total_views > 0 else 0.0

    _save_stats(channel, videos, analytics, channel_analytics, engagement_rate)
    return {
        "channel": channel,
        "videos_synced": len(videos),
        "ctr_available": is_connected(),
        "synced_at": datetime.utcnow().isoformat(),
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
        results.append({
            "video_id": item["id"],
            "title": item["snippet"]["title"],
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "duration_seconds": _parse_duration(duration_iso),
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
    top_topics = [v["title"] for v in sorted(videos, key=lambda x: x["views"], reverse=True)[:5]]

    with Session(engine) as session:
        stats = ChannelStats(
            subscribers=channel["subscribers"],
            total_views=channel["total_views"],
            total_videos=channel["total_videos"],
            avg_ctr=engagement_rate,
            avg_retention=channel_analytics.get("avg_view_duration", 0.0),
            top_topics=json.dumps(top_topics, ensure_ascii=False),
            top_styles="[]",
        )
        session.add(stats)

        for v in videos:
            a = analytics.get(v["video_id"], {})
            existing = session.exec(
                select(VideoMetrics).where(VideoMetrics.youtube_video_id == v["video_id"])
            ).first()

            if existing:
                existing.title = v["title"]
                existing.views = v["views"]
                existing.likes = v["likes"]
                existing.comments = v["comments"]
                existing.avg_view_duration = a.get("avg_view_duration", 0.0)
                existing.avg_view_percentage = a.get("avg_view_percentage", 0.0)
                existing.fetched_at = datetime.utcnow()
                session.add(existing)
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
                ))

        session.commit()
