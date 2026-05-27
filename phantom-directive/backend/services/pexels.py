"""
Pexels API client — search and download videos/photos.

Videos endpoint : https://api.pexels.com/videos/search
Photos endpoint : https://api.pexels.com/v1/search
Auth header     : Authorization: <API_KEY>   (no "Bearer" prefix)
Rate limits     : 200 requests/hour, 20 000 requests/month
Downloads       : CDN links — no auth required, not counted against rate limit
"""

import os
import httpx

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

_HEADERS = {"Authorization": PEXELS_API_KEY}

VIDEOS_URL = "https://api.pexels.com/videos/search"
PHOTOS_URL = "https://api.pexels.com/v1/search"


# ── Search ────────────────────────────────────────────────────────────────────

def search_videos(
    query: str,
    per_page: int = 5,
    orientation: str = "landscape",
    min_duration: int = 5,
    max_duration: int = 60,
) -> list[dict]:
    """
    Search Pexels for videos.
    Returns a list of Pexels video objects (may be empty on rate-limit or no results).
    """
    if not PEXELS_API_KEY:
        raise RuntimeError("PEXELS_API_KEY is not set in environment variables.")

    resp = httpx.get(
        VIDEOS_URL,
        headers=_HEADERS,
        params={
            "query":        query,
            "per_page":     per_page,
            "orientation":  orientation,
            "min_duration": min_duration,
            "max_duration": max_duration,
            "size":         "medium",   # "small" | "medium" | "large"
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("videos", [])


def search_photos(
    query: str,
    per_page: int = 5,
    orientation: str = "landscape",
) -> list[dict]:
    """
    Search Pexels for photos (fallback when no videos found).
    Returns a list of Pexels photo objects.
    """
    if not PEXELS_API_KEY:
        raise RuntimeError("PEXELS_API_KEY is not set in environment variables.")

    resp = httpx.get(
        PHOTOS_URL,
        headers=_HEADERS,
        params={
            "query":       query,
            "per_page":    per_page,
            "orientation": orientation,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("photos", [])


# ── File selection ─────────────────────────────────────────────────────────────

def best_video_file(video: dict, target_width: int = 1280) -> dict | None:
    """
    Returns the best MP4 video file from a Pexels video object.

    Strategy:
      1. Prefer "hd" quality files at or below target_width (default 1280 = 720p).
      2. Fall back to any mp4 file sorted by width descending.
      3. Return None if no mp4 found.

    This keeps file sizes manageable while maintaining documentary quality.
    """
    files = video.get("video_files", [])

    # Prefer hd/sd mp4 at or below target width
    candidates = [
        f for f in files
        if f.get("file_type") == "video/mp4"
        and f.get("width", 0) <= target_width
        and f.get("width", 0) >= 854   # at least 480p width
    ]

    if not candidates:
        # Relax: accept any mp4
        candidates = [f for f in files if f.get("file_type") == "video/mp4"]

    if not candidates:
        return None

    # Sort by width descending — closest to target_width from below
    return sorted(candidates, key=lambda x: x.get("width", 0), reverse=True)[0]


def best_photo_src(photo: dict) -> str | None:
    """Returns the best available photo URL (large2x > large > medium)."""
    src = photo.get("src", {})
    return src.get("large2x") or src.get("large") or src.get("medium")


# ── Download ──────────────────────────────────────────────────────────────────

def download_file(url: str, dest_path: str, max_mb: int = 80) -> str:
    """
    Streams a file from URL to dest_path.
    Creates parent directories as needed.
    Returns dest_path on success.
    Raises ValueError if file exceeds max_mb to prevent multi-GB downloads.
    CDN downloads are NOT counted against Pexels rate limits.
    """
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    max_bytes = max_mb * 1024 * 1024
    downloaded = 0

    with httpx.stream("GET", url, timeout=60, follow_redirects=True) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=65_536):
                downloaded += len(chunk)
                if downloaded > max_bytes:
                    raise ValueError(f"File exceeds {max_mb}MB limit — skipping")
                f.write(chunk)

    return dest_path
