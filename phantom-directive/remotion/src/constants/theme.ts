// ─── Phantom Directive — Classified History ──────────────────────────────────
export const THEME = {
  bg:      '#060606',   // near-black (bunker/classified document)
  panel:   '#0e0e0e',   // slightly lighter panel
  text:    '#ebebeb',   // bright white — legible on dark bg
  muted:   '#7a7a7a',   // muted grey
  accent:  '#cc1111',   // classified red — the signature channel color
  warm:    '#c09030',   // vintage/gold — for timestamps, historical references
} as const;

export const FONTS = {
  body:    '"Inter", "Segoe UI", Arial, sans-serif',
  mono:    '"Courier New", Courier, monospace',
  impact:  '"Impact", "Arial Black", Arial, sans-serif',   // for label boxes (reference video style)
  display: '"Inter", "Segoe UI", system-ui, sans-serif',
} as const;

/** Append 2-digit hex opacity to a 6-char hex color string */
export const hex = (color: string, opacity: number): string => {
  const h = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${h}`;
};
