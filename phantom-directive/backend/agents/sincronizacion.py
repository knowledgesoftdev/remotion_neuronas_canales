"""
SincronizacionAgent — Phantom Directive

Flow:
  1. Whisper timestamps → 10s slide blocks
  2. Claude: visual style (displayText, section, color, etc.)
  3. Claude: strict per-slide search query (one batch call)
  4. Claude: keywords + screen positions (one batch call)
  5. Per-slide media fetch: Pexels video → Pexels photo → Wikipedia → SerpAPI
     - time.sleep() between API calls to avoid rate-limiting
     - query cache: same query reuses already-downloaded file
  6. Write paragraphSlides.json + sequences.ts + introData.json
  7. Copy to remotion/src/
"""

import os
import json
import time
import unicodedata
import re
import anthropic

FPS    = 30
CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def _claude(model: str, max_tokens: int, messages: list, retries: int = 5) -> str:
    """
    Wrapper con retry automático para errores 529 (Overloaded) de Claude.
    Espera 15s entre intentos con backoff progresivo.
    """
    for attempt in range(retries):
        try:
            resp = CLIENT.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=messages,
            )
            return resp.content[0].text.strip()
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < retries - 1:
                wait = 15 * (attempt + 1)
                print(f"[SyncAgent] Claude overloaded (529). Reintentando en {wait}s... (intento {attempt+1}/{retries})")
                time.sleep(wait)
            else:
                raise
        except Exception:
            raise
    return ""

SLEEP_PEXELS    = 1.5   # seconds between Pexels API calls
SLEEP_WIKI      = 0.8   # seconds between Wikipedia API calls
SLEEP_SERP      = 0.8   # seconds between SerpAPI calls

ICONS_AVAILABLE = [
    "server", "users", "code", "cpu", "globe", "database",
    "trending-down", "check-circle", "lightbulb", "activity",
]

SECTION_DEFAULTS = {
    "HOOK":       {"color": "#ef4444", "style": "chapter"},
    "CONTEXT":    {"color": "#6366f1", "style": "chapter"},
    "ORIGIN":     {"color": "#f59e0b", "style": "chapter"},
    "OPERATIONS": {"color": "#00d4ff", "style": "chapter"},
    "COVERUP":    {"color": "#dc2626", "style": "chapter"},
    "CLOSING":    {"color": "#64748b", "style": "outro"},
}

LABEL_TO_KEY = {
    "HOOK":       "HOOK",
    "CONTEXT":    "CONTEXT",
    "ORIGIN":     "ORIGIN",
    "OPERATIONS": "OPERATIONS",
    "COVER-UP":   "COVERUP",
    "CLOSING":    "CLOSING",
}

# Slides that don't need a media background (they have their own full-screen design)
NO_MEDIA_STYLES = {"outro"}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r'[^a-z0-9 ]', '', text.lower())


# ─── Entry point ──────────────────────────────────────────────────────────────

