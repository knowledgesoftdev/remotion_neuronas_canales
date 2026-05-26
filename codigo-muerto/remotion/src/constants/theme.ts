export const THEME = {
  bg:     '#080810',
  text:   '#f1f5f9',
  muted:  '#64748b',
  accent: '#ef4444',
  purple: '#8b5cf6',
  grid:   'rgba(99, 102, 241, 0.035)',
} as const;

export const FONTS = {
  body:    '"Inter", "Segoe UI", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "Fira Code", monospace',
  display: '"Inter", system-ui, sans-serif',
} as const;

export const hex = (color: string, opacity: number): string => {
  const h = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${h}`;
};
