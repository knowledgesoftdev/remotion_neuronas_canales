"""
Wikipedia image service — fetches images for military/historical topics.
Uses Wikipedia REST API v1 and MediaWiki API.
Free, no API key required.

Best for:
  - Historical military photos
  - Portraits of key figures
  - Maps, diagrams, archive images
  - Events that predate modern stock footage
"""

import os
import re
import httpx

WIKI_REST = "https://en.wikipedia.org/api/rest_v1"
WIKI_API  = "https://en.wikipedia.org/w/api.php"

# Wikipedia requires a proper User-Agent identifying the application
_HEADERS = {
    "User-Agent": "PhantomDirective/1.0 (https://github.com/phantom-directive; brayanyoutube2026@gmail.com) python-httpx",
    "Accept": "application/json",
}

SKIP_NAMES = {
    "icon", "logo", "flag_of", "commons-logo", "wikidata", "edit",
    "crystal", "stub", "ambox", "nuvola", "wikisource", "portal",
    "question_book", "padlock", "wikimedia", "redirect",
}


# ─── Article search ────────────────────────────────────────────────────────────

def get_summary(title: str) -> dict | None:
    """
    Fetch article summary + thumbnail for a known Wikipedia title.
    Returns dict with keys: title, extract, thumbnail.source (if available).
    """
    slug = title.strip().replace(" ", "_")
    try:
        r = httpx.get(f"{WIKI_REST}/page/summary/{slug}", headers=_HEADERS, timeout=15, follow_redirects=True)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def search_articles(query: str, limit: int = 5) -> list[str]:
    """
    Full-text search for Wikipedia article titles matching a query.
    Returns a list of article titles.
    """
    try:
        r = httpx.get(
            WIKI_API,
            headers=_HEADERS,
            params={
                "action":   "query",
                "list":     "search",
                "srsearch": query,
                "srlimit":  limit,
                "format":   "json",
            },
            timeout=15,
        )
        if r.status_code == 200:
            hits = r.json().get("query", {}).get("search", [])
            return [h["title"] for h in hits]
    except Exception:
        pass
    return []


def get_article_image_urls(title: str, limit: int = 6) -> list[str]:
    """
    Get image file URLs from a specific Wikipedia article.
    Skips icons, logos, and other non-photographic files.
    Returns direct HTTPS image URLs.
    """
    # Step 1: get file names used in the article
    try:
        r = httpx.get(
            WIKI_API,
            headers=_HEADERS,
            params={
                "action":  "query",
                "prop":    "images",
                "titles":  title,
                "format":  "json",
                "imlimit": 20,
            },
            timeout=15,
        )
        if r.status_code != 200:
            return []
        pages = r.json().get("query", {}).get("pages", {})
        file_names = []
        for page in pages.values():
            for img in page.get("images", []):
                name = img["title"]  # e.g. "File:ISA_patch.jpg"
                base = name.replace("File:", "").lower()
                if not any(base.endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                    continue
                if any(skip in base for skip in SKIP_NAMES):
                    continue
                file_names.append(name)
    except Exception:
        return []

    # Step 2: resolve each file name to a direct URL
    urls = []
    for fname in file_names[:limit * 2]:
        url = _resolve_file_url(fname)
        if url:
            urls.append(url)
        if len(urls) >= limit:
            break
    return urls


def _resolve_file_url(file_title: str) -> str | None:
    """Resolve 'File:Foo.jpg' → direct HTTPS CDN URL."""
    try:
        r = httpx.get(
            WIKI_API,
            headers=_HEADERS,
            params={
                "action":  "query",
                "prop":    "imageinfo",
                "titles":  file_title,
                "iiprop":  "url",
                "format":  "json",
                "iiurlwidth": 1280,   # request up to 1280px wide version
            },
            timeout=15,
        )
        if r.status_code != 200:
            return None
        pages = r.json().get("query", {}).get("pages", {})
        for page in pages.values():
            info = page.get("imageinfo", [])
            if info:
                return info[0].get("thumburl") or info[0].get("url")
    except Exception:
        pass
    return None


# ─── Convenience: search + collect images ─────────────────────────────────────

def search_images(query: str, limit: int = 5) -> list[str]:
    """
    Searches Wikipedia for articles matching `query`,
    then collects image URLs from those articles.
    Returns a list of direct image URLs (JPG/PNG).
    """
    urls: list[str] = []

    # Try direct title match first (fast path)
    summary = get_summary(query)
    if summary:
        thumb = summary.get("thumbnail", {}).get("source")
        if thumb:
            urls.append(thumb)
        # Also grab more images from the article
        urls += get_article_image_urls(summary["title"], limit=limit)

    # Full-text search fallback
    if len(urls) < limit:
        for title in search_articles(query, limit=3):
            if title == summary.get("title", ""):
                continue
            urls += get_article_image_urls(title, limit=2)
            if len(urls) >= limit:
                break

    # Deduplicate preserving order
    seen: set[str] = set()
    result = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
        if len(result) >= limit:
            break

    return result


# ─── Download ─────────────────────────────────────────────────────────────────

def download_image(url: str, dest_path: str) -> str:
    """
    Download an image URL to dest_path.
    Raises on HTTP errors. Returns dest_path on success.
    """
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with httpx.stream("GET", url, headers=_HEADERS, timeout=30, follow_redirects=True) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=32_768):
                f.write(chunk)
    return dest_path