def run(project_id: int, folder: str):
    whisper_path = os.path.join(folder, "whisper_output.json")
    script_path  = os.path.join(folder, "full_script.txt")

    with open(whisper_path, "r", encoding="utf-8") as f:
        whisper = json.load(f)
    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    segments = whisper.get("segments", [])
    sections = _detect_sections(script, segments)
    _write_sequences_ts(sections, folder, whisper)

    # ── Step 1: Build 10s slide blocks ────────────────────────────────────────
    raw_slides = _build_raw_slides(sections, segments)
    print(f"[SyncAgent] {len(raw_slides)} raw slides (10s blocks).")

    # ── Step 2: Claude → visual style (displayText, icon, color, style) ───────
    enriched = _enrich_with_claude(raw_slides, script)
    print(f"[SyncAgent] {len(enriched)} slides enriched with visual style.")

    # ── Step 3: Claude → one strict search query per slide ────────────────────
    needs_media = [s for s in enriched if s.get("style") not in NO_MEDIA_STYLES]
    print(f"[SyncAgent] Generating search queries for {len(needs_media)} slides...")
    queries = _generate_slide_queries(needs_media, script)

    # ── Step 4: Claude → keywords + screen positions ──────────────────────────
    print(f"[SyncAgent] Extracting keywords with positions for all slides...")
    all_keywords = _generate_slide_keywords(enriched)

    # ── Step 5: Fetch media per slide (rate-limited, with query cache) ─────────
    print(f"[SyncAgent] Fetching media for {len(needs_media)} slides (rate-limited)...")
    _fetch_media_for_slides(needs_media, queries, folder, project_id)

    # Slides that don't need media get null
    for s in enriched:
        if s.get("style") in NO_MEDIA_STYLES:
            s["mediaUrl"]  = None
            s["mediaType"] = None

    # ── Step 6: Embed keywords ────────────────────────────────────────────────
    for s, kws in zip(enriched, all_keywords):
        s["keywords"] = kws

    # ── Step 7: Write output ──────────────────────────────────────────────────
    out_path = os.path.join(folder, "paragraphSlides.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    print(f"[SyncAgent] paragraphSlides.json written ({len(enriched)} slides).")

    intro_data = _get_intro_data(script)
    with open(os.path.join(folder, "intro_data.json"), "w", encoding="utf-8") as f:
        json.dump(intro_data, f, ensure_ascii=False, indent=2)

    # ── Step 8: Copy to remotion/src/ ─────────────────────────────────────────
    remotion_src = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(folder))),
        "remotion", "src"
    )
    if os.path.isdir(remotion_src):
        import shutil
        shutil.copy(os.path.join(folder, "paragraphSlides.json"), os.path.join(remotion_src, "paragraphSlides.json"))
        shutil.copy(os.path.join(folder, "sequences.ts"),         os.path.join(remotion_src, "sequences.ts"))
        shutil.copy(os.path.join(folder, "intro_data.json"),      os.path.join(remotion_src, "introData.json"))
        print(f"[SyncAgent] Copied files to remotion/src/")


# ─── Section detection ────────────────────────────────────────────────────────

