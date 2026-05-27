"""
MediaAgent — Downloads background media for each script section.

Sources (tried in priority order per query):
  1. Pexels Videos  — cinematic stock footage (best for modern military imagery)
  2. Pexels Photos  — stock photography
  3. Wikipedia      — historical/archive images (free, reliable, always has military history)
  4. SerpAPI        — Google Images (powerful, uses API credits)

Flow:
  1. Reads full_script.txt → sends to Claude → receives search queries per section.
  2. For each section, tries sources in order until ASSETS_PER_SECTION assets collected.
  3. Saves to  media/<SECTION>/<index>_<slug>.mp4|jpg
  4. Writes    media_manifest.json  with file paths + attribution.

Sections: HOOK · CONTEXT · ORIGIN · OPERATIONS · COVERUP · CLOSING
"""

import os
import re
import json
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SECTIONS          = ["HOOK", "CONTEXT", "ORIGIN", "OPERATIONS", "COVERUP", "CLOSING"]
ASSETS_PER_SECTION = 3    # target assets to collect per section
SEARCH_PER_QUERY   = 3    # results to fetch per Pexels query (picks best)


# ─── Entry point ─────────────────────────────────────────────────────────────

def run(project_id: int, folder: str, force: bool = False):
    manifest_path = os.path.join(folder, "media_manifest.json")

    if not force and os.path.exists(manifest_path):
        print("[MediaAgent] media_manifest.json already exists, skipping.")
        return

    script_path = os.path.join(folder, "full_script.txt")
    if not os.path.exists(script_path):
        raise FileNotFoundError("full_script.txt not found. Run GuionAgent first.")

    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    print("[MediaAgent] Generating search queries with Claude...")
    queries = _generate_queries(script)

    media_dir = os.path.join(folder, "media")
    os.makedirs(media_dir, exist_ok=True)

    manifest: dict = {}

    for section in SECTIONS:
        section_queries = queries.get(section, [])
        if not section_queries:
            print(f"[MediaAgent] [{section}] No queries — skipping.")
            manifest[section] = []
            continue

        section_dir = os.path.join(media_dir, section)
        os.makedirs(section_dir, exist_ok=True)

        assets = _collect_section(section, section_queries, section_dir, force)
        manifest[section] = assets
        print(f"[MediaAgent] [{section}] {len(assets)} asset(s) collected.")

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in manifest.values())
    print(f"[MediaAgent] Done — {total} total assets. Manifest: {manifest_path}")


# ─── Per-section collection ───────────────────────────────────────────────────

def _collect_section(
    section: str,
    queries: list[str],
    section_dir: str,
    force: bool,
) -> list[dict]:
    """
    Tries each query across all sources until ASSETS_PER_SECTION assets are collected.
    Source priority: Pexels video → Pexels photo → Wikipedia → SerpAPI
    """
    assets: list[dict] = []
    idx = 1

    for query in queries:
        if idx > ASSETS_PER_SECTION:
            break

        # ── 1. Pexels Videos ──────────────────────────────────────────────────
        pexels_video = _try_pexels_video(query, idx, section, section_dir, force)
        if pexels_video:
            assets.append(pexels_video)
            idx += 1
            continue

        # ── 2. Pexels Photos ─────────────────────────────────────────────────
        pexels_photo = _try_pexels_photo(query, idx, section, section_dir, force)
        if pexels_photo:
            assets.append(pexels_photo)
            idx += 1
            continue

        # ── 3. Wikipedia images ───────────────────────────────────────────────
        wiki_result = _try_wikipedia(query, idx, section, section_dir, force)
        if wiki_result:
            assets.append(wiki_result)
            idx += 1
            continue

        # ── 4. SerpAPI (Google Images) ────────────────────────────────────────
        serp_result = _try_serpapi(query, idx, section, section_dir, force)
        if serp_result:
            assets.append(serp_result)
            idx += 1
            continue

        print(f"[MediaAgent] [{section}] No asset found for: '{query}'")

    return assets


# ─── Source handlers ─────────────────────────────────────────────────────────

