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
1. GuionAgent          → full_script.txt + narration.txt
                         Claude + SerpAPI investiga y escribe el guion
                         Contexto del canal en cada guion:
                           · Top videos por CTR × retención (referencia de estructura)
                           · Top temas por impresiones (lo que el algoritmo ya favorece)
                           · Bottom videos y Canal B (patrones a evitar)
                           · Benchmark del nicho: CTR objetivo 3%+, retención 35%+

2. AudioAgent          → audio.mp3 + whisper_output.json
                         Fish Audio genera la voz (S2-Pro, speed 0.94)
                         Whisper small transcribe con timestamps por segmento
                         Fix Windows: copia a ruta temporal ASCII antes de transcribir
                         (evita [Errno 22] con rutas que tienen tildes o guiones largos)

3. SincronizacionAgent → sequences.ts + paragraphSlides.json + intro_data.json
                         Convierte timestamps de Whisper a frames para Remotion
                         Claude asigna displayText, icono, color y estilo a cada slide

4. MetadatosAgent      → metadatos.txt + prompt_miniatura.txt
                         Claude genera título (≤55 chars), descripción con capítulos,
                         tags, hashtags y prompt de miniatura para IA generativa
                         El prompt de miniatura sigue la receta validada por datos:
                           · Fondo negro puro · 1 elemento hero dañado/fragmentado
                           · Máximo 3 palabras sin tildes · Sin clutters de efectos

5. Ver en Remotion     → Exporta el proyecto al motor de video
                         Copia sequences.ts, paragraphSlides.json e introData.json
                         al directorio remotion/src/ y abre preview en localhost:3000