def _detect_sections(script: str, segments: list) -> dict:
    ordered_keys  = ["HOOK", "CONTEXT", "ORIGIN", "OPERATIONS", "COVERUP", "CLOSING"]
    total_duration = segments[-1]["end"] if segments else 1.0
    total_chars    = max(len(script), 1)

    char_positions: dict = {}
    for label, key in LABEL_TO_KEY.items():
        m = re.search(rf'^\[{re.escape(label)}\]', script, re.MULTILINE)
        if m:
            char_positions[key] = m.start()

    result: dict = {}
    for i, key in enumerate(ordered_keys):
        if key in char_positions:
            estimated_t = (char_positions[key] / total_chars) * total_duration
            closest = min(segments, key=lambda s: abs(s["start"] - estimated_t))
            result[key] = {"start": closest["start"]}
        else:
            idx = i * max(1, len(segments) // len(ordered_keys))
            result[key] = {"start": segments[min(idx, len(segments) - 1)]["start"]}

    for i, key in enumerate(ordered_keys):
        next_key = ordered_keys[i + 1] if i + 1 < len(ordered_keys) else None
        end = segments[-1]["end"] if not next_key else result[next_key]["start"]
        result[key]["end"]      = end
        result[key]["from"]     = int(result[key]["start"] * FPS)
        result[key]["duration"] = max(30, int((end - result[key]["start"]) * FPS))

    return result


def _write_sequences_ts(sections: dict, folder: str, whisper: dict):
    total_frames = int(whisper["segments"][-1]["end"] * FPS) + 30
    lines = ["// AUTO-GENERADO por SincronizacionAgent\n",
             f"export const FPS = {FPS};\n\n",
             "export const SEQUENCES = {\n"]
    for key, val in sections.items():
        lines.append(f'  {key:<12}: {{ from: {val["from"]:>7}, duration: {val["duration"]:>5} }},\n')
    lines.append("} as const;\n\n")
    lines.append(f"export const TOTAL_FRAMES = {total_frames};\n")

    with open(os.path.join(folder, "sequences.ts"), "w", encoding="utf-8") as f:
        f.writelines(lines)


# ─── Raw slide builder (10s / 300-frame windows) ──────────────────────────────

def _build_raw_slides(sections: dict, segments: list) -> list:
    WINDOW = 300   # 10 seconds at 30fps
    slides = []
    for key, val in sections.items():
        start_frame = val["from"]
        end_frame   = start_frame + val["duration"]
        window_start = start_frame
        is_first_in_section = True
        while window_start < end_frame:
            window_end = window_start + WINDOW
            matching = [
                s["text"].strip()
                for s in segments
                if s["start"] * FPS >= window_start and s["start"] * FPS < window_end
            ]
            text = " ".join(matching).strip() or "..."
            slides.append({
                "section":  key,
                "from":     window_start,
                "duration": WINDOW,
                "text":     text,
                "is_first": is_first_in_section,
            })
            is_first_in_section = False
            window_start += WINDOW
    return slides


# ─── Claude: visual style per slide ──────────────────────────────────────────

def _enrich_with_claude(slides: list, script: str) -> list:
    from collections import defaultdict
    by_section = defaultdict(list)
    for s in slides:
        by_section[s["section"]].append(s)

    section_idea_counts = {}
    for sec, sec_slides in by_section.items():
        n_slides = len(sec_slides)
        n_ideas  = max(1, min(6, round(n_slides / 3)))
        section_idea_counts[sec] = n_ideas

    section_map = _get_section_visuals(script, section_idea_counts)

    # How many slides at the END of CLOSING keep the "outro" design.
    # All other CLOSING slides are treated as "newscard" (footage + narration text).
    OUTRO_TAIL = 2

    result = []
    for sec, sec_slides in by_section.items():
        ideas = section_map.get(sec, [])
        if not ideas:
            default = SECTION_DEFAULTS.get(sec, {"color": "#6366f1", "style": "newscard"})
            ideas = [{
                "displayText": sec_slides[0]["text"][:100],
                "icon": "activity",
                "color": default["color"],
                "style": default["style"],
                "number": None,
                "lowerThird": None,
            }]

        # Enforce: only the very first slide of a section can be "chapter".
        # Claude sometimes marks all ideas as "chapter" — fix that here.
        for idx_idea, idea in enumerate(ideas):
            if idx_idea > 0 and idea.get("style") == "chapter":
                idea["style"] = "newscard"

        n_ideas  = len(ideas)
        n_slides = len(sec_slides)
        for i, slide in enumerate(sec_slides):
            idea_idx = min(int(i * n_ideas / n_slides), n_ideas - 1)
            visual = ideas[idea_idx]

            # ── Style overrides ──────────────────────────────────────────────
            # Only slide index 0 of a section can be "chapter"
            if i > 0 and visual.get("style") == "chapter":
                visual = dict(visual, style="newscard")

            # CLOSING: only the last OUTRO_TAIL slides keep "outro".
            # All earlier CLOSING slides become "newscard" so they get media.
            if sec == "CLOSING" and visual.get("style") == "outro" and i < n_slides - OUTRO_TAIL:
                visual = dict(visual, style="newscard")

            # ── displayText ──────────────────────────────────────────────────
            style = visual.get("style", "newscard")
            if style == "newscard":
                # Use the actual Whisper narration text — unique per 10s block,
                # synced with what the narrator is saying at that moment.
                raw = slide["text"][:220].strip()
                display_text = raw if raw else visual.get("displayText", "")
            else:
                # chapter / stat / outro → keep Claude's impactful headline
                display_text = visual.get("displayText", slide["text"][:100])

            slide.pop("is_first", None)
            result.append({
                "from":        slide["from"],
                "duration":    slide["duration"],
                "section":     sec,
                "text":        slide["text"],
                "displayText": display_text,
                "style":       style,
                "number":      visual.get("number", None),
                "icon":        visual.get("icon", "activity"),
                "color":       visual.get("color", "#6366f1"),
                "lowerThird":  visual.get("lowerThird", None),
                "decisionNum": None,
                # media + keywords filled later
                "mediaUrl":    None,
                "mediaType":   None,
                "keywords":    [],
            })

    result.sort(key=lambda s: s["from"])
    return result


def _get_section_visuals(script: str, section_idea_counts: dict) -> dict:
    sections_desc = "\n".join(
        f'- {sec}: {n} idea{"s" if n > 1 else ""}'
        for sec, n in section_idea_counts.items()
    )

    prompt = f"""You are the visual director of Phantom Directive — a classified military history YouTube channel.
Read the full script below and extract concise visual ideas for each section.

SCRIPT:
{script}

SECTIONS AND NUMBER OF IDEAS:
{sections_desc}

AVAILABLE ICONS: {', '.join(ICONS_AVAILABLE)}

SEMANTIC COLORS:
- "#ef4444" → crisis, failure, scandal, collapse
- "#dc2626" → cover-up, erasure, denial
- "#00d4ff" → intelligence, covert operations
- "#f59e0b" → classified decision, pivot moment
- "#6366f1" → origin, creation, architecture of secrecy
- "#8b5cf6" → human cost, operators, soldiers
- "#64748b" → closing, legacy

STYLES:
- "chapter"  → first idea in a section (title card)
- "stat"     → impactful number, date, or figure
- "newscard" → general narration beat
- "outro"    → only for CLOSING section

RESPONSE FORMAT (exact JSON):
{{
  "SECTION_NAME": [
    {{
      "displayText": "6-10 word impactful headline like a declassified file header",
      "icon": "icon_name",
      "color": "#hexcolor",
      "style": "chapter|stat|newscard|outro",
      "number": "1980" or null,
      "lowerThird": "SHORT LABEL IN CAPS" or null
    }}
  ]
}}

RULES:
1. displayText is the VISUAL HEADLINE — distilled essence, like a classified folder header.
2. Ideas within a section must be DISTINCT from each other.
3. First idea per section always uses style "chapter".
4. CLOSING section uses "outro" for all ideas.
5. Respond ONLY with JSON.
"""
    print("[SyncAgent] Generating visual style with Claude...")
    raw = _claude("claude-opus-4-7", 6000, [{"role": "user", "content": prompt}])
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$',     '', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[SyncAgent] JSON error in visuals: {e}. Using defaults.")
        return {}


# ─── Claude: strict per-slide search queries ─────────────────────────────────

def _generate_slide_queries(slides: list, script: str) -> list[str]:
    """
    Generate ONE strict search query per slide.
    Processes in batches of 25 to avoid Claude truncating the JSON array.
    Returns list of str (same length as input slides).
    """
    BATCH = 25
    all_queries: list[str] = []

    for batch_start in range(0, len(slides), BATCH):
        batch     = slides[batch_start : batch_start + BATCH]
        batch_end = batch_start + len(batch)

        slides_text = "\n".join(
            f"{batch_start + i}: [{s['section']}] {s['text'][:200]}"
            for i, s in enumerate(batch)
        )

        prompt = f"""You are the visual researcher for Phantom Directive — classified military history YouTube channel.
Topic of this video (from the full script intro):
{script[:600]}

For each numbered text block below, generate ONE search query to find a relevant background video or image.

TEXT BLOCKS:
{slides_text}

STRICT RULES — read carefully:
1. The query MUST be directly about what that specific block is talking about.
   If it mentions a specific operation, person, place, or event — use that.
2. DO NOT generate generic queries like "military history", "soldiers", "dark background".
3. Queries must be 2-6 words, in English.
4. The query should work on Pexels (stock footage/photos) AND Google Images.
5. GOOD examples: "Operation Eagle Claw Iran 1980", "ISA Intelligence Support Activity",
   "Pentagon classified documents", "Delta Force hostage rescue Grenada"
6. BAD examples: "military", "dark soldiers", "government building", "history"
7. ALL queries in this batch must be UNIQUE — no two slides can share the same query.

Respond ONLY with a JSON array of exactly {len(batch)} strings (one per block):
["query for block {batch_start}", ..., "query for block {batch_end - 1}"]
"""
        print(f"[SyncAgent] Queries batch {batch_start//BATCH + 1}/{(len(slides)-1)//BATCH + 1} ({len(batch)} slides)...")
        raw = _claude("claude-opus-4-7", 3000, [{"role": "user", "content": prompt}])
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'\s*```$',     '', raw)

        try:
            batch_queries = json.loads(raw)
            if isinstance(batch_queries, list):
                if len(batch_queries) < len(batch):
                    batch_queries += [""] * (len(batch) - len(batch_queries))
                all_queries.extend(batch_queries[:len(batch)])
                continue
        except json.JSONDecodeError as e:
            print(f"[SyncAgent] JSON error in queries batch: {e}. Using empty for this batch.")

        all_queries.extend([""] * len(batch))

    return all_queries


