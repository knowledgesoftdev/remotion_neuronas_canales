"""
MetadatosAgent — Phantom Directive

Generates complete YouTube metadata from the video script:
  - 3 title variations (max 60 chars, SEO + CTR optimized)
  - Description (150-200 words, hook in first 2 lines, CTA)
  - Chapters (curiosity-driven titles from real timestamps)
  - 30 tags (broad + specific + long-tail mix)
  - 5 hashtags
  - Thumbnail prompt (cinematic, classified documentary style)

Output files:
  metadatos.json        — structured JSON (used by API)
  metadatos.txt         — human-readable text copy
  prompt_miniatura.txt  — thumbnail prompt (used by miniatura generator)
"""

import os
import re
import json
import time
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


# ─── Entry point ──────────────────────────────────────────────────────────────

def run(project_id: int, folder: str):
    script_path    = os.path.join(folder, "full_script.txt")
    sequences_path = os.path.join(folder, "sequences.ts")

    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    timestamps      = _parse_timestamps(sequences_path)
    channel_context = _get_channel_context()

    print("[MetadatosAgent] Generating metadata with Claude...")
    raw = _claude_with_retry(_build_prompt(script, timestamps, channel_context))

    # Parse structured JSON block
    data = _parse_output(raw, timestamps)

    # Save structured JSON
    json_path = os.path.join(folder, "metadatos.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Save human-readable text
    txt_path = os.path.join(folder, "metadatos.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(_to_text(data))

    # Save thumbnail prompt separately
    if data.get("thumbnail_prompt"):
        with open(os.path.join(folder, "prompt_miniatura.txt"), "w", encoding="utf-8") as f:
            f.write(data["thumbnail_prompt"])

    print(f"[MetadatosAgent] Done. Saved to {json_path}")
    return data


# ─── Claude call with retry ───────────────────────────────────────────────────

def _claude_with_retry(prompt: str, retries: int = 5) -> str:
    for attempt in range(retries):
        try:
            resp = CLIENT.messages.create(
                model="claude-opus-4-7",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except anthropic.APIStatusError as e:
            if e.status_code == 529 and attempt < retries - 1:
                wait = 15 * (attempt + 1)
                print(f"[MetadatosAgent] Claude overloaded (529). Retrying in {wait}s... ({attempt+1}/{retries})")
                time.sleep(wait)
            else:
                raise
    return ""


# ─── Prompt builder ───────────────────────────────────────────────────────────

def _build_prompt(script: str, timestamps: dict, channel_context: str) -> str:

    channel_block = ""
    if channel_context:
        channel_block = f"""
CHANNEL PERFORMANCE DATA (use to replicate what works best):
{channel_context}
"""

    # Build chapter context: timestamp + section name
    chapter_hints = "\n".join(
        f"  {ts} — section: {sec}" for sec, ts in timestamps.items()
    )

    return f"""You are a YouTube SEO expert specializing in military history channels.
Channel: Phantom Directive — "Classified History. Declassified."
Audience: People fascinated by military intelligence, covert operations, and government secrecy.
Tone: Dark, mysterious, serious. Every line must feel classified and urgent.
{channel_block}
VIDEO SCRIPT (first 5000 chars):
{script[:5000]}

ACTUAL SECTION TIMESTAMPS:
{chapter_hints}

Generate ALL of the following. Return ONLY the JSON block below — no text outside it.

{{
  "titles": [
    "Title variation 1 — max 60 chars — formula: The [X] More Classified Than [Y]",
    "Title variation 2 — max 60 chars — formula: When [Unit] [Dramatic Action]",
    "Title variation 3 — max 60 chars — most click-worthy variation"
  ],
  "description": "Full description 150-200 words. RULES: First 2 lines must work as a hook WITHOUT clicking show more. Include these keywords naturally in first 3 lines: classified military unit, intelligence support activity, secret US military. Never start with 'In this video'. Start with a fact or provocative claim. End with: Subscribe CTA + one question for comments. Add the 5 hashtags at the very end.",
  "chapters": [
    {{"timestamp": "0:00", "title": "Chapter title that creates curiosity — not the section name"}},
    {{"timestamp": "X:XX", "title": "..."}},
    {{"timestamp": "X:XX", "title": "..."}},
    {{"timestamp": "X:XX", "title": "..."}},
    {{"timestamp": "X:XX", "title": "..."}},
    {{"timestamp": "X:XX", "title": "..."}}
  ],
  "tags": [
    "tag 1", "tag 2", "tag 3"
  ],
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3", "#Hashtag4", "#Hashtag5"],
  "thumbnail_prompt": "Detailed AI image generation prompt for the thumbnail"
}}

TITLE RULES:
- Maximum 60 characters each
- Strong emotional hook — feels like a classified file being opened
- Proven formulas: "The [X] More Classified Than [Y]" or "When [Unit] [Dramatic Action]"
- Never generic — must feel specific to THIS video's topic

DESCRIPTION RULES:
- 150-200 words total including chapters and CTA
- First 2 lines: shocking hook visible without expanding (no spoilers, pure tension)
- Include keywords: "classified military unit", "intelligence support activity", "secret US military"
- Chapters section: use format "📌 CHAPTERS" then list each with timestamp and curiosity-driven title
- End: "🔔 Subscribe for classified history every week." + one specific question about the video
- Last line: 5 hashtags

CHAPTER RULES:
- Use the EXACT timestamps provided above
- DO NOT use section names (HOOK, CONTEXT, etc.) as chapter titles
- Each title must create curiosity and make the viewer want to keep watching
- Write as if declassifying a document for the first time
- Example: instead of "ORIGIN" write "Born From The Ashes of a Failed Rescue"

TAGS RULES (exactly 30 tags):
- 10 broad: military history, classified military, black ops, secret units, covert operations, etc.
- 10 specific to THIS video: unit names, operation names, key people, locations
- 10 long-tail: "most secret military unit ever", "pentagon classified programs 2024", etc.
- No hashtag symbol in tags, natural phrasing

HASHTAGS RULES (exactly 5):
- Mix: 2 broad (#MilitaryHistory #BlackOps), 2 niche (#ClassifiedHistory #SecretMilitary), 1 brand (#PhantomDirective)

THUMBNAIL PROMPT RULES:
- Style: Dark thriller documentary. Classified government file aesthetic.
- Background: Near-black, subtle tactical grid texture, faint redacted document lines
- Central figure: Shadowy special forces operator, face hidden, tactical gear, weapon at low ready
- Overlays: Red distressed CLASSIFIED stamp top-right tilted, "EYES ONLY" text bottom-left,
  partial US government seal left edge faded, redacted text blocks, coordinate strings
- Main text on thumbnail: 3-4 bold words, white with red glow, 40% of frame
- Secondary text: specific subtitle about THIS video's subject, smaller white text
- Colors: Black (#0a0a0a), deep red (#cc1111), white only. No other colors.
- Format: 1280x720px YouTube thumbnail, high contrast, readable at 120px
- Mood: Forbidden knowledge. Dangerous. Something the government doesn't want seen.
- Must look like a serious documentary, NOT a conspiracy theory

Respond ONLY with the JSON. No markdown, no explanation."""


# ─── Output parser ────────────────────────────────────────────────────────────

def _parse_output(raw: str, timestamps: dict) -> dict:
    # Strip markdown code fences if present
    raw = re.sub(r'^```json\s*', '', raw.strip())
    raw = re.sub(r'\s*```$', '', raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[MetadatosAgent] JSON parse error: {e}. Using raw text fallback.")
        data = {}

    # Ensure all keys exist with sensible defaults
    if not data.get("titles"):
        data["titles"] = ["Phantom Directive — Classified History"]
    if not data.get("description"):
        data["description"] = "(Description generation failed — re-run metadatos agent)"
    if not data.get("chapters"):
        data["chapters"] = [{"timestamp": ts, "title": sec} for sec, ts in timestamps.items()]
    if not data.get("tags"):
        data["tags"] = []
    if not data.get("hashtags"):
        data["hashtags"] = ["#PhantomDirective", "#ClassifiedHistory", "#MilitaryHistory"]
    if not data.get("thumbnail_prompt"):
        data["thumbnail_prompt"] = ""

    # Enforce title length
    data["titles"] = [t[:60] for t in data["titles"]]

    # Enforce tag count
    data["tags"] = data["tags"][:30]

    # Enforce hashtag count
    data["hashtags"] = data["hashtags"][:5]

    return data


# ─── Human-readable text serializer ──────────────────────────────────────────

def _to_text(data: dict) -> str:
    lines = []

    lines.append("=" * 64)
    lines.append("TITLES")
    lines.append("=" * 64)
    for i, t in enumerate(data.get("titles", []), 1):
        lines.append(f"{i}. {t}")

    lines.append("\n" + "=" * 64)
    lines.append("DESCRIPTION")
    lines.append("=" * 64)
    lines.append(data.get("description", ""))

    lines.append("\n" + "=" * 64)
    lines.append("CHAPTERS")
    lines.append("=" * 64)
    for ch in data.get("chapters", []):
        lines.append(f"{ch['timestamp']} — {ch['title']}")

    lines.append("\n" + "=" * 64)
    lines.append("TAGS (30)")
    lines.append("=" * 64)
    lines.append(", ".join(data.get("tags", [])))

    lines.append("\n" + "=" * 64)
    lines.append("HASHTAGS")
    lines.append("=" * 64)
    lines.append(" ".join(data.get("hashtags", [])))

    lines.append("\n" + "=" * 64)
    lines.append("THUMBNAIL PROMPT")
    lines.append("=" * 64)
    lines.append(data.get("thumbnail_prompt", ""))

    return "\n".join(lines)


# ─── Timestamp parser ─────────────────────────────────────────────────────────

def _parse_timestamps(sequences_path: str) -> dict:
    result = {}
    if not os.path.exists(sequences_path):
        return result
    with open(sequences_path, "r", encoding="utf-8") as f:
        content = f.read()
    for match in re.finditer(r'(\w+)\s*:\s*\{\s*from:\s*(\d+),\s*duration:\s*(\d+)', content):
        key        = match.group(1)
        from_frame = int(match.group(2))
        seconds    = from_frame // 30
        m, s       = divmod(seconds, 60)
        result[key] = f"{m}:{s:02d}"
    return result


# ─── Channel context from analytics ──────────────────────────────────────────

def _get_channel_context() -> str:
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import VideoMetrics

        with Session(engine) as session:
            videos = session.exec(select(VideoMetrics)).all()

        if not videos:
            return ""

        scored = []
        for v in videos:
            if v.title and v.views > 0:
                score = v.ctr * v.avg_view_percentage
                scored.append({
                    "title":          v.title,
                    "ctr":            v.ctr,
                    "retention_pct":  v.avg_view_percentage,
                    "views":          v.views,
                    "score":          round(score, 2),
                })

        if not scored:
            return ""

        scored.sort(key=lambda x: x["score"], reverse=True)
        top = scored[:5]

        lines = ["Top performing videos (CTR x retention):"]
        for i, v in enumerate(top, 1):
            lines.append(
                f'{i}. "{v["title"]}" — '
                f'CTR: {v["ctr"]}% | Retention: {v["retention_pct"]}% | Views: {v["views"]:,}'
            )

        avg_ctr = sum(v["ctr"] for v in scored) / len(scored)
        avg_ret = sum(v["retention_pct"] for v in scored) / len(scored)
        lines.append(f"\nChannel average: CTR {avg_ctr:.1f}% | Retention {avg_ret:.1f}%")
        return "\n".join(lines)

    except Exception as e:
        print(f"[MetadatosAgent] Channel context unavailable: {e}")
        return ""