def _try_pexels_video(query, idx, section, section_dir, force) -> dict | None:
    try:
        from services.pexels import search_videos, best_video_file, download_file
    except ImportError:
        return None

    print(f"[MediaAgent] [{section}] Pexels video: '{query}'")
    try:
        videos = search_videos(query, per_page=SEARCH_PER_QUERY)
    except Exception as e:
        print(f"[MediaAgent] [{section}] Pexels video error: {e}")
        return None

    for video in videos:
        best = best_video_file(video)
        if not best:
            continue

        filename = f"{idx:02d}_{_slug(query)}.mp4"
        dest = os.path.join(section_dir, filename)

        if not force and os.path.exists(dest):
            print(f"[MediaAgent] [{section}] Exists: {filename}")
        else:
            try:
                download_file(best["link"], dest, max_mb=60)
            except ValueError as e:
                print(f"[MediaAgent] [{section}] Too large: {e}")
                continue
            except Exception as e:
                print(f"[MediaAgent] [{section}] Download failed: {e}")
                continue

        return {
            "index":     idx,
            "section":   section,
            "query":     query,
            "source":    "pexels_video",
            "file":      dest,
            "filename":  filename,
            "type":      "video",
            "credit":    video.get("user", {}).get("name", "Pexels"),
            "credit_url": video.get("user", {}).get("url", "https://pexels.com"),
            "pexels_url": video.get("url", ""),
            "width":     best.get("width"),
            "height":    best.get("height"),
            "duration":  video.get("duration", 0),
        }

    return None


def _try_pexels_photo(query, idx, section, section_dir, force) -> dict | None:
    try:
        from services.pexels import search_photos, best_photo_src, download_file
    except ImportError:
        return None

    print(f"[MediaAgent] [{section}] Pexels photo: '{query}'")
    try:
        photos = search_photos(query, per_page=SEARCH_PER_QUERY)
    except Exception as e:
        print(f"[MediaAgent] [{section}] Pexels photo error: {e}")
        return None

    for photo in photos:
        src = best_photo_src(photo)
        if not src:
            continue

        filename = f"{idx:02d}_{_slug(query)}.jpg"
        dest = os.path.join(section_dir, filename)

        if not force and os.path.exists(dest):
            print(f"[MediaAgent] [{section}] Exists: {filename}")
        else:
            try:
                download_file(src, dest)
            except Exception as e:
                print(f"[MediaAgent] [{section}] Photo download failed: {e}")
                continue

        return {
            "index":     idx,
            "section":   section,
            "query":     query,
            "source":    "pexels_photo",
            "file":      dest,
            "filename":  filename,
            "type":      "photo",
            "credit":    photo.get("photographer", "Pexels"),
            "credit_url": photo.get("photographer_url", "https://pexels.com"),
            "pexels_url": photo.get("url", ""),
            "width":     photo.get("width"),
            "height":    photo.get("height"),
            "duration":  None,
        }

    return None


def _try_wikipedia(query, idx, section, section_dir, force) -> dict | None:
    try:
        from services.wikipedia import search_images, download_image
    except ImportError:
        return None

    print(f"[MediaAgent] [{section}] Wikipedia: '{query}'")
    try:
        urls = search_images(query, limit=3)
    except Exception as e:
        print(f"[MediaAgent] [{section}] Wikipedia error: {e}")
        return None

    for url in urls:
        ext = "jpg" if ".jpg" in url.lower() else "png" if ".png" in url.lower() else "jpg"
        filename = f"{idx:02d}_{_slug(query)}_wiki.{ext}"
        dest = os.path.join(section_dir, filename)

        if not force and os.path.exists(dest):
            print(f"[MediaAgent] [{section}] Exists: {filename}")
            return {
                "index":     idx,
                "section":   section,
                "query":     query,
                "source":    "wikipedia",
                "file":      dest,
                "filename":  filename,
                "type":      "photo",
                "credit":    "Wikimedia Commons",
                "credit_url": "https://commons.wikimedia.org",
                "width":     None,
                "height":    None,
                "duration":  None,
            }

        try:
            download_image(url, dest)
            print(f"[MediaAgent] [{section}] Wikipedia ↓ {filename}")
            return {
                "index":     idx,
                "section":   section,
                "query":     query,
                "source":    "wikipedia",
                "file":      dest,
                "filename":  filename,
                "type":      "photo",
                "credit":    "Wikimedia Commons",
                "credit_url": "https://commons.wikimedia.org",
                "width":     None,
                "height":    None,
                "duration":  None,
            }
        except Exception as e:
            print(f"[MediaAgent] [{section}] Wikipedia download failed: {e}")
            continue

    return None


