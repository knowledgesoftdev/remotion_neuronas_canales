# Neural Studio

Sistema de producción automatizada de videos para YouTube usando IA. Cada canal opera de forma completamente independiente dentro de su propia carpeta.

---

## Estructura del repositorio

```
neural-studio/
├── launcher/             # Selector de canal — puerto 5172
│   ├── api/server.mjs    # Servidor Node que gestiona procesos (puerto 5171)
│   └── src/              # UI React (Vite)
│
├── codigo-muerto/        # Canal: Código Muerto (español)
│   ├── backend/          # FastAPI — puerto 8000
│   ├── frontend/         # React + Vite — puerto 5173
│   ├── remotion/         # Motor de video Remotion — puerto 3000
│   ├── projects/         # Proyectos generados (guiones, audio, etc.)
│   └── AGENT_REMOTION.md # Prompt del agente Remotion para este canal
│
└── phantom-directive/    # Canal: Phantom Directive (inglés)
    ├── backend/          # FastAPI — puerto 8001
    ├── frontend/         # React + Vite — puerto 5175
    ├── remotion/         # Motor de video Remotion — puerto 3000
    └── projects/
```

Cada canal tiene su propia base de datos SQLite, carpeta de proyectos, venv de Python y node_modules. No comparten nada.

---

## Launcher — punto de entrada unificado

El launcher permite seleccionar con qué canal trabajar. Al hacer clic en **▶ Iniciar** arranca automáticamente el backend, el frontend y Remotion del canal elegido. Solo un canal puede estar activo a la vez.

```bash
cd launcher
npm install       # solo la primera vez
npm run dev
# http://localhost:5172
```

El launcher corre dos procesos en paralelo:
- `[API]` — servidor Node en `localhost:5171` que gestiona y monitorea los procesos hijo
- `[VITE]` — UI del selector en `localhost:5172`

Al reiniciar el launcher limpia automáticamente cualquier proceso huérfano de sesiones anteriores (puertos 8000, 8001, 5173, 5175, 3000).

### Primera vez — instalar dependencias de cada canal

**Código Muerto:**
```bash
cd codigo-muerto/backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
cd ../frontend && npm install
cd ../remotion && npm install
```

**Phantom Directive:**
```bash
cd phantom-directive/backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
cd ../frontend && npm install
cd ../remotion && npm install
```

---

## Pipeline de producción

```
1. GuionAgent        → full_script.txt + narration.txt
                       Claude + SerpAPI investiga y escribe el guion

2. AudioAgent        → audio.mp3 + whisper_output.json
                       Fish Audio genera la voz (FP16, GPU CUDA)
                       Whisper medium transcribe con timestamps

3. SincronizacionAgent → sequences.ts + paragraphSlides.json
                         Convierte timestamps de Whisper a frames para Remotion

4. MetadatosAgent    → metadatos.txt + prompt_miniatura.txt
                       Claude genera título, descripción, tags y prompt de miniatura

5. Ver en Remotion   → Exporta el proyecto al motor de video
                       visual.py llama a Claude para:
                         · Datos de intro (introData.json)
                         · Reescritura visual de cada slide (displayText + icono)
                         · Paleta semántica y secciones (visualData.json)
                       Copia todo a remotion/ y abre preview en localhost:3000

6. Renderizar video  → video.mp4 final (Remotion CLI)
```

### Archivos generados por proyecto

| Archivo | Generado por | Descripción |
|---|---|---|
| `narration.txt` | GuionAgent | Texto de la narración |
| `full_script.txt` | GuionAgent | Guion completo con estructura |
| `audio.mp3` | AudioAgent | Voz sintetizada |
| `whisper_output.json` | AudioAgent | Transcripción con timestamps |
| `sequences.ts` | SincronizacionAgent | Secuencias Remotion en frames |
| `paragraphSlides.json` | SincronizacionAgent + VisualAgent | Slides enriquecidos con Claude |
| `visual_data.json` | VisualAgent | Datos de secciones, legado, criterio |
| `intro_data.json` | VisualAgent | Datos específicos de la intro |
| `metadatos.txt` | MetadatosAgent | Título, descripción, tags YouTube |
| `prompt_miniatura.txt` | MetadatosAgent | Prompt para generar la miniatura |

---

## APIs requeridas

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Opus (guion, metadatos, visual) |
| `SERPAPI_KEY` | Búsqueda web en el agente de guion |
| `FISH_AUDIO_API_KEY` | Síntesis de voz Fish Audio |
| `FISH_VOICE_ID` | ID de la voz en Fish Audio |
| `YOUTUBE_API_KEY` | YouTube Data API (analíticas) |
| `YOUTUBE_CHANNEL_ID` | ID del canal de YouTube |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth para YouTube Analytics |
| `REMOTION_DIR` | Ruta absoluta a la carpeta remotion/ del canal |
| `PEXELS_API_KEY` | Imágenes Pexels (Phantom Directive) |

---

## Tech stack

| Capa | Tecnología |
|---|---|
| Launcher | Node.js HTTP + Vite + TypeScript |
| Backend API | FastAPI + SQLModel + SQLite |
| IA | Claude Opus 4 (Anthropic) |
| Transcripción | Whisper medium (OpenAI) — GPU CUDA |
| TTS | Fish Audio S2-Pro |
| Video | Remotion (React → MP4) |
| Iconos | Iconify + flat-color-icons / Lucide React |
| Frontend | React + Vite + TypeScript |
| Búsqueda web | SerpAPI |