# ─── Claude: keywords + screen positions ─────────────────────────────────────

def _generate_slide_keywords(slides: list) -> list[list]:
    """
    ONE Claude call → keywords with screen positions for every slide.
    Returns list of [{text, position}] per slide.
    """
    slides_text = "\n".join(
        f"{i}: {s.get('displayText', s.get('text', ''))[:120]}"
        for i, s in enumerate(slides)
    )

    prompt = f"""You are the visual overlay designer for Phantom Directive — classified military history channel.

For each visual headline, extract 1-3 short keywords or phrases to show as on-screen labels.
Each keyword gets a screen POSITION.

HEADLINES:
{slides_text}

AVAILABLE POSITIONS:
- "top-right"    → top right corner   (best for: years, dates, numbers like "1980", "96%")
- "mid-left"     → left side center   (best for: unit names, person names like "ISA", "Casey")
- "mid-right"    → right side center  (best for: locations, countries like "IRAN", "PENTAGON")
- "center"       → screen center      (best for: single dramatic words like "CLASSIFIED", "DENIED")

RULES:
1. Extract keywords FROM the actual headline text — do not invent new ones.
2. 1-3 keywords per slide. Use fewer for simple/short headlines.
3. Each keyword: maximum 3 words.
4. Use DIFFERENT positions within the same slide.
5. For "chapter" or "outro" style slides, return an empty array [].
6. Prefer specific proper nouns: operation names, unit names, dates, locations.
7. ALL CAPS for the keyword text.

Respond ONLY with a JSON array, one entry per headline (same order):
[
  [{{"text": "1980", "position": "top-right"}}, {{"text": "ISA", "position": "mid-left"}}],
  [{{"text": "CLASSIFIED", "position": "center"}}],
  [],
  ...
]
"""
    print("[SyncAgent] Extracting slide keywords with Claude...")
    raw = _claude("claude-opus-4-7", 6000, [{"role": "user", "content": prompt}])
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$',     '', raw)

    try:
        kws = json.loads(raw)
        if isinstance(kws, list):
            if len(kws) < len(slides):
                kws += [[] for _ in range(len(slides) - len(kws))]
            return kws[:len(slides)]
    except json.JSONDecodeError as e:
        print(f"[SyncAgent] JSON error in keywords: {e}. Using empty keywords.")

    return [[] for _ in slides]


