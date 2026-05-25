import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { ArrowRight } from 'lucide-react';
import { FlatIcon } from '../../constants/icons';
import { FONTS, THEME, hex } from '../../constants/theme';
import type { NewsCardData } from './NewsCard';

const CTA_COLOR = '#06b6d4';

const Particle: React.FC<{ x: number; y: number; r: number; speed: number; frame: number; color: string }> = (
  { x, y, r, speed, frame, color }
) => {
  const yOff = Math.sin((frame * speed * Math.PI) / 80) * 18;
  const xOff = Math.cos((frame * speed * Math.PI) / 110) * 10;
  const op   = 0.15 + 0.1 * Math.sin((frame * speed * Math.PI) / 65);
  return (
    <div style={{
      position: 'absolute',
      left: `calc(${x * 100}% + ${xOff}px)`,
      top:  `calc(${y * 100}% + ${yOff}px)`,
      width: r * 2, height: r * 2, borderRadius: '50%',
      background: color, opacity: op,
      boxShadow: `0 0 ${r * 5}px ${color}`,
    }} />
  );
};

export const OutroScene: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const color   = data.color || CTA_COLOR;
  const oExit   = interpolate(frame, [durationInFrames - 28, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow    = 0.08 + 0.05 * Math.sin((frame * Math.PI * 2) / 80);

  const titleO  = interpolate(frame, [5, 25],  [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 25],  [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const iconS   = spring({ frame: frame - 8, fps, from: 0.2, to: 1, durationInFrames: 30, config: { damping: 10, stiffness: 100 } });
  const iconO   = interpolate(frame, [8, 22],  [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textO   = interpolate(frame, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaO    = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaSweep = interpolate(frame, [40, 80], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const brandO  = interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const breathe = 1 + 0.04 * Math.sin((frame * Math.PI * 2) / 88);
  const barW    = interpolate(frame, [0, 30],  [0, 100], { extrapolateRight: 'clamp' });

  const particles = [
    { x: 0.08, y: 0.20, r: 3, speed: 0.42 },
    { x: 0.92, y: 0.18, r: 2, speed: 0.61 },
    { x: 0.85, y: 0.75, r: 4, speed: 0.31 },
    { x: 0.14, y: 0.82, r: 2, speed: 0.55 },
    { x: 0.50, y: 0.06, r: 3, speed: 0.72 },
    { x: 0.96, y: 0.50, r: 2, speed: 0.47 },
    { x: 0.04, y: 0.50, r: 2, speed: 0.38 },
    { x: 0.50, y: 0.94, r: 3, speed: 0.58 },
  ];

  const words = data.displayText.split(' ');

  return (
    <AbsoluteFill style={{ background: THEME.bg, opacity: oExit }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${hex(color, 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${hex(color, 0.06)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      {/* Glow central radial */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 48%, ${hex(color, glow)} 0%, transparent 62%)`,
        pointerEvents: 'none',
      }} />

      {/* Barras */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: `${barW}%`, height: 3,
        background: color, boxShadow: `0 0 22px ${color}`,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 4, height: '100%',
        background: `linear-gradient(to bottom, ${color}, ${hex(color, 0.35)}, transparent)`,
      }} />

      {/* Partículas */}
      {particles.map((p, i) => (
        <Particle key={i} {...p} frame={frame} color={color} />
      ))}

      {/* Contenido central */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 180px', gap: 40,
      }}>
        {/* Icono */}
        <div style={{
          opacity: iconO,
          transform: `scale(${iconS}) scale(${breathe})`,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: -40, borderRadius: '50%',
            background: `radial-gradient(circle, ${hex(color, 0.18)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            border: `2px solid ${hex(color, 0.5)}`,
            boxShadow: `0 0 28px ${hex(color, 0.22)}`,
          }} />
          <FlatIcon name="lightbulb" size={80} />
        </div>

        {/* Texto principal kinético */}
        <div style={{
          opacity: titleO,
          transform: `translateY(${titleY}px)`,
          textAlign: 'center', maxWidth: 1200,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.4em', rowGap: '0.55em' }}>
            {words.map((word, i) => {
              const ws = 22 + i * 3;
              const wO = interpolate(frame, [ws, ws + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const wY = interpolate(frame, [ws, ws + 10], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <span key={i} style={{
                  display: 'inline-block', opacity: wO,
                  transform: `translateY(${wY}px)`,
                  fontFamily: FONTS.body, fontSize: 50, fontWeight: 300,
                  color: THEME.text, lineHeight: 1.35,
                }}>{word}</span>
              );
            })}
          </div>
        </div>

        {/* CTA Box */}
        <div style={{ opacity: ctaO, position: 'relative', overflow: 'hidden' }}>
          {/* Sweep de entrada */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${ctaSweep}%`,
            background: `linear-gradient(to right, ${hex(color, 0.25)}, transparent)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            border: `1.5px solid ${hex(color, 0.6)}`,
            borderRadius: 8,
            padding: '16px 48px',
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <ArrowRight color={color} size={22} strokeWidth={2} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 16, color: color,
              letterSpacing: 5, textTransform: 'uppercase',
            }}>Like · Suscríbete · Comenta</span>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 56, opacity: brandO,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.30)',
        display: 'flex', alignItems: 'center', padding: '0 88px', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: THEME.muted,
          letterSpacing: 3, textTransform: 'uppercase', opacity: 0.5,
        }}>Neural Studio · Historia Tecnológica</span>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: hex(color, 0.7),
          letterSpacing: 2, opacity: 0.6,
        }}>Sun Microsystems · 1982 – 2010</span>
      </div>
    </AbsoluteFill>
  );
};
