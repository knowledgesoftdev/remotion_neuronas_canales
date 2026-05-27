# Phantom Directive

> **"Classified History. Declassified."**  
> AI-powered pipeline for generating YouTube videos about classified military history, covert operations, and government black programs.

---

## Architecture Overview

```
Frontend (React + Vite)
        │
        ▼
Backend (FastAPI + SQLModel)
        │
   ┌────┴────────────────────────────────────┐
   │              Agent Pipeline             │
   │                                         │
   │  1. Script (Claude Opus)                │
   │  2. Audio (Fish Audio TTS + Whisper)    │
   │  3. Visual sync (Claude + Pexels)       │
   │  4. Metadata (Claude Opus)              │
   │  5. Thumbnail (Claude → DALL·E / FLUX)  │
   └─────────────────────────────────────────┘
        │
        ▼
Remotion (React-based video renderer)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, TanStack Query |
| Backend | FastAPI, SQLModel, SQLite |
| AI / LLM | Anthropic Claude Opus (`claude-opus-4-7`) |
| TTS | Fish Audio API |
| Transcription | OpenAI Whisper (`base` model, CPU) |
| Stock media | Pexels API (videos + photos) |
| Video render | Remotion 4.x |
| Analytics | YouTube Data API v3 + manual CTR tracking |

---

## Project Structure

```
phantom-directive/
├── backend/
│   ├── main.py                  # FastAPI app, router registration
│   ├── database.py              # SQLite engine + session
│   ├── models/                  # SQLModel table definitions
│   ├── api/
│   │   ├── agents.py            # POST /agents/{id}/run-* endpoints
│   │   ├── analytics.py         # GET /analytics/summary, channel, videos
│   │   └── projects.py          # CRUD /projects/
│   ├── agents/
│   │   ├── pipeline.py          # Orchestrates full agent chain
│   │   ├── guion.py             # Script generation (Claude)
│   │   ├── audio.py             # Fish Audio TTS + Whisper transcription
│   │   ├── sincronizacion.py    # Visual sync: slide queries, Pexels fetch
│   │   ├── visual.py            # Per-slide Claude visual direction
│   │   ├── metadatos.py         # Titles, description, tags, chapters (Claude)
│   │   ├── miniaturas.py        # Thumbnail prompt generation (Claude)
│   │   ├── media.py             # Pexels helpers
│   │   ├── pexels.py            # Pexels API wrapper
│   │   └── analiticas.py        # Suggested titles + performance alerts
│   └── services/
│       ├── youtube.py           # YouTube Data API sync
│       ├── youtube_analytics.py # YouTube Analytics API
│       ├── oauth.py             # Google OAuth2 flow
│       ├── pexels.py            # Pexels search service
│       ├── serp_images.py       # SerpAPI image search fallback
│       └── wikipedia.py         # Wikipedia research helper
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Index.tsx         # Dashboard (stats, alerts)
│       │   ├── Projects.tsx      # Projects list
│       │   ├── NewProject.tsx    # Create project + AI suggestions
│       │   ├── ProjectDetail.tsx # Per-project pipeline control
│       │   └── Videos.tsx        # Published videos + CTR editor
│       └── components/
│           └── ...               # Shared UI components
└── remotion/
    └── src/
        ├── Root.tsx              # Remotion composition entry
        ├── VideoComposition.tsx  # Main composition (reads slides JSON)
        └── components/scenes/
            ├── IntroScene.tsx    # Hook / title card
            ├── NewsCard.tsx      # Main content slides (OffthreadVideo)
            ├── StatScene.tsx     # Statistics/data slides
            ├── ListScene.tsx     # Bullet-point list slides
            └── OutroScene.tsx    # Subscribe CTA + optional media bg
