import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { FlatIcon } from '../../constants/icons';
import { FONTS, THEME, hex } from '../../constants/theme';

const ACCENT = '#ef4444';
const PHASE2_START = 130;

// ─── Grid de fondo ────────────────────────────────────────────────────────────
const Grid: React.FC<{ color: string }> = ({ color }) => (
  <div style={{
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(${color}18 1px, transparent 1px),
      linear-gradient(90deg, ${color}18 1px, transparent 1px)
    `,
    backgroundSize: '80px 80px',
    pointerEvents: 'none',
  }} />
);

// ─── Partículas flotantes ─────────────────────────────────────────────────────
const Particles: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const pts = [
    { x: 0.12, y: 0.22, r: 3, speed: 0.4 },
    { x: 0.88, y: 0.15, r: 2, speed: 0.6 },
    { x: 0.75, y: 0.78, r: 4, speed: 0.3 },
    { x: 0.22, y: 0.88, r: 2, speed: 0.5 },
    { x: 0.55, y: 0.08, r: 3, speed: 0.7 },
    { x: 0.92, y: 0.55, r: 2, speed: 0.45 },
  ];
  return (
    <>
      {pts.map((p, i) => {
        const yOff = Math.sin((frame * p.speed * Math.PI) / 90 + i) * 14;
        const op   = 0.18 + 0.12 * Math.sin((frame * p.speed * Math.PI) / 70 + i * 1.3);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${p.x * 100}%`, top: `calc(${p.y * 100}% + ${yOff}px)`,
            width: p.r * 2, height: p.r * 2, borderRadius: '50%',
            background: color, opacity: op,
            boxShadow: `0 0 ${p.r * 4}px ${color}`,
          }} />
        );
      })}
    </>
  );
};