def _try_serpapi(query, idx, section, section_dir, force) -> dict | None:
    serpapi_key = os.environ.get("SERPAPI_KEY", "")
    if not serpapi_key:
        return None

    try:
        from services.serp_images import search_images, download_image
    except ImportError:
        return None

    print(f"[MediaAgent] [{section}] SerpAPI: '{query}'")
    try:
        results = search_images(query, num=3)
    except Exception as e:
        print(f"[MediaAgent] [{section}] SerpAPI error: {e}")
        return None

    for item in results:
        url = item.get("url", "")
        if not url:
            continue

        filename = f"{idx:02d}_{_slug(query)}_serp.jpg"
        dest = os.path.join(section_dir, filename)

        if not force and os.path.exists(dest):
            print(f"[MediaAgent] [{section}] Exists: {filename}")
            return {
                "index":     idx,
                "section":   section,
                "query":     query,
                "source":    "serpapi",
                "file":      dest,
                "filename":  filename,
                "type":      "photo",
                "credit":    item.get("source", "Google Images"),
                "credit_url": "",
                "width":     item.get("width"),
                "height":    item.get("height"),
                "duration":  None,
            }

        try:
            download_image(url, dest, max_mb=15)
            print(f"[MediaAgent] [{section}] SerpAPI ↓ {filename}")
            return {
                "index":     idx,
                "section":   section,
                "query":     query,
                "source":    "serpapi",
                "file":      dest,
                "filename":  filename,
                "type":      "photo",
                "credit":    item.get("source", "Google Images"),
                "credit_url": "",
                "width":     item.get("width"),
                "height":    item.get("height"),
                "duration":  None,
            }
        except Exception as e:
            print(f"[MediaAgent] [{section}] SerpAPI download failed: {e}")
            continue

    return None


# ─── Claude query generation ──────────────────────────────────────────────────

def _generate_queries(script: str) -> dict:
    """
    Single Claude call → 3 search queries per section.
    Queries are optimized to return results across ALL sources:
    Pexels (generic atmospheric), Wikipedia (historical specific), Google Images.
    """
    prompt = f"""You are the visual researcher for Phantom Directive — a classified military history YouTube channel.
"Classified History. Declassified."

Your job: generate search queries to find background images/videos for each section.
The queries will be used across THREE sources in order: Pexels, Wikipedia, and Google Images.

SCRIPT (first 4000 characters):
{script[:4000]}

SECTIONS: HOOK, CONTEXT, ORIGIN, OPERATIONS, COVERUP, CLOSING

For EACH section, generate exactly 3 queries. Make them DIFFERENT visual angles:
  Query 1: Generic/atmospheric — works on Pexels (cinematic, 2-4 words)
    Examples: "military silhouette night", "classified documents paper", "soldiers dark"
  Query 2: Historical/specific — works on Wikipedia (specific event/person/unit name)
    Examples: "Intelligence Support Activity", "Operation Eagle Claw", "Delta Force 1980"
  Query 3: Documentary/news — works on Google Images (descriptive, 4-6 words)
    Examples: "classified military intelligence unit archive photo"

RULES:
  - Query 1 must be 2-4 words, generic enough for Pexels stock footage
  - Query 2 must be specific enough to find a Wikipedia article
  - Query 3 can be longer, descriptive, for Google image search
  - All queries must be visually appropriate for the section content
  - Use English only

Respond ONLY with this JSON:
{{
  "HOOK":       ["pexels query", "wikipedia query", "google query"],
  "CONTEXT":    ["pexels query", "wikipedia query", "google query"],
  "ORIGIN":     ["pexels query", "wikipedia query", "google query"],
  "OPERATIONS": ["pexels query", "wikipedia query", "google query"],
  "COVERUP":    ["pexels query", "wikipedia query", "google query"],
  "CLOSING":    ["pexels query", "wikipedia query", "google query"]
}}"""

    response = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[MediaAgent] Could not parse Claude queries: {e}. Using defaults.")
        return _default_queries()


def _default_queries() -> dict:
    return {
        "HOOK":       ["military silhouette dark",        "Special Forces unit classified",   "secret military operation archive photo"],
        "CONTEXT":    ["government building washington",   "United States Army intelligence",  "cold war US military history documentary"],
        "ORIGIN":     ["military base aerial view",       "special operations unit formation", "covert unit founding 1980 military archive"],
        "OPERATIONS": ["helicopter jungle military",      "Operation Eagle Claw Iran",         "covert special operations mission desert"],
        "COVERUP":    ["burning documents fire",          "congressional hearing military",    "classified documents destroyed government archive"],
        "CLOSING":    ["military memorial sunset",        "Special Forces memorial",           "military legacy declassified history"],
    }


def _slug(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', text.lower().strip())[:30].rstrip('_')