# ─── Per-slide media fetching ─────────────────────────────────────────────────

def _fetch_media_for_slides(
    slides: list,
    queries: list[str],
    folder: str,
    project_id: int,
) -> None:
    """
    Fetches media for each slide based on its strict topic query.
    Writes mediaUrl + mediaType directly into each slide dict.

    Rate-limited with sleep between calls.

    Deduplication: tracks Pexels video/photo IDs that were already downloaded
    so the same stock clip never plays twice even when different queries return
    the same Pexels result.

    Query cache: same query string reuses the already-downloaded file for the
    first hit, but subsequent slides with the same query get different media
    (via the ID dedup set).
    """
    media_dir = os.path.join(folder, "media")
    os.makedirs(media_dir, exist_ok=True)

    # Cache: query → first downloaded asset (for instant reuse on identical queries)
    query_cache: dict[str, dict | None] = {}

    # Global dedup sets — prevent the same Pexels video/photo from appearing twice
    used_video_ids: set[int] = set()
    used_photo_ids: set[int] = set()

    total = len(slides)
    for i, (slide, query) in enumerate(zip(slides, queries)):
        section = slide.get("section", "MISC")
        print(f"[SyncAgent] [{i+1}/{total}] [{section}] '{query}'")

        if not query:
            slide["mediaUrl"]  = None
            slide["mediaType"] = None
            continue

        # ── Query cache hit (same exact query string) ─────────────────────────
        # Only reuse on the FIRST repeat; subsequent slides with same query
        # will have their IDs already in the dedup set → fetch a different clip.
        cache_key = query.strip().lower()
        if cache_key in query_cache:
            cached = query_cache[cache_key]
            if cached:
                rel = os.path.relpath(cached["file"], folder).replace(os.sep, "/")
                slide["mediaUrl"]  = f"http://localhost:8000/agents/{project_id}/media/{rel}"
                slide["mediaType"] = cached["type"]
                print(f"[SyncAgent] [{i+1}/{total}] CACHED: {cached['filename']}")
                # Remove from cache so the next identical query fetches a new clip
                del query_cache[cache_key]
            else:
                slide["mediaUrl"]  = None
                slide["mediaType"] = None
            continue

        # ── Determine section subfolder ───────────────────────────────────────
        section_dir = os.path.join(media_dir, section)
        os.makedirs(section_dir, exist_ok=True)

        asset = None

        # Alternate priority: even slides → video first; odd slides → photo first.
        # This ensures a natural mix of videos and images throughout the timeline.
        if i % 2 == 0:
            # Try video first
            asset = _try_pexels_video(query, i, section_dir, used_video_ids)
            time.sleep(SLEEP_PEXELS)
            if not asset:
                asset = _try_pexels_photo(query, i, section_dir, used_photo_ids)
                time.sleep(SLEEP_PEXELS)
        else:
            # Try photo first
            asset = _try_pexels_photo(query, i, section_dir, used_photo_ids)
            time.sleep(SLEEP_PEXELS)
            if not asset:
                asset = _try_pexels_video(query, i, section_dir, used_video_ids)
                time.sleep(SLEEP_PEXELS)

        # 3. Wikipedia (fallback for both)
        if not asset:
            asset = _try_wikipedia(query, i, section_dir)
            time.sleep(SLEEP_WIKI)

        # 4. SerpAPI
        if not asset:
            asset = _try_serpapi(query, i, section_dir)
            time.sleep(SLEEP_SERP)

        # Store first result (next identical query will fetch a different clip)
        query_cache[cache_key] = asset

        if asset:
            rel = os.path.relpath(asset["file"], folder).replace(os.sep, "/")
            slide["mediaUrl"]  = f"http://localhost:8000/agents/{project_id}/media/{rel}"
            slide["mediaType"] = asset["type"]
            print(f"[SyncAgent] [{i+1}/{total}] OK {asset['source']} -> {asset['filename']}")
        else:
            slide["mediaUrl"]  = None
            slide["mediaType"] = None
            print(f"[SyncAgent] [{i+1}/{total}] MISS No media found")


