# Neural Studio

Sistema de producción automatizada de videos para YouTube usando IA. El pipeline convierte un tema en un video completo: guion → audio → sincronización → video Remotion → metadatos.

---

## Estructura del proyecto

```
neural-studio/
├── backend/                  # API Python (FastAPI)
│   ├── main.py               # Servidor FastAPI principal
│   ├── database.py           # SQLite con SQLModel
│   ├── models/               # Modelos de base de datos
│   ├── api/                  # Endpoints REST
│   ├── services/             # Servicios externos (YouTube, etc.)
│   └── agents/               # Agentes IA del pipeline
│       ├── pipeline.py       # Orquestador del pipeline completo
│       ├── guion.py          # Agente 1: escribe el guion
│       ├── audio.py          # Agente 2: genera el audio
│       ├── sincronizacion.py # Agente 3: Whisper → frames
│       └── metadatos.py      # Agente 4: título, descripción, tags
├── frontend/                 # UI React + Vite
│   └── src/
│       ├── pages/            # Projects, NewProject, ProjectDetail, Videos
│       └── components/       # Layout, NeuralNetwork
├── remotion/                 # Motor de video Remotion
│   ├── public/               # Archivos estáticos (audio.mp3)
│   └── src/
│       ├── MainVideo.tsx     # Composición principal
│       ├── sequences.ts      # Secciones con frames y colores
│       ├── paragraphSlides.json  # Slides sincronizados con Whisper
│       ├── visualData.json   # Datos de la intro
│       ├── constants/
│       │   ├── theme.ts      # Colores, fuentes, utilidad hex()
│       │   └── icons.ts      # Mapa de iconos Iconify (FlatIcon)
│       └── components/
│           ├── BrandOverlay.tsx   # Badge de suscripción
│           └── scenes/
│               ├── IntroScene.tsx  # Intro dramática 10s
│               ├── NewsCard.tsx    # Router + escena narrativa
│               ├── StatScene.tsx   # Escena de estadísticas
│               ├── ListScene.tsx   # Escena de listas
│               └── OutroScene.tsx  # Cierre con CTA
├── projects/                 # Carpeta de proyectos generados
│   └── <id>/
│       ├── narracion.txt
│       ├── audio.mp3
│       ├── whisper_output.json
│       └── metadatos.json
└── AGENT_REMOTION.md         # Prompt completo del agente Remotion
```

---

## Requisitos

### Sistema
- Node.js 18+ y npm
- Python 3.10+
- FFmpeg (para Whisper y render de Remotion)

### APIs necesarias
- `ANTHROPIC_API_KEY` — Claude (guion + metadatos)
- `SERPAPI_KEY` — búsqueda web en el agente de guion
- `ELEVENLABS_API_KEY` — síntesis de voz (si se usa ElevenLabs)

---

## Instalación

### 1. Backend (Python)

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Crea un archivo `.env` en `backend/`:

```env
ANTHROPIC_API_KEY=sk-ant-...
SERPAPI_KEY=...
ELEVENLABS_API_KEY=...  # opcional
```

### 2. Frontend (React)

```bash
cd frontend
npm install
```

### 3. Remotion

```bash
cd remotion
npm install
```

---

## Uso

### Levantar el sistema completo

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate   # Windows
python main.py
# Corre en http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Corre en http://localhost:5173
```

**Terminal 3 — Remotion Studio** (para previsualizar videos):
```bash
cd remotion
npm start
# Corre en http://localhost:3000
```

---

## Pipeline de producción

El pipeline se ejecuta automáticamente desde el frontend al crear un proyecto. También puede lanzarse manualmente:

```
Paso 1: guion.py          → narracion.txt
         Claude + SerpAPI busca hechos reales y escribe el guion
         dividido en secciones: [GANCHO], [CONTEXTO], [DECISION_X], [LEGADO], [CRITERIO]

Paso 2: audio.py          → audio.mp3
         TTS convierte el guion a audio

Paso 3: sincronizacion.py → whisper_output.json + sequences.ts + paragraphSlides.json
         Whisper transcribe el audio con timestamps exactos
         Genera los archivos que usa Remotion

Paso 4: metadatos.py      → metadatos.json
         Claude genera título SEO, descripción, tags y hashtags

Paso 5: AGENTE REMOTION   → video final
         Lee narracion.txt + audio.mp3 + whisper_output.json
         Genera/actualiza los componentes de escena
         Lanza Remotion Studio para previsualizar
         (ver AGENT_REMOTION.md para el proceso completo)
```

---

## Remotion — Sistema de video

### Cómo funciona

Remotion convierte componentes React en video. Cada frame es un render de React con el frame actual como contexto.

**Flujo de datos:**
```
whisper_output.json
       ↓
paragraphSlides.json   (162 slides con from/duration/style/color/icon)
       ↓
groupSlides()          (agrupa en bloques de mínimo 8 segundos)
       ↓
MainVideo.tsx          (renderiza cada slide en su Sequence)
       ↓
