/**
 * IntroScene — Phantom Directive classified military opener.
 *
 * Phase 1 (0–130 frames / 0–4.3s):
 *   Channel identity reveal — "PHANTOM DIRECTIVE" kinetic title,
 *   subtitle, red bars, DECLASSIFIED stamp.
 *
 * Phase 2 (130–300 frames / 4.3–10s):
 *   Episode impact stat slams in — dramatic number + description lines.
 */

import React from 'react';
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { FONTS, THEME, hex } from '../../constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const INTRO = require('../../introData.json') as {
  title:      string;
  subtitle1:  string;
  subtitle2:  string;
  dateRange:  string;
  stat:       string;
  statDesc:   string;
  statLine1:  string;
  statLine2:  string;
};

const PHASE2_START = 130;

// ─── Scan-line overlay ────────────────────────────────────────────────────────
const ScanLines: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
  }} />
);

// ─── Kinetic word-by-word text ────────────────────────────────────────────────
const KineticText: React.FC<{
  text: string; fontSize: number; color: string;
  startFrame: number; framePerWord?: number; weight?: number; lineHeight?: number;
}> = ({ text, fontSize, color, startFrame, framePerWord = 5, weight = 700, lineHeight = 1.15 }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.38em', rowGap: '0.5em' }}>
      {words.map((word, i) => {
        const ws = startFrame + i * framePerWord;
        const op = interpolate(frame, [ws, ws + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y  = interpolate(frame, [ws, ws + 10], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            display: 'inline-block', opacity: op, transform: `translateY(${y}px)`,
            fontFamily: FONTS.display, fontSize, fontWeight: weight, color, lineHeight,
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// ─── PHASE 1 — Channel identity reveal ────────────────────────────────────────
const Phase1: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barW    = interpolate(frame, [0, 24],  [0, 100], { extrapolateRight: 'clamp' });
  const sideH   = interpolate(frame, [3, 42],  [0, 100], { extrapolateRight: 'clamp' });
  const headerO = interpolate(frame, [4, 20],  [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagO    = interpolate(frame, [8, 26],  [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub1O   = interpolate(frame, [36, 56], [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub2O   = interpolate(frame, [60, 80], [0, 1],   { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // DECLASSIFIED stamp — slams in at frame 65
  const stampScale = spring({ frame: frame - 65, fps, from: 3.2, to: 1, durationInFrames: 18, config: { damping: 5, stiffness: 220 } });
  const stampO     = interpolate(frame, [65, 78], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Recording indicator pulse
  const recPulse = Math.floor(frame / 24) % 2 === 0 ? 1 : 0.15;

  return (
    <AbsoluteFill style={{ opacity, background: '#000000' }}>
      <ScanLines />

      {/* Central glow — very subtle */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 70% 65% at 42% 52%, ${hex(THEME.accent, 0.06)} 0%, transparent 65%)`,
      }} />

      {/* Red top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${barW}%`, height: 3,
        background: THEME.accent,
      }} />

      {/* Red left sidebar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 4,
        height: `${sideH}%`,
        background: `linear-gradient(to bottom, ${THEME.accent}, ${THEME.accent}44)`,
      }} />

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 4, left: 4, right: 0, height: 52,
        opacity: headerO,
        display: 'flex', alignItems: 'center',
        padding: '0 72px', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.30)',
      }}>
        <div style={{
          width: 7, height: 7,
          background: THEME.accent, opacity: recPulse,
        }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: THEME.muted,
          letterSpacing: 4, textTransform: 'uppercase',
        }}>CLASSIFIED HISTORY · DECLASSIFIED</span>
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: THEME.muted,
          letterSpacing: 2, opacity: 0.5, marginLeft: 'auto',
        }}>{INTRO.dateRange}</span>
      </div>

      {/* Main body */}
      <div style={{
        position: 'absolute', top: 56, bottom: 0, left: 0, right: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 88px 0 92px',
      }}>
        {/* "PHANTOM DIRECTIVE" channel tag */}
        <div style={{ opacity: tagO, marginBottom: 18 }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 13, color: THEME.accent,
            letterSpacing: 8, textTransform: 'uppercase',
          }}>PHANTOM DIRECTIVE</span>
        </div>

        {/* Episode title — kinetic */}
        <div style={{ marginBottom: 36 }}>
          <KineticText
            text={INTRO.title}
            fontSize={78}
            color={THEME.text}
            startFrame={14}
            framePerWord={6}
            weight={700}
            lineHeight={1.12}
          />
        </div>

        {/* Subtitle 1 */}
        <div style={{ opacity: sub1O, marginBottom: 12 }}>
          <span style={{
            fontFamily: FONTS.display, fontSize: 32, fontWeight: 300,
            color: THEME.muted, lineHeight: 1.4,
          }}>{INTRO.subtitle1}</span>
        </div>

        {/* Subtitle 2 / tagline */}
        <div style={{ opacity: sub2O }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 13, color: THEME.accent,
            letterSpacing: 4, textTransform: 'uppercase',
          }}>{INTRO.subtitle2}</span>
        </div>
      </div>

      {/* DECLASSIFIED stamp — appears at frame 65, rotated, ghost opacity */}
      {frame >= 65 && (
        <div style={{
          position: 'absolute', right: 72, top: '50%',
          transform: `translateY(-50%) rotate(-15deg) scale(${stampScale})`,
          opacity: stampO * 0.28,
          pointerEvents: 'none',
        }}>
          <div style={{
            border: `5px solid ${THEME.accent}`,
            padding: '10px 18px',
          }}>
            <span style={{
              fontFamily: FONTS.impact,
              fontSize: 52, color: THEME.accent,
              letterSpacing: 5, textTransform: 'uppercase',
              display: 'block', lineHeight: 1,
            }}>DECLASSIFIED</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── PHASE 2 — Episode impact stat ───────────────────────────────────────────
const Phase2: React.FC<{ opacity: number; startFrame: number }> = ({ opacity, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const barW     = interpolate(f, [0, 22],  [0, 100], { extrapolateRight: 'clamp' });
  const statSlam = spring({ frame: f - 2, fps, from: 4.2, to: 1, durationInFrames: 20, config: { damping: 5, stiffness: 260 } });
  const statO    = interpolate(f, [2, 16],  [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const descO    = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line1O   = interpolate(f, [38, 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line2O   = interpolate(f, [56, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Horizontal scan that moves across for drama
  const scanPos  = (f % 120) / 120;
  const scanO    = Math.sin(scanPos * Math.PI) * 0.06;

  return (
    <AbsoluteFill style={{ opacity, background: '#000000' }}>
      <ScanLines />

      {/* Glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 50%, ${hex(THEME.accent, 0.10)} 0%, transparent 58%)`,
      }} />

      {/* Scan sweep effect */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${scanPos * 100}%`, width: 120, pointerEvents: 'none',
        background: `linear-gradient(to right, transparent, ${hex(THEME.accent, scanO)}, transparent)`,
      }} />

      {/* Red top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${barW}%`, height: 3, background: THEME.accent,
      }} />

      {/* Ghost stat number behind content */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <span style={{
          fontFamily: FONTS.impact, fontSize: 480, fontWeight: 900,
          color: THEME.accent, opacity: 0.045, lineHeight: 1,
          userSelect: 'none', letterSpacing: '-0.04em',
        }}>{INTRO.stat}</span>
      </div>

      {/* Central content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 160px',
      }}>
        {/* Impact stat */}
        <div style={{
          opacity: statO,
          transform: `scale(${statSlam})`,
          fontFamily: FONTS.impact,
          fontSize: 190, color: THEME.accent,
          lineHeight: 1, letterSpacing: '-0.02em',
          textShadow: `0 0 60px ${hex(THEME.accent, 0.6)}, 0 0 120px ${hex(THEME.accent, 0.3)}`,
          marginBottom: 12,
        }}>{INTRO.stat}</div>

        {/* Stat description */}
        <span style={{
          opacity: descO,
          fontFamily: FONTS.mono, fontSize: 15,
          color: THEME.muted, letterSpacing: 6,
          textTransform: 'uppercase', marginBottom: 40,
        }}>{INTRO.statDesc}</span>

        {/* Story lines */}
        <div style={{ opacity: line1O, marginBottom: 8, textAlign: 'center' }}>
          <span style={{
            fontFamily: FONTS.display, fontSize: 34, fontWeight: 300,
            color: THEME.text, lineHeight: 1.4,
          }}>{INTRO.statLine1}</span>
        </div>
        <div style={{ opacity: line2O, textAlign: 'center' }}>
          <span style={{
            fontFamily: FONTS.display, fontSize: 32, fontWeight: 300,
            color: THEME.muted, lineHeight: 1.4,
          }}>{INTRO.statLine2}</span>
        </div>

        {/* Accent rule */}
        <div style={{
          width: 80, height: 2, background: THEME.accent,
          marginTop: 40, opacity: line2O * 0.8,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const phase1O = interpolate(frame, [PHASE2_START - 18, PHASE2_START + 14], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phase2O = interpolate(frame, [PHASE2_START - 8, PHASE2_START + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blackO  = interpolate(frame, [durationInFrames - 28, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Phase1 opacity={phase1O} />
      <Phase2 opacity={phase2O} startFrame={PHASE2_START} />
      <AbsoluteFill style={{ background: '#000000', opacity: blackO, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
