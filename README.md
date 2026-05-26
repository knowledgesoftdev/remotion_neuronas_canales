# Neural Studio

Sistema de producción automatizada de videos para YouTube usando IA. Cada canal opera de forma completamente independiente dentro de su propia carpeta.

---

## Estructura del repositorio

```
neural-studio/
├── codigo-muerto/        # Canal: Código Muerto (español)
│   ├── backend/          # FastAPI — puerto 8000
│   ├── frontend/         # React + Vite — puerto 5173
│   ├── remotion/         # Motor de video Remotion
│   ├── projects/         # Proyectos generados (guiones, audio, etc.)
│   └── AGENT_REMOTION.md # Prompt del agente Remotion para este canal
│
└── phantom-directive/    # Canal: Phantom Directive (inglés) — en desarrollo
    ├── backend/          # FastAPI — puerto 8001
    ├── frontend/         # React + Vite — puerto 5175
    ├── remotion/         # Motor de video Remotion
    └── projects/
```

Cada canal tiene su propia base de datos SQLite, carpeta de proyectos, venv de Python y node_modules. No comparten nada.

---

## Levantar Código Muerto

**Terminal 1 — Backend:**
```bash
cd codigo-muerto/backend
venv\Scripts\activate        # Windows
uvicorn main:app --reload --port 8000
# http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd codigo-muerto/frontend
npm run dev
# http://localhost:5173
```

**Terminal 3 — Remotion Studio** (previsualizar videos):
```bash
cd codigo-muerto/remotion
npm start
# http://localhost:3000
```

---

## Pipeline de producción

```
1. guion.py          → full_script.txt + narration.txt
                       Claude + SerpAPI investiga y escribe el guion

2. audio.py          → audio.mp3 + whisper_output.json
                       Fish Audio genera la voz, Whisper transcribe con timestamps

3. sincronizacion.py → sequences.ts + paragraphSlides.json
                       Convierte timestamps de Whisper a frames para Remotion

4. metadatos.py      → metadatos.txt + prompt_miniatura.txt
                       Claude genera título, descripción, tags y prompt de miniatura

5. AGENTE REMOTION   → video final
                       Ver codigo-muerto/AGENT_REMOTION.md
```

---

## APIs requeridas

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (guion + metadatos) |
| `SERPAPI_KEY` | Búsqueda web en el agente de guion |
| `FISH_AUDIO_API_KEY` | Síntesis de voz Fish Audio |
| `FISH_VOICE_ID` | ID de la voz en Fish Audio |
| `YOUTUBE_API_KEY` | YouTube Data API (analíticas) |
| `YOUTUBE_CHANNEL_ID` | ID del canal de YouTube |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth para YouTube Analytics |

---

## Tech stack

| Capa | Tecnología |
|---|---|
| Backend API | FastAPI + SQLModel + SQLite |
| IA | Claude Opus (Anthropic) |
| Transcripción | Whisper (OpenAI) |
| TTS | Fish Audio S2-Pro |
| Video | Remotion (React → MP4) |
| Iconos | Iconify + flat-color-icons / Lucide React |
| Frontend | React + Vite + TypeScript |
| Búsqueda web | SerpAPI |
