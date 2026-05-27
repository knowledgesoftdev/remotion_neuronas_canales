"""
SerpAPI Google Images service — finds and downloads images via Google Images.
Requires SERPAPI_KEY environment variable.

Best for:
  - Highly specific military/historical photos not on Pexels
  - Recent declassified imagery
  - News/documentary photos
  - When Pexels and Wikipedia both fail

Rate limits:
  Free plan:  100 searches/month
  Paid plans: varies
"""

import os
import httpx

SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")
_BASE = "https://serpapi.com/search"

# Image sizes SerpAPI supports: "large", "medium", "icon"
# We want large/medium for quality backgrounds
_SIZE_PREF = "large"


def search_images(query: str, num: int = 5) -> list[dict]:
    """
    Search Google Images via SerpAPI.
    Returns list of dicts: {url, thumbnail, title, width, height}
    Only returns results with direct image URLs (not Google's proxy).
    """
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY not set in environment.")

    try:
        r = httpx.get(
            _BASE,
            params={
                "engine":  "google_images",
                "q":       query,
                "api_key": SERPAPI_KEY,
                "num":     num * 3,  # over-request to allow filtering
                "safe":    "active",
                "imgsz":   _SIZE_PREF,
                "tbs":     "isz:l",  # large images only
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"[SerpImages] Search error: {e}")
        return []

    results = []
    for item in data.get("images_results", []):
        url = item.get("original", "")
        if not url:
            continue
        # Skip data URIs and very short URLs (usually placeholders)
        if url.startswith("data:") or len(url) < 20:
            continue
        # Prefer HTTPS
        if not url.startswith("http"):
            continue

        results.append({
            "url":       url,
            "thumbnail": item.get("thumbnail", ""),
            "title":     item.get("title", ""),
            "width":     item.get("original_width", 0),
            "height":    item.get("original_height", 0),
            "source":    item.get("source", ""),
        })

        if len(results) >= num:
            break

    return results


def download_image(url: str, dest_path: str, max_mb: int = 20) -> str:
    """
    Download an image URL to dest_path.
    Raises ValueError if file exceeds max_mb.
    Returns dest_path on success.
    """
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    max_bytes  = max_mb * 1024 * 1024
    downloaded = 0

    try:
        with httpx.stream("GET", url, timeout=20, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=32_768):
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        raise ValueError(f"Image exceeds {max_mb}MB limit")
                    f.write(chunk)
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"HTTP {e.response.status_code} for {url}")

    return dest_path
