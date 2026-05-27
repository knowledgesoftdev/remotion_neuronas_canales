import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { FONTS, THEME, hex } from '../../constants/theme';
import type { NewsCardData } from './NewsCard';

// OffthreadVideo — proxied by Remotion internally, works in both preview and render
const MediaBackground: React.FC<{ url?: string | null; mediaType?: string | null }> = ({ url, mediaType }) => {
  const cover: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'center',
  };
  if (!url) return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #0c0c12 0%, #060606 55%, #100a0a 100%)' }} />
  );
  if (mediaType === 'video') return <OffthreadVideo src={url} style={cover} muted />;
  return <Img src={url} style={cover} />;
};

// Extrae el valor numérico del string (ej: "96%" → 96, "$7.4B" → 7.4, "-50%" → -50)
function parseNumber(s: string | null): number {
  if (!s) return 0;
  const cleaned = s.replace(/[$B%+MK]/gi, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export const StatScene: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const color    = data.color;
  const numStr   = data.number ?? '–';
  const numVal   = parseNumber(data.number);
  const isNeg    = numStr.startsWith('-');
  const hasDecimal = numStr.includes('.');

  const barW     = interpolate(frame, [0, 24],  [0, 100], { extrapolateRight: 'clamp' });
  const sideH    = interpolate(frame, [3, 40],  [0, 100], { extrapolateRight: 'clamp' });
  const headerO  = interpolate(frame, [0, 18],  [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const statSlam = spring({ frame: frame - 2, fps, from: 3.5, to: 1, durationInFrames: 20, config: { damping: 7, stiffness: 260 } });
  const statO    = interpolate(frame, [2, 14],  [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textO    = interpolate(frame, [28, 46], [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const oExit    = interpolate(frame, [durationInFrames - 28, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow     = 0.08 + 0.04 * Math.sin((frame * Math.PI * 2) / 75);

  // Contador animado (0 → valor real en 55 frames)
  const animVal = interpolate(frame, [4, 60], [0, Math.abs(numVal)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const displayVal = hasDecimal
    ? (isNeg ? '-' : '') + animVal.toFixed(1) + numStr.replace(/^-?\d+\.?\d*/, '')
    : (isNeg ? '-' : '') + Math.round(animVal) + numStr.replace(/^-?\d+\.?\d*/, '');

  return (
    <AbsoluteFill style={{ opacity: oExit }}>
      {/* ── LAYER 1: Video/photo background ── */}
      <MediaBackground url={data.mediaUrl} mediaType={data.mediaType} />

      {/* ── LAYER 2: Heavy dark overlay so number is readable ── */}
      <AbsoluteFill style={{ background: 'rgba(0,0,0,0.78)' }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${hex(color, 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${hex(color, 0.06)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      {/* Glow central */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${hex(color, glow)} 0%, transparent 58%)`,
        pointerEvents: 'none',
      }} />

      {/* Número fantasma de fondo */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 480, fontWeight: 900,
          color, opacity: 0.04, letterSpacing: '-0.07em', lineHeight: 1, userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>{numStr.replace(/[^0-9.]/g, '')}</span>
      </div>

      {/* Barras estructurales */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: `${barW}%`, height: 3,
        background: color, boxShadow: `0 0 22px ${color}`,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 6, height: `${sideH}%`,
        background: `linear-gradient(to bottom, ${color}, ${hex(color, 0.45)}, transparent)`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 4, left: 4, right: 0, height: 52,
        opacity: headerO, display: 'flex', alignItems: 'center',
        padding: '0 88px', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: color,
            opacity: Math.floor(frame / 22) % 2 === 0 ? 1 : 0.2,
            boxShadow: `0 0 10px ${color}`,
          }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
            PHANTOM DIRECTIVE · CLASSIFIED HISTORY
          </span>
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 2, opacity: 0.55 }}>
          {data.section.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Contenido principal — centrado (sin ícono) */}
      <div style={{
        position: 'absolute', top: 58, bottom: 56, left: 88, right: 88,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
          <div style={{ opacity: statO, transform: `scale(${statSlam})`, transformOrigin: 'left center' }}>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 200, fontWeight: 900,
              color, letterSpacing: '-0.04em', lineHeight: 1,
              textShadow: `0 0 60px ${hex(color, 0.7)}, 0 0 120px ${hex(color, 0.35)}`,
            }}>{displayVal}</span>
          </div>
          <div style={{ opacity: textO, maxWidth: 900 }}>
            <p style={{
              fontFamily: FONTS.body, fontSize: 40, fontWeight: 300,
              color: THEME.text, lineHeight: 1.45, margin: 0,
            }}>{data.displayText}</p>
          </div>
          {data.lowerThird && (
            <div style={{ opacity: textO }}>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 13, color: hex(color, 0.8),
                letterSpacing: 4, textTransform: 'uppercase',
              }}>{data.lowerThird}</span>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
