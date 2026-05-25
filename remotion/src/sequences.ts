// AUTO-GENERADO — Neural Studio Remotion Agent
// Paleta semántica:
//   GANCHO      → #ef4444  (crisis / impacto — la caída del 96%)
//   CONTEXTO    → #6366f1  (índigo   — fundación técnica)
//   DECISION_1  → #f59e0b  (dorado   — Java gratis, pivote clave)
//   DECISION_2  → #ef4444  (rojo     — ignorar hardware barato)
//   DECISION_3  → #ef4444  (rojo     — subestimar Linux)
//   DECISION_4  → #f97316  (naranja  — apostar al servidor premium)
//   DECISION_5  → #ef4444  (rojo     — burbuja puntocom / colapso)
//   DECISION_6  → #ef4444  (rojo     — caída final)
//   LEGADO      → #22c55e  (verde    — legado técnico que sobrevivió)
//   CRITERIO    → #06b6d4  (cian     — lección / reflexión / cierre)

export const FPS = 30;
export const MAX_SCENE_FRAMES = 300; // 10 segundos máximo por escena

export const SEQUENCES = {
  GANCHO:     { from: 0,     duration: 2297, type: 'intro',    color: '#ef4444' },
  CONTEXTO:   { from: 2297,  duration: 2151, type: 'chapter',  color: '#6366f1' },
  DECISION_1: { from: 4448,  duration: 2544, type: 'decision', color: '#f59e0b' },
  DECISION_2: { from: 6992,  duration: 2397, type: 'decision', color: '#ef4444' },
  DECISION_3: { from: 9389,  duration: 2367, type: 'decision', color: '#ef4444' },
  DECISION_4: { from: 11756, duration: 2672, type: 'decision', color: '#f97316' },
  DECISION_5: { from: 14428, duration: 2496, type: 'decision', color: '#ef4444' },
  DECISION_6: { from: 16924, duration: 2440, type: 'decision', color: '#ef4444' },
  LEGADO:     { from: 19364, duration: 2573, type: 'legacy',   color: '#22c55e' },
  CRITERIO:   { from: 21937, duration: 2715, type: 'outro',    color: '#06b6d4' },
} as const;

export const TOTAL_FRAMES = 24652;
