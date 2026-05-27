import os
import httpx
import anthropic

CLIENT = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")

SEARCH_TOOL = {
    "name": "web_search",
    "description": (
        "Search for real, verified information online. Use it to obtain "
        "exact dates, real figures, correct names and verifiable facts "
        "before writing the script. Search in English or other languages as needed."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            }
        },
        "required": ["query"],
    },
}


def _search(query: str) -> str:
    try:
        resp = httpx.get(
            "https://serpapi.com/search",
            params={
                "q": query,
                "api_key": SERPAPI_KEY,
                "hl": "en",
                "num": 6,
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for r in data.get("organic_results", []):
            results.append(
                f"Title: {r.get('title', '')}\n"
                f"Content: {r.get('snippet', '')}\n"
                f"Source: {r.get('link', '')}"
            )
        return "\n\n---\n\n".join(results) if results else "No results for that search."
    except Exception as e:
        return f"Search error: {e}"


def _build_prompt(title: str, topic: str) -> str:
    return f"""You are the head scriptwriter for Phantom Directive — a YouTube channel dedicated to classified military history.
Channel slogan: "Classified History. Declassified."

Your specialty: turning FOIA documents, black-ops programs, and erased government operations
into gripping documentary scripts that feel like reading a classified file for the first time.

Your voice: dark, cinematic, serious. Like a History Channel documentary crossed with a spy thriller.
Never sensationalist. Never conspiratorial. Always grounded in verifiable, sourced facts.
Every claim must be traceable to a real document, testimony, or credible investigation.

You have access to the web_search tool. You MUST use it exhaustively before writing a single word.
In this niche, credibility is the product. One invented fact destroys the entire channel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY RESEARCH PROTOCOL — follow this exact order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 1 — Declassified and official sources (2-3 searches):
  Search for FOIA releases, congressional records, Senate committee reports,
  and official declassifications related to the topic.
  Example: "ISA Intelligence Support Activity declassified FOIA documents"
           "Task Force Orange congressional oversight records"

PHASE 2 — Critical dates, names, and operations (3-4 searches):
  Verify every operation name, date, commander, unit designation, and outcome
  with specific, targeted searches. If two sources conflict, use the more
  conservative claim and acknowledge the discrepancy in the script.
  Example: "Operation Eagle Claw failure details April 1980"
           "Yellow Fruit scandal Pentagon 1982 1983"

PHASE 3 — Human accounts and investigative journalism (2-3 searches):
  Search for memoirs, declassified testimonies, congressional hearings,
  and investigative journalism (Washington Post, New York Times, military press).
  These add texture and weight that no encyclopedia can provide.
  Example: "ISA operators first-hand accounts" or "journalist investigation Task Force Orange"

PHASE 4 — Cross-verification (1-2 searches):
  Before writing, search "[topic] myths debunked" or "[topic] misconceptions"
  to avoid repeating discredited claims or internet fabrications.

Minimum 8 searches. No exceptions. Military history demands precision.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic: {topic}
Title: {title}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY LENGTH AND FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The narrated script must be between two thousand and two thousand five hundred words.
That equals approximately twelve to fifteen minutes of spoken narration.
Format: documentary voiceover only. No host on camera.
No camera directions. No scene descriptions. No production notes.
Only the words that will be spoken aloud over stock footage and images.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING RULES — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SENTENCES: Short and punchy in high-tension moments. Maximum twenty words per sentence
when delivering a revelation or a consequence. Alternate short punches with longer,
slower sentences to create documentary rhythm. Vary sentence length deliberately.

NUMBERS AND DATES: Always include them. Specific dates are the difference between
history and rumor. Write numbers in words when narrating:
  Correct: "nineteen eighty", "four thousand soldiers", "two hundred million dollars"
  Correct: "the late nineteen seventies", "by the fall of nineteen eighty-two"
  Incorrect: "1980", "$200M", "4,000"

ACRONYMS: Always expand on first use with the spoken form.
  Correct: "the Intelligence Support Activity — the I-S-A — was created in secret"
  Correct: "the Central Intelligence Agency, the C-I-A"
  Incorrect: "the ISA", "the CIA" (never without expansion on first mention)

TONE: Imagine reading a classified document aloud — with weight, with gravity, with restraint.
Not a conspiracy podcast. Not a thriller novel. A serious documentary with the texture
of a file that was never supposed to be opened.
Every fact should feel like evidence. Every name should feel like a name on a list.

VIEWER ENGAGEMENT: Include direct questions to the viewer at least five times throughout.
These must feel earned, not inserted:
  Good: "Think about what that actually means." / "Why would they go to that length?"
  Good: "How do you erase a unit from the record? You'll see."
  Never: "So, what happened next?" — that is filler, and this channel does not do filler.

TRANSITIONS: Never use generic transitions. Each section must end with a line that
makes the viewer need to keep watching.
  Good: "But that's not the part they buried." / "What happened next was never meant to come out."
  Good: "The file was sealed for a reason. And that reason was about to surface."
  Never: "Now let's talk about..." / "Moving on to the next part..."

DRAMATIC CONNECTORS: use these sparingly and only when earned:
  "What nobody in Washington knew was", "The file was sealed for a reason",
  "That decision would cost them everything", "And when it finally came out",
  "The order came from above", "No record. No trace. No acknowledgment."

S2-Pro INTONATION TAGS (inline voice modulation):
The voice engine reading this script understands inline tags. Use them sparingly —
maximum one tag per paragraph, only when the moment truly demands it:
  [professional broadcast tone] — use ONCE at the very start of the script, never again
  [serious]  — cover-ups, failures, consequences, moments of institutional deception
  [pause]    — just before a major revelation or a name being spoken for the first time
  [emphasis] — a key name, date, unit designation, or figure the viewer must remember
  [low]      — the darkest revelations, orders that crossed legal lines, erasures
  [grave]    — deaths, cover-ups that were ordered from above, oaths broken under pressure
Do NOT use [excited], [laughing], or [happy] — they are incompatible with this channel's tone.
Maximum one tag per paragraph. Tags go INLINE within the narration text.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOOD_VISUAL: [choose one: classified / cold-war / covert / dark-thriller / tactical]

[HOOK]
Forty-five seconds — six to eight sentences maximum.
Do NOT open with the topic name or the title of the video.
Open with what the viewer already knows — then shatter it with what they don't.
Use this pattern as a guide (not a template to copy — adapt it to the specific topic):
  "You've heard of [known thing]. You've heard of [known thing 2].
   But [the thing they don't know about] — that is a different story entirely."
The final sentence of the hook must feel like a door being opened to a room
that was sealed from the inside. The viewer must feel they are about to hear
something that was not supposed to come out.
Never start with "Today we're going to talk about...".

[CONTEXT]
One minute forty-five seconds — three to four paragraphs.
Why did this exist? What gap did it fill that nothing else could?
Be specific: name the presidents, name the intelligence failures, name the threat.
Paint the political and military landscape that made this unit, program, or operation
not just possible, but necessary. The viewer needs to understand the world before
this thing existed, so they can understand why it had to exist.
End this section with the weight of inevitability — something had to be created.

[ORIGIN]
Two minutes thirty seconds — three to four paragraphs.
How it began. Who created it. What cover names it used. What triggering event forced its creation.
Focus on the operational security architecture: why was it buried even from
other classified programs? Who knew? Who was deliberately kept in the dark?
Include the specific names, dates, and designations where they have been declassified.
End with the moment the unit became operational — and what that meant.

[OPERATIONS]
Four minutes — the longest and most critical section. At least five paragraphs.
What did they actually do? This is where the viewer either stays for the full video or leaves.
Make them stay.
Cover at least four distinct operations or theaters. For each:
  — Start with the confirmed, verifiable facts (date, location, objective)
  — Then what was reported but never officially acknowledged
  — Then what the outcome was and why it was never confirmed
Build tension progressively. The first operation should feel methodical.
The last should feel like it crossed a line that cannot be uncrossed.
Specific numbers, specific places, specific names where declassified.
No vague language. No "allegedly" without a source to back it up.

[COVER-UP]
Three minutes — three to four paragraphs.
The scandal. The erasure. The silence.
Who ordered the cover-up? What specifically was buried and why?
What happened to the operators — the men told to deny their own existence under oath?
Include the congressional oversight failures: who was supposed to watch them, and why they looked away.
End with the unit's current status. What do we actually know today?
Is it still operational under a different name? What has been confirmed since?
Leave this section feeling unresolved — because it is.

[CLOSING]
One minute — one to two paragraphs.
Do not tie anything up neatly. Do not offer resolution.
Leave the viewer with a question they will carry into their day.
The final question must connect the specific topic to a broader, uncomfortable truth
about institutional secrecy and the gap between official history and what actually happened.
End with the channel call-to-action — subscribe, comment with what they know or believe.
The very last sentence must feel like the closing of a classified file
that will be reopened again someday.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL OUTPUT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Follow the research protocol (minimum 8 searches) before writing a single word.
When research is complete, write the script DIRECTLY without any preamble.
The first line of your output must be: MOOD_VISUAL: ...
Do NOT write: "I have enough information", "Now I will write", "Based on my research",
or any commentary before the script. Those lines will never be spoken. Do not write them.
No markdown formatting. No # headers. No bold or italic. No explanations.
Section labels go on their own line exactly as shown: [HOOK], [CONTEXT], [ORIGIN],
[OPERATIONS], [COVER-UP], [CLOSING]
Just the script. Nothing else.

If mid-script you realize you need to verify a fact — stop and use web_search.
Accuracy is the only thing that separates Phantom Directive from every other channel
trying to tell these stories.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


def run(project_id: int, title: str, topic: str, folder: str, force: bool = False):
    full_path = os.path.join(folder, "full_script.txt")
    narration_path = os.path.join(folder, "narration.txt")

    if not force and os.path.exists(full_path) and os.path.exists(narration_path):
        print(f"[GuionAgent] Script already exists in {folder}, skipping Claude call.")
        _save_mood(project_id, open(full_path, encoding="utf-8").read())
        return

    messages = [{"role": "user", "content": _build_prompt(title, topic)}]

    while True:
        response = CLIENT.messages.create(
            model="claude-opus-4-7",
            max_tokens=16000,
            tools=[SEARCH_TOOL],
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    print(f"[GuionAgent] Searching: {block.input['query']}")
                    result = _search(block.input["query"])
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            messages.append({"role": "user", "content": tool_results})

        else:
            script = ""
            for block in response.content:
                if hasattr(block, "text"):
                    script += block.text
            break

    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "full_script.txt"), "w", encoding="utf-8") as f:
        f.write(script)

    narration = _extract_narration(script)
    with open(os.path.join(folder, "narration.txt"), "w", encoding="utf-8") as f:
        f.write(narration)

    _save_mood(project_id, script)


def _extract_narration(script: str) -> str:
    import re
    lines = script.split("\n")
    result = []
    in_script = False

    section_header = re.compile(r'^\[[A-Z\s\d:°\/\-]+\]$')

    for line in lines:
        stripped = line.strip()

        if not in_script:
            if stripped.startswith("MOOD_VISUAL:") or section_header.match(stripped):
                in_script = True
            else:
                continue

        if not stripped:
            result.append("")
            continue
        if stripped.startswith("MOOD_VISUAL:"):
            continue
        if re.match(r'^\[ANIMATION', stripped, re.IGNORECASE):
            continue
        if section_header.match(stripped):
            continue

        result.append(stripped)

    return "\n".join(result).strip()


def _save_mood(project_id: int, script: str):
    import re
    from sqlmodel import Session
    from database import engine
    from models import Project

    match = re.search(r'MOOD_VISUAL:\s*(.+)', script)
    if not match:
        return
    mood = match.group(1).strip()
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if project:
            project.mood = mood
            session.add(project)
            session.commit()
