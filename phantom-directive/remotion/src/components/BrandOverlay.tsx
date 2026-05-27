import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FONTS, THEME } from '../constants/theme';

interface BrandOverlayProps {
  subscribeBadgeFrame?: number;
}

// ─── "PD" Logo mark ────────────────────────────────────────────────────────────
const PDLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" fill={THEME.accent} fillOpacity="0.12" />
    <rect width="28" height="28" stroke={THEME.accent} strokeWidth="1.2" fillOpacity="0" />
    <text
      x="14" y="19.5"
      textAnchor="middle"
      fontFamily="'Impact', 'Arial Black', sans-serif"
      fontWeight="900"
      fontSize="14"
      fill={THEME.accent}
      letterSpacing="-0.5"
    >PD</text>
  </svg>
);

// ─── Subscribe badge ───────────────────────────────────────────────────────────
const SubscribeBadge: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const relF  = frame - startFrame;
  const show  = relF >= 0 && relF < 180;

  if (!show) return null;

  const slideIn = interpolate(relF, [0, 18],       [64, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = interpolate(relF, [0, 14, 155, 175], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse   = 1 + 0.05 * Math.sin((relF * Math.PI * 2) / 30);

  return (
    <div style={{
      position: 'absolute', right: 88, bottom: 88,
      opacity, transform: `translateX(${slideIn}px)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(6,6,6,0.94)',
        border: `1.5px solid ${THEME.accent}bb`,
        borderRadius: 0,           // no rounded corners — classified style
        padding: '12px 22px',
        boxShadow: `0 0 24px ${THEME.accent}33, 0 4px 24px rgba(0,0,0,0.7)`,
        transform: `scale(${pulse})`,
      }}>
        {/* Bell icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={THEME.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600,
          color: THEME.text, letterSpacing: 2, whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}>Subscribe</span>
        <PDLogo size={26} />
      </div>
    </div>
  );
};

// ─── Main export ───────────────────────────────────────────────────────────────
export const BrandOverlay: React.FC<BrandOverlayProps> = ({ subscribeBadgeFrame }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {subscribeBadgeFrame != null && (
      <SubscribeBadge startFrame={subscribeBadgeFrame} />
    )}
  </AbsoluteFill>
);