```

---

## Agent Pipeline

### 1. Script Agent (`agents/guion.py`)
- Generates a structured script with sections: HOOK, CONTEXT, MAIN, EVIDENCE, CLOSING
- Uses Claude Opus with the channel's niche prompt (classified military history)
- Outputs: `narration.txt`, `full_script.txt`, `slides.json`

### 2. Audio Agent (`agents/audio.py`)
- Splits narration into ≤ 4500-char chunks (by paragraph)
- Calls **Fish Audio API** with a cloned voice (set via `FISH_VOICE_ID`)
- Concatenates chunks → `audio.mp3`
- Runs **Whisper** (`base` model, CPU, English) for word-level timestamps → `whisper_output.json`

### 3. Visual Sync Agent (`agents/sincronizacion.py`)
- Reads `slides.json` + `whisper_output.json`
- Assigns each slide a time window from Whisper timestamps
- Batches slides in groups of 25 → asks Claude for Pexels search queries per slide
- Fetches media from Pexels (alternates video/photo per slide, deduplicates by `video_id` / `photo_id`)
- For CLOSING section: only last 2 slides use `outro` style; earlier ones become `newscard` with media
- Outputs: `slides_with_media.json`

### 4. Visual Direction Agent (`agents/visual.py`)
- Claude assigns visual style per slide (newscard, stat, list, intro, outro)
- Sets display text: newscard slides use Whisper narration text (unique per slide); outros use short headlines

### 5. Metadata Agent (`agents/metadatos.py`)
- Claude generates: 3 title variants, full description, chapters (with timestamps), 15 tags, 5 hashtags, thumbnail prompt
- Outputs: `metadatos.json`, `metadatos.txt`

### 6. Thumbnail Agent (`agents/miniaturas.py`)
- Generates image with DALL·E or FLUX based on `thumbnail_prompt`
- Outputs: `thumbnail.png` or `thumbnail.jpg`

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- FFmpeg (for Remotion rendering)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

**Environment variables** — create `backend/.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...
FISH_AUDIO_API_KEY=...
FISH_VOICE_ID=...              # Fish Audio reference voice ID
PEXELS_API_KEY=...
YOUTUBE_API_KEY=...            # Optional: YouTube Data API
YOUTUBE_CHANNEL_ID=UC...       # Optional: for sync
GOOGLE_CLIENT_ID=...           # Optional: YouTube Analytics OAuth
GOOGLE_CLIENT_SECRET=...       # Optional: YouTube Analytics OAuth
```

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5175
```

### Remotion Studio

```bash
cd remotion
npm install
npm run studio                 # http://localhost:3000
```

> **Note:** Always use `OffthreadVideo` (not `Video`) for Pexels media URLs — Remotion's Studio proxies `OffthreadVideo` to avoid CORS issues, while `Video` uses the browser HTML5 element which blocks cross-origin `localhost:8000` URLs.

---

## YouTube Analytics

1. Go to **Settings → YouTube** in the dashboard
2. Click **Connect YouTube Analytics** (Google OAuth)
3. Click **Sync Channel** to pull subscriber count and video metrics
4. CTR must be set manually per video via the **Videos** page (YouTube Studio → Content → CTR %)

> `ChannelStats.avg_ctr` stores engagement rate (likes/views) — NOT real CTR. Real CTR lives in `VideoMetrics.ctr` and is entered manually.

---

## AI Title Suggestions

The **New Project** page shows 5 Claude-generated video ideas based on channel performance data. Suggestions are cached in `SuggestedTitle` table and regenerated when all 5 are used.

Prompt is tuned for **Phantom Directive** niche:
- Audience: military intelligence, covert ops, black programs, government secrecy
- Tone: dark, urgent, classified-file feeling
- Formulas: "The [Unit] More Classified Than [X]", "When [Agency] [Action]", "The [Program] The Pentagon Never Admitted"

---

## Video Export

1. Run all agents via **ProjectDetail** page (or one-click **Run Full Pipeline**)
2. Open Remotion Studio: `cd remotion && npm run studio`
3. Select the composition for your project
4. Click **Render** (or use CLI: `npx remotion render`)
5. Upload the exported `.mp4` to YouTube
6. After 2+ days, check **Dashboard** for performance alerts

---

## Performance Alerts

The dashboard automatically flags published videos with:
- **Low CTR**: below 70% of channel average → suggests new title / thumbnail
- **Low retention**: below 70% of channel average → suggests hook rewrite

Clicking an alert triggers Claude to generate: 3 alternative titles, improved hook (first 3 sentences rewritten), new thumbnail prompt, and a diagnosis.