6. Renderizar video    → video.mp4 final (Remotion CLI)
```

### Archivos generados por proyecto

| Archivo | Generado por | Descripción |
|---|---|---|
| `narration.txt` | GuionAgent | Texto de la narración |
| `full_script.txt` | GuionAgent | Guion completo con estructura |
| `audio.mp3` | AudioAgent | Voz sintetizada |
| `whisper_output.json` | AudioAgent | Transcripción con timestamps |
| `sequences.ts` | SincronizacionAgent | Secuencias Remotion en frames |
| `paragraphSlides.json` | SincronizacionAgent | Slides enriquecidos con Claude |
| `intro_data.json` | SincronizacionAgent | Datos de la pantalla de introducción |
| `metadatos.txt` | MetadatosAgent | Título, descripción, tags YouTube |
| `prompt_miniatura.txt` | MetadatosAgent | Prompt para generar la miniatura con IA |

---

## Analíticas e inteligencia del canal

### Métricas por video

La tabla de videos permite editar inline las métricas clave:

| Métrica | Editable | Descripción |
|---|---|---|
| Vistas / Likes | No | Importadas de YouTube Data API |
| Fecha de publicación | No | Importada de YouTube Data API |
| **Impresiones** | Sí | Número de impresiones (acepta 1.2K, 3.4M) |
| **Retención** | Sí | Tiempo promedio visto (mm:ss) y porcentaje |
| **CTR** | Sí | Click-through rate de YouTube Studio |
| **Título** | Sí | Edición inline con tracking A/B automático |
| **Canal B** | Sí | Marca temas con baja resonancia en LatAm |

Cada métrica tiene semáforo visual: rojo (CTR < 1.5%, retención < 20%), naranja (CTR 1.5–3%), verde (CTR > 3%). El benchmark del nicho (4% CTR, 40% retención) es visible en el resumen.

### Benchmark del nicho

Todo el sistema opera contra el benchmark real del nicho (documental tech/negocios en español, datos NexLev):

- **CTR objetivo: 4%** — canales como JunkBondInvestor, TheCollapseCo, Money Legends
- **Retención objetivo: 40%**
- Las alertas de rendimiento comparan contra este benchmark absoluto, no contra el promedio del canal

### Thumbnail Vision Loop

Analiza las miniaturas de los videos con mejor score (CTR × retención) de **todo el catálogo**, incluyendo videos sin carpeta local descargando desde YouTube directamente. Extrae patrones ganadores y anti-patrones para guiar el próximo prompt de miniatura.

### Canal B — filtro de temas con baja resonancia en LatAm

Videos con retención < 5% o < 50 impresiones en los primeros 5 días se auto-etiquetan como Canal B. El agente de sugerencias excluye estos temas y sus similares al proponer nuevas ideas.

Activar/desactivar manualmente desde la tabla de Videos (columna B).

### A/B tracking de títulos

Cada cambio de título (manual desde la UI o automático al detectar diferencia en el sync de YouTube) queda registrado en la tabla `TitleChange` con:
- Título anterior y nuevo
- CTR en el momento del cambio
- Delta de CTR tras el cambio (visible en historial inline)

### Alertas de rendimiento

El dashboard detecta videos con:
- CTR < 2% (independiente del promedio del canal) → sugiere `cambiar_miniatura` / `cambiar_titulo`
- Retención < 20% → sugiere `mejorar_gancho`
- Retención 20–30% → advertencia de mejora

Solo evalúa proyectos publicados hace 2+ días con más de 10 vistas.

### Contexto algorítmico para el GuionAgent

Antes de escribir cada guion, el agente carga:
- **Top temas por impresiones** — señal de lo que YouTube ya favorece para este canal
- **Top videos por CTR × retención** — referencia de estructura y enganche
- **Canal B / bottom videos** — patrones a evitar explícitamente

---

## Calendario y proyección de monetización

### Página Calendario (`/calendario`)

Vista de dos columnas:

**Izquierda — Calendario mensual:**
- Celdas con miniatura de YouTube real + título + vistas + CTR para cada video publicado
- Días recomendados (Lun/Mié/Vie) marcados con hora óptima de publicación (18:00 Lima)
- Basado en análisis: 3 videos/semana evita saturar el algoritmo con canal pequeño

**Derecha — Panel de monetización:**
- Progreso hacia YPP: anillos de suscriptores (1K) y horas de vista (4K)
- Tres escenarios con fechas y probabilidades:

| Escenario | Probabilidad | Condición | Fecha YPP |
|---|---|---|---|
| Pesimista | 35% | CTR no mejora, sin cambios | > 5 años |
| Realista | 45% | CTR sube a 2%, 3 videos/sem, sin viral | Nov 2028 |
| Optimista | 20% | CTR 3%+ y viral 50K+ en mes 6 | May 2027 |

- Hitos del escenario realista con mini barras de progreso
- Insight viral: "1 video viral (50K views) = 2.166h = 54% del requisito de horas"

El cuello de botella real en todos los escenarios son las **horas de visualización**, no los suscriptores.

---

## Nuevo proyecto — validador de título

Al escribir el título en "Nuevo Proyecto" se validan en tiempo real 4 reglas derivadas del análisis de CTR del canal:

| Regla | Umbral | Impacto |
|---|---|---|
| Longitud | ≤ 55 caracteres | YouTube mobile trunca después del 55 |
| Cifra o símbolo | $, %, número | Mejora CTR ~23% en el nicho |
| Separador paradoja | — | Estructura ganadora en el canal |
| Resonancia LatAm | Sin patrones Canal B | Evita temas de nostalgia anglosajona |

---

## APIs requeridas

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Opus (guion, metadatos, visual, thumbnail vision) |
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
| Análisis de mercado | NexLev MCP (benchmarks de nicho, competidores) |
| Transcripción | Whisper small (OpenAI) — GPU CUDA |
| TTS | Fish Audio S2-Pro |
| Video | Remotion (React → MP4) |
| Iconos | Iconify + flat-color-icons / Lucide React |
| Frontend | React + Vite + TypeScript |
| Búsqueda web | SerpAPI |

---

## Migraciones automáticas de base de datos

El backend ejecuta migraciones `ALTER TABLE` al arrancar si detecta columnas faltantes:

- `published_at` — fecha de publicación real de YouTube
- `impressions` — impresiones manuales por video
- `is_canal_b` — marca de baja resonancia en LatAm (auto-detección + manual)

Tablas nuevas creadas automáticamente:
- `TitleChange` — historial de cambios de título con CTR antes/después
