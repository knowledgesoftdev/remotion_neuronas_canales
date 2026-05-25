import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, THEME, hex } from '../../constants/theme';
import { FlatIcon } from '../../constants/icons';
import { StatScene } from './StatScene';
import { ListScene } from './ListScene';
import { OutroScene } from './OutroScene';

export interface NewsCardData {
  from:        number;
  duration:    number;
  section:     string;
  text:        string;
  displayText: string;
  style:       'chapter' | 'newscard' | 'stat' | 'list' | 'outro';
  number:      string | null;
  icon:        string;
  color:       string;
  lowerThird:  string | null;
  decisionNum: number | null;
}

// ─── Icono selector ───────────────────────────────────────────────────────────
const IconComp: React.FC<{ name: string; size: number }> = ({ name, size }) => (
  <FlatIcon name={name} size={size} />
);

// ─── Icono animado con anillos orbitales ──────────────────────────────────────
const AnimatedIcon: React.FC<{ data: NewsCardData; size?: number; entryFrame?: number }> = (
  { data, size = 180, entryFrame = 0 }
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = data.color;

  const entryScale   = spring({ frame: frame - entryFrame, fps, from: 0.4, to: 1, durationInFrames: 30, config: { damping: 12, stiffness: 90 } });
  const entryOpacity = interpolate(frame, [entryFrame, entryFrame + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const breathe      = 1 + 0.048 * Math.sin((frame * Math.PI * 2) / 90);
  const glowPulse    = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((frame * Math.PI * 2) / 75));
  const ringAngle    = (frame / 240) * 360;
  const innerAngle   = -(frame / 360) * 360;
  const orbitR       = size * 0.72;
  const dots         = [0, 120, 240].map(offset => {
    const angle = ((ringAngle + offset) * Math.PI) / 180;
    return { x: size / 2 + Math.cos(angle) * orbitR, y: size / 2 + Math.sin(angle) * orbitR };
  });

  return (
    <div style={{
      opacity: entryOpacity, transform: `scale(${entryScale})`,
      position: 'relative', width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: -size * 0.5, borderRadius: '50%',
        background: `radial-gradient(circle, ${hex(color, glowPulse * 0.24)} 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <svg width={size * 1.9} height={size * 1.9}
        viewBox={`${-size * 0.45} ${-size * 0.45} ${size * 1.9} ${size * 1.9}`}
        style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}>
        <circle cx={size / 2} cy={size / 2} r={size * 0.72}
          stroke={hex(color, glowPulse * 0.55)} strokeWidth="1.5" strokeDasharray="12 8" fill="none"
          transform={`rotate(${ringAngle}, ${size / 2}, ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={size * 0.56}
          stroke={hex(color, glowPulse * 0.3)} strokeWidth="1" strokeDasharray="4 12" fill="none"
          transform={`rotate(${innerAngle}, ${size / 2}, ${size / 2})`} />
        {dots.map((dot, i) => (
          <g key={i}>
            <circle cx={dot.x} cy={dot.y} r={i === 0 ? 10 : 7} fill={color} opacity={0.15} />
            <circle cx={dot.x} cy={dot.y} r={i === 0 ? 5  : 3.5} fill={color} opacity={0.9}  />
          </g>
        ))}
      </svg>
      <div style={{
        position: 'absolute', inset: -8, borderRadius: '50%',
        border: `2px solid ${hex(color, glowPulse * 0.55)}`,
        boxShadow: `0 0 ${32 * glowPulse}px ${hex(color, glowPulse * 0.24)}, 0 0 ${70 * glowPulse}px ${hex(color, 0.1)}`,
      }} />
      <div style={{ transform: `scale(${breathe})` }}>
        <IconComp name={data.icon} size={size * 0.62} />
      </div>
    </div>
  );
};

// ─── Texto kinético ───────────────────────────────────────────────────────────
const KineticText: React.FC<{
  text: string; fontSize: number; color?: string;
  startFrame?: number; framePerWord?: number; fontWeight?: number;
  lineHeight?: number; maxWidth?: number;
}> = ({ text, fontSize, color = THEME.text, startFrame = 0, framePerWord = 3, fontWeight = 700, lineHeight = 1.3, maxWidth }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.45em', rowGap: '0.65em', maxWidth }}>
      {words.map((word, i) => {
        const wStart  = startFrame + i * framePerWord;
        const opacity = interpolate(frame, [wStart, wStart + 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y       = interpolate(frame, [wStart, wStart + 9], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            display: 'inline-block', opacity, transform: `translateY(${y}px)`,
            fontFamily: FONTS.body, fontSize, fontWeight, color, lineHeight,
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ─── Lower Third ─────────────────────────────────────────────────────────────
const LowerThird: React.FC<{ text: string; color: string; entryFrame?: number }> = (
  { text, color, entryFrame = 12 }
) => {
  const frame  = useCurrentFrame();
  const sweep  = interpolate(frame, [entryFrame, entryFrame + 32], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textO  = interpolate(frame, [entryFrame + 22, entryFrame + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'relative', background: 'rgba(0,0,0,0.92)',
      borderTop: `1px solid ${hex(color, 0.28)}`, padding: '18px 88px', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${sweep}%`, background: `linear-gradient(to right, ${hex(color, 0.22)}, transparent)`,
      }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <span style={{
        opacity: textO, fontFamily: FONTS.mono, fontSize: 16,
        color: THEME.muted, letterSpacing: 2.5, textTransform: 'uppercase',
      }}>{text}</span>
    </div>
  );
};

// ─── ChapterCard — primer slide de cada sección ───────────────────────────────
const ChapterCard: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const color  = data.color;
  const barH   = interpolate(frame, [0, 28],  [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stripW = interpolate(frame, [0, 18],  [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const badgeO = interpolate(frame, [8, 24],  [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const numX   = interpolate(frame, [4, 30],  [180, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const numS   = spring({ frame: frame - 4, fps, from: 1.2, to: 1, durationInFrames: 28, config: { damping: 11 } });
  const oExit  = interpolate(frame, [durationInFrames - 28, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const decLabel = data.decisionNum
    ? `DECISIÓN ${String(data.decisionNum).padStart(2, '0')} / 06`
    : data.section.replace(/_/g, ' ');
  const titleSize = data.displayText.length > 75 ? 54 : data.displayText.length > 50 ? 66 : 78;

  return (
    <AbsoluteFill style={{
      background: THEME.bg,
      backgroundImage: `radial-gradient(ellipse at 82% 50%, ${hex(color, 0.07)} 0%, transparent 58%)`,
      opacity: oExit,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${hex(color, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${hex(color, 0.07)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: `${stripW}%`, height: 4, background: color, boxShadow: `0 0 22px ${color}` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: `${barH}%`, background: `linear-gradient(to bottom, ${color}, ${hex(color, 0.45)})` }} />

      {data.decisionNum && (
        <div style={{
          position: 'absolute', right: 40, top: '50%',
          transform: `translateY(-50%) translateX(${numX}px) scale(${numS})`,
          fontFamily: FONTS.mono, fontSize: 460, fontWeight: 900, color,
          lineHeight: 1, letterSpacing: '-0.06em', opacity: 0.07,
          userSelect: 'none', pointerEvents: 'none',
        }}>
          {String(data.decisionNum).padStart(2, '0')}
        </div>
      )}

      <div style={{
        position: 'absolute', left: 88, right: 180, top: '50%',
        transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 44,
      }}>
        <div style={{ opacity: badgeO, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: hex(color, 0.1), border: `1px solid ${hex(color, 0.45)}`,
            borderRadius: 6, padding: '8px 20px',
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%',
              background: color, boxShadow: `0 0 10px ${color}`,
            }} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 14, color,
              letterSpacing: 4, textTransform: 'uppercase',
            }}>{decLabel}</span>
          </div>
        </div>
        <KineticText text={data.displayText} fontSize={titleSize} startFrame={26} framePerWord={5} lineHeight={1.18} maxWidth={1100} />
      </div>

      {data.lowerThird && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <LowerThird text={data.lowerThird} color={color} entryFrame={45} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── NewsBanner — slide narrativo estándar ────────────────────────────────────
const NewsBanner: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const color    = data.color;
  const leftX    = interpolate(frame, [0, 24], [-44, 0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leftO    = interpolate(frame, [0, 24], [0, 1],    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headerO  = interpolate(frame, [0, 18], [0, 1],    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dividerO = interpolate(frame, [10, 30], [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const oExit    = interpolate(frame, [durationInFrames - 28, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const livePulse = Math.floor(frame / 22) % 2 === 0 ? 1 : 0.15;
  const secLabel  = data.decisionNum
    ? `DECISIÓN ${String(data.decisionNum).padStart(2, '0')}`
    : data.section.replace(/_/g, ' ');
  const fontSize  = data.displayText.length > 95 ? 38 : data.displayText.length > 70 ? 48 : data.displayText.length > 50 ? 56 : 64;

  return (
    <AbsoluteFill style={{ background: THEME.bg, opacity: oExit }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${hex(color, 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${hex(color, 0.06)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px', opacity: 0.7,
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%',
        background: `radial-gradient(ellipse at 75% 50%, ${hex(color, 0.07)} 0%, transparent 68%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: color, boxShadow: `0 0 18px ${color}` }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 4, left: 4, right: 0, height: 52, opacity: headerO,
        display: 'flex', alignItems: 'center', padding: '0 88px', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: color,
            opacity: livePulse, boxShadow: `0 0 10px ${color}`,
          }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
            NEURAL STUDIO · TECH STORIES
          </span>
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 2, opacity: 0.6 }}>
          1982 — 2010
        </span>
      </div>

      <div style={{
        position: 'absolute', top: 58, bottom: 56, left: 0, right: 0, display: 'flex',
      }}>
        {/* Texto izquierda */}
        <div style={{
          flex: '0 0 57%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '40px 72px 40px 88px', gap: 28, opacity: leftO, transform: `translateX(${leftX}px)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 2, background: color, opacity: 0.8 }} />
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, color, letterSpacing: 4, textTransform: 'uppercase' }}>
              {secLabel}
            </span>
          </div>
          <KineticText text={data.displayText} fontSize={fontSize} startFrame={6} framePerWord={3} lineHeight={1.4} maxWidth={840} />
          {data.number && (
            <div style={{
              fontFamily: FONTS.mono, fontSize: 88, fontWeight: 700, color,
              letterSpacing: '-0.03em', lineHeight: 1,
              opacity: interpolate(frame, [32, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              textShadow: `0 0 40px ${hex(color, 0.5)}`,
            }}>{data.number}</div>
          )}
        </div>

        {/* Separador */}
        <div style={{
          flex: '0 0 1px', alignSelf: 'stretch',
          background: `linear-gradient(to bottom, transparent, ${hex(color, 0.5)}, transparent)`,
          opacity: dividerO,
        }} />

        {/* Icono derecha */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 22,
        }}>
          <AnimatedIcon data={data} size={190} entryFrame={8} />
          <span style={{
            fontFamily: FONTS.mono, fontSize: 15, color: hex(color, 0.8),
            letterSpacing: 5, textTransform: 'uppercase',
            opacity: interpolate(frame, [30, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>{data.icon.replace('-', ' ')}</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(to bottom, ${color}, ${hex(color, 0.4)}, transparent)` }} />
      {data.lowerThird && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <LowerThird text={data.lowerThird} color={color} entryFrame={24} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── Enrutador principal ──────────────────────────────────────────────────────
export const NewsCard: React.FC<{ data: NewsCardData }> = ({ data }) => {
  switch (data.style) {
    case 'chapter': return <ChapterCard data={data} />;
    case 'stat':    return <StatScene   data={data} />;
    case 'list':    return <ListScene   data={data} />;
    case 'outro':   return <OutroScene  data={data} />;
    default:        return <NewsBanner  data={data} />;
  }
};
