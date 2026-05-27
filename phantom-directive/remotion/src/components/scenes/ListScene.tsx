import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { ChevronRight } from 'lucide-react';
import { FONTS, THEME, hex } from '../../constants/theme';
import type { NewsCardData } from './NewsCard';

interface ListItem { text: string; icon?: string }

export const ListScene: React.FC<{ data: NewsCardData; items?: ListItem[] }> = ({ data, items }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const color  = data.color;
  const oExit  = interpolate(frame, [durationInFrames - 28, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow   = 0.055 + 0.025 * Math.sin((frame * Math.PI * 2) / 85);
  const barW   = interpolate(frame, [0, 24], [0, 100], { extrapolateRight: 'clamp' });
  const sideH  = interpolate(frame, [3, 38], [0, 100], { extrapolateRight: 'clamp' });
  const titleO = interpolate(frame, [0, 18], [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 18], [24, 0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const listItems: ListItem[] = items ?? [{ text: data.displayText }];
  const ITEM_DELAY = 18;

  return (
    <AbsoluteFill style={{ background: THEME.bg, opacity: oExit }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${hex(color, 0.07)} 1px, transparent 1px), linear-gradient(90deg, ${hex(color, 0.07)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 20% 50%, ${hex(color, glow)} 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />
      {/* Barras */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: `${barW}%`, height: 3,
        background: color, boxShadow: `0 0 22px ${color}`,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 6, height: `${sideH}%`,
        background: `linear-gradient(to bottom, ${color}, ${hex(color, 0.4)}, transparent)`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 4, left: 4, right: 0, height: 52,
        opacity: titleO, display: 'flex', alignItems: 'center',
        padding: '0 88px', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.28)',
      }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 3, textTransform: 'uppercase' }}>
          NEURAL STUDIO · TECH STORIES
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 2, opacity: 0.55 }}>
          {data.section.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Contenido */}
      <div style={{
        position: 'absolute', top: 60, bottom: 56, left: 88, right: 88,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12,
      }}>
        {/* Título de la lista */}
        <div style={{
          opacity: titleO, transform: `translateY(${titleY}px)`,
          marginBottom: 32,
        }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 12, color: hex(color, 0.8),
            letterSpacing: 5, textTransform: 'uppercase',
          }}>
            {data.lowerThird ?? data.section.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Items */}
        {listItems.map((item, i) => {
          const itemStart = 14 + i * ITEM_DELAY;
          const itemScale = spring({ frame: frame - itemStart, fps, from: 0.9, to: 1, durationInFrames: 20, config: { damping: 12 } });
          const itemO     = interpolate(frame, [itemStart, itemStart + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const itemX     = interpolate(frame, [itemStart, itemStart + 14], [-40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          return (
            <div key={i} style={{
              opacity: itemO,
              transform: `translateX(${itemX}px) scale(${itemScale})`,
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '14px 28px',
              borderLeft: `3px solid ${hex(color, 0.7)}`,
              background: `linear-gradient(to right, ${hex(color, 0.08)}, transparent)`,
              borderRadius: '0 8px 8px 0',
            }}>
              <ChevronRight color={color} size={22} strokeWidth={2.5} />
              <p style={{
                fontFamily: FONTS.body, fontSize: 38, fontWeight: 300,
                color: THEME.text, lineHeight: 1.35, margin: 0,
              }}>{item.text}</p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