# ─── Source handlers (per-slide) ─────────────────────────────────────────────

def _slug(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', text.lower().strip())[:35].rstrip('_')


def _try_pexels_video(query: str, idx: int, section_dir: str, used_ids: set | None = None) -> dict | None:
    """
    Fetch the first Pexels video whose ID is NOT in `used_ids`.
    Requests up to 10 results so we have fallback options when top results are already used.
    Adds the downloaded video's Pexels ID to `used_ids` (mutates in place).
    """
    try:
        from services.pexels import search_videos, best_video_file, download_file
    except ImportError:
        return None

    try:
        # min_duration=10 ensures clips always cover the full 10s slide (300 frames @ 30fps)
        # without freezing on the last frame — no loop needed.
        videos = search_videos(query, per_page=10, min_duration=10)
    except Exception as e:
        print(f"  Pexels video error: {e}")
        return None

    if used_ids is None:
        used_ids = set()

    for video in videos:
        vid_id = video.get("id")
        if vid_id in used_ids:
            continue          # this clip was already used in another slide — skip it

        best = best_video_file(video)
        if not best:
            continue

        filename = f"{idx:03d}_{_slug(query)}.mp4"
        dest = os.path.join(section_dir, filename)

        # If file already downloaded (previous sync run) just reuse it
        if os.path.exists(dest):
            used_ids.add(vid_id)
            return {"file": dest, "filename": filename, "type": "video", "source": "pexels_video"}

        try:
            download_file(best["link"], dest, max_mb=80)
            used_ids.add(vid_id)
            return {"file": dest, "filename": filename, "type": "video", "source": "pexels_video"}
        except Exception as e:
            print(f"  Pexels video download failed: {e}")
            continue

    return None


def _try_pexels_photo(query: str, idx: int, section_dir: str, used_ids: set | None = None) -> dict | None:
    """
    Fetch the first Pexels photo whose ID is NOT in `used_ids`.
    Requests up to 10 results. Mutates `used_ids` with the downloaded photo's ID.
    """
    try:
        from services.pexels import search_photos, best_photo_src, download_file
    except ImportError:
        return None

    try:
        photos = search_photos(query, per_page=10)
    except Exception as e:
        print(f"  Pexels photo error: {e}")
        return None

    if used_ids is None:
        used_ids = set()

    for photo in photos:
        photo_id = photo.get("id")
        if photo_id in used_ids:
            continue

        src = best_photo_src(photo)
        if not src:
            continue

        filename = f"{idx:03d}_{_slug(query)}.jpg"
        dest = os.path.join(section_dir, filename)

        if os.path.exists(dest):
            used_ids.add(photo_id)
            return {"file": dest, "filename": filename, "type": "photo", "source": "pexels_photo"}

        try:
            download_file(src, dest)
            used_ids.add(photo_id)
            return {"file": dest, "filename": filename, "type": "photo", "source": "pexels_photo"}
        except Exception as e:
            print(f"  Pexels photo download failed: {e}")
            continue

    return None


def _try_wikipedia(query: str, idx: int, section_dir: str) -> dict | None:
    try:
        from services.wikipedia import search_images, download_image
    except ImportError:
        return None

    try:
        urls = search_images(query, limit=3)
    except Exception as e:
        print(f"  Wikipedia error: {e}")
        return None

    for url in urls:
        ext = "jpg" if ".jpg" in url.lower() else "png" if ".png" in url.lower() else "jpg"
        filename = f"{idx:03d}_{_slug(query)}_wiki.{ext}"
        dest = os.path.join(section_dir, filename)
        if os.path.exists(dest):
            return {"file": dest, "filename": filename, "type": "photo", "source": "wikipedia"}
        try:
            download_image(url, dest)
            return {"file": dest, "filename": filename, "type": "photo", "source": "wikipedia"}
        except Exception as e:
            print(f"  Wikipedia download failed: {e}")
            continue

    return None


def _try_serpapi(query: str, idx: int, section_dir: str) -> dict | None:
    if not os.environ.get("SERPAPI_KEY"):
        return None
    try:
        from services.serp_images import search_images, download_image
    except ImportError:
        return None

    try:
        results = search_images(query, num=3)
    except Exception as e:
        print(f"  SerpAPI error: {e}")
        return None

    for item in results:
        url = item.get("url", "")
        if not url:
            continue
        filename = f"{idx:03d}_{_slug(query)}_serp.jpg"
        dest = os.path.join(section_dir, filename)
        if os.path.exists(dest):
            return {"file": dest, "filename": filename, "type": "photo", "source": "serpapi"}
        try:
            download_image(url, dest, max_mb=15)
            return {"file": dest, "filename": filename, "type": "photo", "source": "serpapi"}
        except Exception as e:
            print(f"  SerpAPI download failed: {e}")
            continue

    return None


# ─── Intro data ───────────────────────────────────────────────────────────────

def _get_intro_data(script: str) -> dict:
    prompt = f"""Read the [HOOK] section of this Phantom Directive script and extract the data
for the video introduction screen. This is a classified military history channel.

SCRIPT (first 3000 characters):
{script[:3000]}

Return this exact JSON:
{{
  "title": "Short name of the subject (2-4 words, no articles)",
  "subtitle1": "First dramatic line about what it was (6-10 words)",
  "subtitle2": "Second closing line about what happened to it (4-8 words)",
  "dateRange": "YYYY — YYYY",
  "stat": "The most impactful number or date from the hook",
  "statDesc": "What that number represents in 3-5 words IN ALL CAPS",
  "statLine1": "Short sentence giving context to the stat",
  "statLine2": "Short sentence that closes the impact"
}}

RULES:
- title: only the name of the unit / operation / program — never a full sentence
- dateRange: years active or period covered
- stat: the most surprising fact — date, percentage, dollar figure, body count
- Respond ONLY with the JSON.
"""
    print("[SyncAgent] Generating intro data with Claude...")
    raw = _claude("claude-opus-4-7", 600, [{"role": "user", "content": prompt}])
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$',     '', raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "title": "Phantom Directive",
            "subtitle1": "The classified history they erased",
            "subtitle2": "until now",
            "dateRange": "1980 — present",
            "stat": "CLASSIFIED",
            "statDesc": "STILL ACTIVE",
            "statLine1": "A unit with no name. No record.",
            "statLine2": "And a history that won't stay buried.",
        }
