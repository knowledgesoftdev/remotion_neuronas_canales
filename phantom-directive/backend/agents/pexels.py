"""
PexelsAgent — Downloads stock footage and photos for each script section.

Flow:
  1. Reads full_script.txt from the project folder.
  2. Sends the script to Claude once → receives 3 search queries per section.
  3. Searches Pexels Videos for each query; falls back to Photos if needed.
  4. Downloads the best file per result into  pexels/<SECTION>/<index>_<slug>.mp4|jpg
  5. Writes pexels_manifest.json with file paths + Pexels attribution data.

Sections: HOOK · CONTEXT · ORIGIN · OPERATIONS · COVERUP · CLOSING
Clips per section: CLIPS_PER_SECTION (default 3)

Attribution:
  Pexels requires crediting photographers/videographers when using their media.
  All credits are stored in pexels_manifest.json under each asset's "credit" key.
"""

import os
import re
import json
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

SECTIONS = ["HOOK", "CONTEXT", "ORIGIN", "OPERATIONS", "COVERUP", "CLOSING"]
CLIPS_PER_SECTION = 3   # video clips to download per section
SEARCH_PER_QUERY  = 3   # Pexels results to fetch per query (picks best)


# ── Entry point ───────────────────────────────────────────────────────────────

def run(project_id: int, folder: str, force: bool = False):
    manifest_path = os.path.join(folder, "pexels_manifest.json")

    if not force and os.path.exists(manifest_path):
        print("[PexelsAgent] Manifest already exists, skipping.")
        return

    script_path = os.path.join(folder, "full_script.txt")
    if not os.path.exists(script_path):
        raise FileNotFoundError("full_script.txt not found. Run GuionAgent first.")

    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    print("[PexelsAgent] Generating search queries with Claude...")
    queries = _generate_queries(script)

    pexels_dir = os.path.join(folder, "pexels")
    os.makedirs(pexels_dir, exist_ok=True)

    manifest: dict = {}

    for section in SECTIONS:
        section_queries = queries.get(section, [])
        if not section_queries:
            print(f"[PexelsAgent] [{section}] No queries — skipping.")
            manifest[section] = []
            continue

        section_dir = os.path.join(pexels_dir, section)
        os.makedirs(section_dir, exist_ok=True)

        assets = _download_section(section, section_queries, section_dir, force)
        manifest[section] = assets
        print(f"[PexelsAgent] [{section}] {len(assets)} asset(s) downloaded.")

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in manifest.values())
    print(f"[PexelsAgent] Done — {total} total assets. Manifest: {manifest_path}")


# ── Per-section download ──────────────────────────────────────────────────────

def _download_section(
    section: str,
    queries: list[str],
    section_dir: str,
    force: bool,
) -> list[dict]:
    """
    Tries each query in order until CLIPS_PER_SECTION assets have been downloaded.
    Prioritises videos; falls back to photos if a query returns no videos.
    """
    from services.pexels import (
        search_videos, search_photos,
        best_video_file, best_photo_src,
        download_file,
    )

    assets: list[dict] = []
    clip_index = 1

    for query in queries:
        if clip_index > CLIPS_PER_SECTION:
            break

        print(f"[PexelsAgent] [{section}] Searching videos: '{query}'")

        try:
            videos = search_videos(query, per_page=SEARCH_PER_QUERY)
        except Exception as e:
            print(f"[PexelsAgent] [{section}] Video search error: {e}")
            videos = []

        for video in videos:
            if clip_index > CLIPS_PER_SECTION:
                break

            best = best_video_file(video)
            if not best:
                continue

            filename = f"{clip_index:02d}_{_slugify(query)}.mp4"
            dest     = os.path.join(section_dir, filename)

            if not force and os.path.exists(dest):
                print(f"[PexelsAgent] [{section}] Already exists: {filename}")
            else:
                dims = f"{best.get('width', '?')}x{best.get('height', '?')}"
                dur  = video.get("duration", "?")
                print(f"[PexelsAgent] [{section}] Downloading: {filename} ({dims}, {dur}s)")
                try:
                    download_file(best["link"], dest, max_mb=80)
                except ValueError as e:
                    print(f"[PexelsAgent] [{section}] Skipped (too large): {e}")
                    continue
                except Exception as e:
                    print(f"[PexelsAgent] [{section}] Download failed: {e}")
                    continue

            assets.append({
                "index":        clip_index,
                "section":      section,
                "query":        query,
                "file":         dest,
                "filename":     filename,
                "type":         "video",
                "pexels_id":    video["id"],
                "pexels_url":   video.get("url", ""),
                "credit":       video.get("user", {}).get("name", "Unknown"),
                "credit_url":   video.get("user", {}).get("url", ""),
                "width":        best.get("width"),
                "height":       best.get("height"),
                "duration_sec": video.get("duration", 0),
            })
            clip_index += 1

        # ── Photo fallback ────────────────────────────────────────────────────
        if clip_index <= CLIPS_PER_SECTION and not videos:
            print(f"[PexelsAgent] [{section}] No videos — trying photos: '{query}'")
            try:
                photos = search_photos(query, per_page=SEARCH_PER_QUERY)
            except Exception as e:
                print(f"[PexelsAgent] [{section}] Photo search error: {e}")
                photos = []

            for photo in photos:
                if clip_index > CLIPS_PER_SECTION:
                    break

                src = best_photo_src(photo)
                if not src:
                    continue

                filename = f"{clip_index:02d}_{_slugify(query)}.jpg"
                dest     = os.path.join(section_dir, filename)

                if not force and os.path.exists(dest):
                    print(f"[PexelsAgent] [{section}] Already exists: {filename}")
                else:
                    print(f"[PexelsAgent] [{section}] ↓ {filename}  (photo)")
                    try:
                        download_file(src, dest)
                    except Exception as e:
                        print(f"[PexelsAgent] [{section}] Download failed: {e}")
                        continue

                assets.append({
                    "index":        clip_index,
                    "section":      section,
                    "query":        query,
                    "file":         dest,
                    "filename":     filename,
                    "type":         "photo",
                    "pexels_id":    photo["id"],
                    "pexels_url":   photo.get("url", ""),
                    "credit":       photo.get("photographer", "Unknown"),
                    "credit_url":   photo.get("photographer_url", ""),
                    "width":        photo.get("width"),
                    "height":       photo.get("height"),
                    "duration_sec": None,
                })
                clip_index += 1

    return assets