// ─── Texto kinético (palabra por palabra) ─────────────────────────────────────
const KineticText: React.FC<{
  text: string; fontSize: number; color: string;
  startFrame: number; framePerWord?: number; weight?: number; lineHeight?: number;
}> = ({ text, fontSize, color, startFrame, framePerWord = 4, weight = 700, lineHeight = 1.2 }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.38em', rowGap: '0.5em' }}>
      {words.map((word, i) => {
        const ws = startFrame + i * framePerWord;
        const op = interpolate(frame, [ws, ws + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y  = interpolate(frame, [ws, ws + 10], [18, 0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            display: 'inline-block', opacity: op,
            transform: `translateY(${y}px)`,
            fontFamily: FONTS.body, fontSize, fontWeight: weight, color, lineHeight,
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ─── FASE 1 — Revelación dramática ────────────────────────────────────────────
const Phase1: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barW   = interpolate(frame, [0, 28], [0, 100], { extrapolateRight: 'clamp' });
  const sideH  = interpolate(frame, [3, 40], [0, 100], { extrapolateRight: 'clamp' });
  const labelO = interpolate(frame, [5, 22],  [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow   = 0.06 + 0.03 * Math.sin((frame * Math.PI * 2) / 90);

  const iconScale = spring({ frame: frame - 10, fps, from: 0.3, to: 1, durationInFrames: 32, config: { damping: 11, stiffness: 88 } });
  const iconO     = interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const breathe   = 1 + 0.032 * Math.sin((frame * Math.PI * 2) / 90);
  const ringAngle = (frame / 220) * 360;
  const ring2A    = -(frame / 340) * 360;

  return (
    <AbsoluteFill style={{ opacity, background: THEME.bg }}>
      <Grid color={ACCENT} />

      {/* Glow izquierdo */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 70% 50%, ${hex(ACCENT, glow)} 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Barra top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: `${barW}%`, height: 3,
        background: ACCENT, boxShadow: `0 0 22px ${ACCENT}, 0 0 55px ${hex(ACCENT, 0.3)}`,
      }} />
      {/* Barra lateral */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 4, height: `${sideH}%`,
        background: `linear-gradient(to bottom, ${ACCENT}, ${hex(ACCENT, 0.35)}, transparent)`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 4, left: 4, right: 0, height: 52,
        opacity: labelO, display: 'flex', alignItems: 'center',
        padding: '0 88px', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: ACCENT,
            opacity: Math.floor(frame / 22) % 2 === 0 ? 1 : 0.2,
            boxShadow: `0 0 10px ${ACCENT}`,
          }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
            NEURAL STUDIO · TECH STORIES
          </span>
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 2, opacity: 0.55 }}>
          1982 — 2010
        </span>
      </div>

      <Particles frame={frame} color={ACCENT} />

      {/* Cuerpo */}
      <div style={{
        position: 'absolute', top: 56, bottom: 56, left: 0, right: 0,
        display: 'flex', alignItems: 'center',
      }}>
        {/* Texto izquierda (60%) */}
        <div style={{ flex: '0 0 58%', padding: '0 88px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ opacity: labelO }}>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11, color: hex(ACCENT, 0.8),
              letterSpacing: 5, textTransform: 'uppercase',
            }}>
              Silicon Valley · Historia Tecnológica
            </span>
          </div>
          <KineticText
            text="Sun Microsystems"
            fontSize={82} color={ACCENT} startFrame={12} framePerWord={6} weight={800}
          />
          <KineticText
            text="La empresa que regaló el futuro"
            fontSize={38} color={THEME.text} startFrame={28} framePerWord={4} weight={300}
          />
          <KineticText
            text="y se quedó sin nada"
            fontSize={32} color={THEME.muted} startFrame={52} framePerWord={4} weight={300}
          />
        </div>

        {/* Separador */}
        <div style={{
          flex: '0 0 1px', alignSelf: 'stretch',
          background: `linear-gradient(to bottom, transparent, ${hex(ACCENT, 0.45)}, transparent)`,
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }} />

        {/* Icono derecha (40%) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 18,
        }}>
          <div style={{
            opacity: iconO,
            transform: `scale(${iconScale})`,
            position: 'relative', width: 200, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Glow radial */}
            <div style={{
              position: 'absolute', inset: -80, borderRadius: '50%',
              background: `radial-gradient(circle, ${hex(ACCENT, 0.14)} 0%, transparent 65%)`,
              pointerEvents: 'none',
            }} />
            {/* Anillos SVG */}
            <svg width={380} height={380} viewBox="-90 -90 380 380"
              style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}>
              <circle cx={100} cy={100} r={140}
                stroke={hex(ACCENT, 0.35)} strokeWidth="1.5" strokeDasharray="14 8" fill="none"
                transform={`rotate(${ringAngle}, 100, 100)`} />
              <circle cx={100} cy={100} r={105}
                stroke={hex(ACCENT, 0.22)} strokeWidth="1" strokeDasharray="5 14" fill="none"
                transform={`rotate(${ring2A}, 100, 100)`} />
            </svg>
            {/* Borde */}
            <div style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              border: `2px solid ${hex(ACCENT, 0.45)}`,
              boxShadow: `0 0 30px ${hex(ACCENT, 0.18)}, 0 0 70px ${hex(ACCENT, 0.08)}`,
            }} />
            <div style={{ transform: `scale(${breathe})` }}>
              <FlatIcon name="server" size={130} />
            </div>
          </div>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 13, color: hex(ACCENT, 0.8),
            letterSpacing: 5, textTransform: 'uppercase',
            opacity: interpolate(frame, [50, 68], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            server infrastructure
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── FASE 2 — Slam del dato de impacto ───────────────────────────────────────
const Phase2: React.FC<{ opacity: number; startFrame: number }> = ({ opacity, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const barW      = interpolate(f, [0, 28],  [0, 100], { extrapolateRight: 'clamp' });
  const sideH     = interpolate(f, [3, 45],  [0, 100], { extrapolateRight: 'clamp' });
  const statSlam  = spring({ frame: f - 2, fps, from: 4.2, to: 1, durationInFrames: 22, config: { damping: 6, stiffness: 280 } });
  const statO     = interpolate(f, [2, 16],  [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const descO     = interpolate(f, [24, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub1O     = interpolate(f, [40, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub2O     = interpolate(f, [58, 76], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow      = 0.10 + 0.05 * Math.sin((frame * Math.PI * 2) / 72);

  const scanCycle = 130;
  const scanPos   = (frame % scanCycle) / scanCycle;
  const scanO     = Math.sin(scanPos * Math.PI) * 0.06;

  return (
    <AbsoluteFill style={{ opacity, background: THEME.bg }}>
      <Grid color={ACCENT} />

      {/* Glow central */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${hex(ACCENT, glow)} 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      {/* Escáner */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${scanPos * 100}%`, width: 120,
        background: `linear-gradient(to right, transparent, ${hex(ACCENT, scanO)}, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Número fantasma */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 540, fontWeight: 900,
          color: ACCENT, opacity: 0.045, letterSpacing: '-0.06em',
          lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
        }}>96</span>
      </div>

      {/* Barras */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: `${barW}%`, height: 3,
        background: ACCENT, boxShadow: `0 0 22px ${ACCENT}`,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 4, height: `${sideH}%`,
        background: `linear-gradient(to bottom, ${ACCENT}, ${hex(ACCENT, 0.35)}, transparent)`,
      }} />

      {/* Contenido central */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 160px',
      }}>
        <div style={{
          opacity: statO,
          transform: `scale(${statSlam})`,
          fontFamily: FONTS.mono, fontSize: 220, fontWeight: 900,
          color: ACCENT, letterSpacing: '-0.04em', lineHeight: 1,
          textShadow: `0 0 70px ${hex(ACCENT, 0.7)}, 0 0 140px ${hex(ACCENT, 0.35)}`,
          marginBottom: 12,
        }}>96%</div>

        <span style={{
          opacity: descO,
          fontFamily: FONTS.mono, fontSize: 18, color: THEME.muted,
          letterSpacing: 5, textTransform: 'uppercase', marginBottom: 40,
        }}>Descuento al venderse</span>

        <div style={{ opacity: sub1O, textAlign: 'center', marginBottom: 10 }}>
          <span style={{
            fontFamily: FONTS.body, fontSize: 36, fontWeight: 300,
            color: THEME.text, lineHeight: 1.35,
          }}>Valía <strong style={{ color: ACCENT }}>$200.000 millones</strong> en el año 2000</span>
        </div>
        <div style={{ opacity: sub2O, textAlign: 'center' }}>
          <span style={{
            fontFamily: FONTS.body, fontSize: 34, fontWeight: 300,
            color: THEME.muted, lineHeight: 1.35,
          }}>La vendieron por <strong style={{ color: THEME.text }}>$7.400 millones</strong> en 2009</span>
        </div>

        <div style={{
          width: 80, height: 2, background: ACCENT,
          marginTop: 38, opacity: sub2O * 0.7,
          boxShadow: `0 0 14px ${hex(ACCENT, 0.7)}`,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const phase1O = interpolate(frame, [PHASE2_START - 20, PHASE2_START + 15], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phase2O = interpolate(frame, [PHASE2_START - 10, PHASE2_START + 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blackO  = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Phase1 opacity={phase1O} />
      <Phase2 opacity={phase2O} startFrame={PHASE2_START} />
      <AbsoluteFill style={{ background: '#000000', opacity: blackO, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
