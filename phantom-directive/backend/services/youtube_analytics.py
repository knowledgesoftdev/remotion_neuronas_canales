import os
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from googleapiclient.discovery import build
from services.oauth import load_credentials


def _now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))

CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "")


def fetch_retention_per_video(video_ids: list[str]) -> dict[str, dict]:
    """Retorna {video_id: {avg_view_duration, avg_view_percentage}} por video."""
    creds = load_credentials()
    if not creds:
        return {}

    yt = build("youtubeAnalytics", "v2", credentials=creds)
    end = _now_lima().date().isoformat()
    start = (_now_lima() - timedelta(days=365)).date().isoformat()

    results = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        try:
            resp = yt.reports().query(
                ids=f"channel=={CHANNEL_ID}",
                startDate=start,
                endDate=end,
                metrics="averageViewDuration,averageViewPercentage",
                dimensions="video",
                filters=f"video=={','.join(batch)}",
                maxResults=50,
            ).execute()

            for row in resp.get("rows", []):
                vid_id, avg_dur, avg_pct = row
                results[vid_id] = {
                    "avg_view_duration": float(avg_dur),
                    "avg_view_percentage": round(float(avg_pct), 2),
                }
        except Exception as e:
            print(f"[Analytics] Error batch {i}: {e}")
            traceback.print_exc()

    return results


def fetch_channel_retention() -> dict:
    """Retorna retención promedio del canal (últimos 90 días)."""
    creds = load_credentials()
    if not creds:
        return {"avg_retention_pct": 0.0, "avg_view_duration": 0.0}

    yt = build("youtubeAnalytics", "v2", credentials=creds)
    end = _now_lima().date().isoformat()
    start = (_now_lima() - timedelta(days=90)).date().isoformat()

    try:
        print(f"[Analytics] Consultando retención del canal — {start} al {end}")
        resp = yt.reports().query(
            ids=f"channel=={CHANNEL_ID}",
            startDate=start,
            endDate=end,
            metrics="averageViewDuration,averageViewPercentage",
        ).execute()

        print(f"[Analytics] Respuesta: {resp}")
        rows = resp.get("rows", [])
        if rows:
            avg_dur, avg_pct = rows[0]
            return {
                "avg_retention_pct": round(float(avg_pct), 2),
                "avg_view_duration": float(avg_dur),
            }
        print("[Analytics] Sin datos en ese rango")
    except Exception as e:
        print(f"[Analytics] Error: {e}")
        traceback.print_exc()

    return {"avg_retention_pct": 0.0, "avg_view_duration": 0.0}