# ── Claude query generation ───────────────────────────────────────────────────

def _generate_queries(script: str) -> dict:
    """
    Sends the first 4000 chars of the script to Claude once.
    Returns a dict: { "SECTION": ["query1", "query2", "query3"], ... }

    Queries are designed for what actually exists in Pexels:
    generic, atmospheric, cinematic — NOT specific classified unit names.
    """
    prompt = f"""You are a documentary video editor selecting stock footage for Phantom Directive,
a classified military history YouTube channel. Slogan: "Classified History. Declassified."

Read the script below and generate Pexels stock footage search queries for each section.
The queries MUST work with what Pexels actually has:
  ✓ Short (2–4 words) and generic enough to return real results
  ✓ Thematically appropriate — dark, cinematic, atmospheric, military or government
  ✗ Do NOT use classified unit names, operation code names, or specific events
    (Pexels has no footage of the ISA, Operation Eagle Claw, or Yellow Fruit)

SCRIPT (first 4 000 characters):
{script[:4000]}

SECTIONS: HOOK, CONTEXT, ORIGIN, OPERATIONS, COVERUP, CLOSING

For each section generate exactly 3 queries ordered from most thematic to most generic.
Each query should suggest a DIFFERENT visual idea for that section.

EXAMPLES OF GOOD QUERIES (these actually return results on Pexels):
  "military helicopter night"     "soldiers silhouette dark"     "classified documents paper"
  "government building aerial"    "pentagon exterior"            "military command room"
  "jungle military patrol"        "desert soldiers operation"    "surveillance camera building"
  "congressional hearing room"    "burning documents fire"       "military memorial sunset"
  "cold war era street"           "military base aerial"         "intelligence analyst screen"

Respond with ONLY this JSON — no explanations, no markdown:
{{
  "HOOK":       ["query 1", "query 2", "query 3"],
  "CONTEXT":    ["query 1", "query 2", "query 3"],
  "ORIGIN":     ["query 1", "query 2", "query 3"],
  "OPERATIONS": ["query 1", "query 2", "query 3"],
  "COVERUP":    ["query 1", "query 2", "query 3"],
  "CLOSING":    ["query 1", "query 2", "query 3"]
}}"""

    response = CLIENT.messages.create(
        model="claude-opus-4-7",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$',    '', raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[PexelsAgent] Could not parse Claude queries: {e}. Using defaults.")
        return _default_queries()


def _default_queries() -> dict:
    return {
        "HOOK":       ["military silhouette dark",      "classified document stamp",    "pentagon aerial night"],
        "CONTEXT":    ["government building washington", "cold war era street",          "military briefing room"],
        "ORIGIN":     ["military base aerial view",     "special forces training camp", "army command center"],
        "OPERATIONS": ["helicopter jungle military",    "desert military patrol",       "surveillance equipment room"],
        "COVERUP":    ["burning documents fire",        "empty government corridor",    "congressional hearing room"],
        "CLOSING":    ["military memorial sunset",      "soldiers silhouette flag",     "classified folder paper"],
    }


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', text.lower().strip())[:35].rstrip('_')
