import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FONTS, hex } from '../constants/theme';

interface BrandOverlayProps {
  /** Mostrar el badge "subscribe" en el frame indicado (default: nunca) */
  subscribeBadgeFrame?: number;
}

const BRAND_COLOR = '#6366f1'; // índigo — color neutro del canal

// ─── Logo "NS" — letras entrelazadas ─────────────────────────────────────────
const NSLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="6" fill={BRAND_COLOR} fillOpacity="0.15" />
    <rect width="28" height="28" rx="6" stroke={BRAND_COLOR} strokeWidth="1.2" fillOpacity="0" />
    <text
      x="14" y="19.5"
      textAnchor="middle"
      fontFamily="'Inter', system-ui, sans-serif"
      fontWeight="800"
      fontSize="13"
      fill={BRAND_COLOR}
      letterSpacing="-0.5"
    >NS</text>
  </svg>
);

// ─── Badge de suscripción animado ─────────────────────────────────────────────
const SubscribeBadge: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const relF  = frame - startFrame;
  const show  = relF >= 0 && relF < 180;

  if (!show) return null;

  const slideIn  = interpolate(relF, [0, 18],   [60, 0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity  = interpolate(relF, [0, 14, 155, 175], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse    = 1 + 0.06 * Math.sin((relF * Math.PI * 2) / 32);

  return (
    <div style={{
      position: 'absolute', right: 88, bottom: 88,
      opacity, transform: `translateX(${slideIn}px)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(8,8,16,0.92)',
        border: `1.5px solid ${hex(BRAND_COLOR, 0.7)}`,
        borderRadius: 50, padding: '12px 22px',
        boxShadow: `0 0 28px ${hex(BRAND_COLOR, 0.22)}, 0 4px 24px rgba(0,0,0,0.6)`,
        transform: `scale(${pulse})`,
      }}>
        {/* Campana */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 14, fontWeight: 600,
          color: '#f1f5f9', letterSpacing: 1, whiteSpace: 'nowrap',
        }}>Suscríbete</span>
        <NSLogo size={26} />
      </div>
    </div>
  );
};

// ─── Componente principal exportado ──────────────────────────────────────────
export const BrandOverlay: React.FC<BrandOverlayProps> = ({ subscribeBadgeFrame }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {subscribeBadgeFrame != null && (
      <SubscribeBadge startFrame={subscribeBadgeFrame} />
    )}
  </AbsoluteFill>
);