Remotion render        (video MP4 final)
```

### Tipos de escena

| `style` | Componente | Cuándo se usa |
|---|---|---|
| `chapter` | ChapterCard | Primer slide de cada sección |
| `stat` | StatScene | Texto con número/porcentaje relevante |
| `list` | ListScene | 3+ elementos enumerables |
| `outro` | OutroScene | Última sección del video |
| `newscard` | NewsBanner | Caso general narrativo |

### Paleta de colores semántica

| Contexto | Color | Hex |
|---|---|---|
| Crisis, caída, problema | Rojo | `#ef4444` |
| Logro, éxito, crecimiento | Verde | `#22c55e` |
| Estadística, dato técnico | Azul | `#3b82f6` |
| Decisión, momento clave | Ámbar | `#f59e0b` |
| Tecnología, arquitectura | Índigo | `#6366f1` |
| Impacto humano, equipo | Violeta | `#8b5cf6` |
| Cierre, reflexión, legado | Cian | `#06b6d4` |

### Sistema de iconos

Los iconos temáticos usan **Iconify + flat-color-icons** (coloridos, con fill propio).  
Los elementos de UI (`ChevronRight`, `ArrowRight`, `Bell`) usan **Lucide React**.

El mapa de iconos está en `remotion/src/constants/icons.ts`:

```
server        → flat-color-icons:data-configuration
users         → flat-color-icons:conference-call
code          → flat-color-icons:command-line
cpu           → flat-color-icons:electronics
globe         → flat-color-icons:globe
database      → flat-color-icons:database
trending-down → flat-color-icons:bearish
check-circle  → flat-color-icons:ok
lightbulb     → flat-color-icons:idea
activity      → flat-color-icons:line-chart  (fallback)
```

### Branding

`BrandOverlay` se coloca siempre al final de `MainVideo.tsx`:

```tsx
<BrandOverlay subscribeBadgeFrame={Math.round(TOTAL_FRAMES * 0.70)} />
```

- Badge "Suscríbete" aparece al 70% del video, dura 6 segundos
- No hay watermark permanente (decisión de diseño)

---

## Agregar un nuevo video manualmente

Si quieres adaptar Remotion para un nuevo proyecto sin usar el pipeline:

1. Coloca `audio.mp3` en `remotion/public/`
2. Ejecuta Whisper sobre el audio para obtener `whisper_output.json`
3. Genera `paragraphSlides.json` con el script de sincronización o manualmente
4. Actualiza `remotion/src/sequences.ts` con los frames correctos
5. Actualiza `remotion/src/visualData.json` con los datos de la intro
6. Lanza el preview: `cd remotion && npm start`

Para un proyecto nuevo automatizado, dale a Claude Code el contexto del agente `AGENT_REMOTION.md` y los tres archivos de input.

---

## Render del video final

Desde la carpeta `remotion`:

```bash
# Render completo
npx remotion render MainVideo out/video.mp4

# Con configuración específica
npx remotion render MainVideo out/video.mp4 --codec=h264 --crf=18

# Solo un rango de frames (para testing)
npx remotion render MainVideo out/test.mp4 --frames=0-300
```

---

## Estructura de `paragraphSlides.json`

Cada slide tiene:

```json
{
  "from": 450,
  "duration": 87,
  "section": "CONTEXTO",
  "text": "texto original de Whisper",
  "displayText": "Texto optimizado para pantalla",
  "style": "newscard",
  "number": null,
  "icon": "server",
  "color": "#6366f1",
  "lowerThird": "ARQUITECTURA SPARC",
  "decisionNum": null
}
```

Los campos `from` y `duration` están en frames (segundos × 30).

---

## Troubleshooting

**Error `@types/dom-webcodecs` en TypeScript:**  
Ignorar — son conflictos pre-existentes en `node_modules` que no afectan el runtime. Solo verificar que `src/` no tenga errores: `npx tsc --noEmit 2>&1 | grep "src/"`.

**El audio no carga en Remotion:**  
Verificar que `audio.mp3` esté en `remotion/public/` y que `staticFile('audio.mp3')` lo referencie correctamente.

**Los slides cambian demasiado rápido:**  
La función `groupSlides()` en `MainVideo.tsx` agrupa los slides cortos de Whisper en bloques de mínimo 240 frames (8 segundos). Si se necesita más tiempo, ajustar `MIN_SLIDE_FRAMES`.

**Icono no aparece:**  
Verificar que el `icon` en el slide JSON tenga uno de los nombres reconocidos en `constants/icons.ts`. Los nombres no reconocidos caen al fallback `activity` (line-chart).

---

## Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key de Claude | Sí |
| `SERPAPI_KEY` | API key de SerpAPI para búsqueda web | Sí |
| `ELEVENLABS_API_KEY` | API key de ElevenLabs para TTS | Opcional |

---

## Tech stack

| Capa | Tecnología |
|---|---|
| Backend API | FastAPI + SQLModel + SQLite |
| IA | Claude (Anthropic) |
| Transcripción | Whisper (OpenAI) |
| TTS | ElevenLabs |
| Video | Remotion (React → MP4) |
| Iconos | Iconify + flat-color-icons / Lucide React |
| Frontend | React + Vite + TypeScript |
| Búsqueda web | SerpAPI |
