/**
 * NewsCard — Phantom Directive visual system.
 *
 * Reference video style (videoreferencianichonuevo.mp4):
 *
 *   Full-screen footage (Pexels / Wikipedia / SerpAPI)
 *   ┌──────────────────────────────────────┐
 *   │ [SECTION]           PD ▪ REC●        │  ← top label boxes
 *   │                                      │
 *   │       [footage / photo background]   │
 *   │                                      │
 *   │  ─────────── gradient ────────────── │
 *   │   "Narration text appears here       │
 *   │    word by word, synced to audio"    │
 *   │ [TOPIC LABEL]                        │  ← optional white box label
 *   └──────────────────────────────────────┘
 *
 * Chapter transitions: full black screen + red sweep + section title.
 */

import React from 'react';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONTS, THEME, hex } from '../../constants/theme';
import { StatScene } from './StatScene';
import { ListScene } from './ListScene';
import { OutroScene } from './OutroScene';

export interface SlideKeyword {
  text:     string;
  /** top-right | mid-left | mid-right | center */
  position: string;
}

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
  // Media background (from SyncAgent)
  mediaUrl?:   string | null;
  mediaType?:  string | null;
  // Keyword overlays (from SyncAgent / Claude)
  keywords?:   SlideKeyword[];
}


// ─── Full-screen media background ────────────────────────────────────────────
// When mediaUrl is set: shows Pexels video or photo/Wikipedia/SerpAPI image.
// When null: falls back to a dark cinematic gradient.
const DarkFallback: React.FC = () => (
  <AbsoluteFill style={{
    background: 'linear-gradient(160deg, #0c0c12 0%, #060606 55%, #100a0a 100%)',
  }} />
);

const MediaBackground: React.FC<{
  url:       string | null | undefined;
  mediaType: string | null | undefined;
}> = ({ url, mediaType }) => {
  const cover: React.CSSProperties = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'center',
  };

  if (!url) return <DarkFallback />;

  if (mediaType === 'video') {
    return (
      // OffthreadVideo: Remotion proxies the request internally — no cross-origin
      // issues in Studio preview. Works in both preview and render.
      // Videos are requested with min_duration=10s so they always cover the full slide.
      <OffthreadVideo
        src={url}
        style={cover}
        muted
      />
    );
  }

  return <Img src={url} style={cover} />;
};


// ─── Vignette overlay ─────────────────────────────────────────────────────────
const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.65 }) => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `radial-gradient(ellipse 90% 90% at 50% 50%, transparent 30%, rgba(0,0,0,${strength}) 100%)`,
  }} />
);


// ─── Keyword overlays ─────────────────────────────────────────────────────────
// Claude-extracted keywords placed at specific screen positions.
// Styled like the reference video label boxes — Impact font, tight padding.
const KEYWORD_POSITIONS: Record<string, React.CSSProperties> = {
  'top-right': { top: 90,  right: 28,  bottom: 'auto', left: 'auto' },
  'mid-left':  { top: '50%', left: 28,  right: 'auto', bottom: 'auto', transform: 'translateY(-50%)' },
  'mid-right': { top: '50%', right: 28, left:  'auto', bottom: 'auto', transform: 'translateY(-50%)' },
  'center':    { top: '38%', left: '50%', transform: 'translate(-50%, -50%)', right: 'auto', bottom: 'auto' },
};

const KeywordOverlay: React.FC<{ keywords: SlideKeyword[] }> = ({ keywords }) => {
  const frame = useCurrentFrame();

  if (!keywords || keywords.length === 0) return null;

  return (
    <>
      {keywords.map((kw, i) => {
        const posStyle = KEYWORD_POSITIONS[kw.position] ?? KEYWORD_POSITIONS['top-right'];
        // Stagger appearance: each keyword fades in 8 frames after the previous
        const start = 18 + i * 10;
        const op    = interpolate(frame, [start, start + 10], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const y = interpolate(frame, [start, start + 10], [-10, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...posStyle,
              opacity: op,
              transform: `${posStyle.transform ?? ''} translateY(${y}px)`.trim(),
              zIndex: 10,
            }}
          >
            {/* Accent left bar */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              <div style={{ width: 3, background: '#cc1111', flexShrink: 0 }} />
              <div style={{
                background: 'rgba(0,0,0,0.82)',
                padding: '5px 12px',
              }}>
                <span style={{
                  fontFamily:    '"Impact","Arial Black",Arial,sans-serif',
                  fontSize:      22,
                  color:         '#ffffff',
                  fontWeight:    700,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  display:       'block',
                  lineHeight:    1,
                  whiteSpace:    'nowrap',
                }}>{kw.text}</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};


// ─── Reference-video label box ────────────────────────────────────────────────
// Exact style from the reference: tight padding, no border-radius, Impact font.
//   variant="dark"  → black bg + white text  (top-left chapter label)
//   variant="light" → white bg + black text  (bottom subject label)
const LabelBox: React.FC<{
  text:    string;
  variant: 'dark' | 'light';
  size?:   number;
}> = ({ text, variant, size = 26 }) => (
  <div style={{
    background: variant === 'dark' ? '#000000' : '#ffffff',
    padding:    '7px 14px',
    display:    'inline-block',
  }}>
    <span style={{
      fontFamily:    FONTS.impact,
      fontSize:      size,
      color:         variant === 'dark' ? '#ffffff' : '#000000',
      fontWeight:    700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      display:       'block',
      lineHeight:    1,
    }}>{text}</span>
  </div>
);


// ─── Kinetic word-by-word text ────────────────────────────────────────────────
const KineticText: React.FC<{
  text:         string;
  fontSize:     number;
  color?:       string;
  startFrame?:  number;
  framePerWord?: number;
  fontWeight?:  number;
  lineHeight?:  number;
  maxWidth?:    number;
}> = ({
  text,
  fontSize,
  color       = THEME.text,
  startFrame  = 0,
  framePerWord = 3,
  fontWeight  = 500,
  lineHeight  = 1.5,
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.4em', rowGap: '0.5em', maxWidth }}>
      {words.map((word, i) => {
        const ws = startFrame + i * framePerWord;
        const op = interpolate(frame, [ws, ws + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const y  = interpolate(frame, [ws, ws + 8], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            display: 'inline-block', opacity: op, transform: `translateY(${y}px)`,
            fontFamily: FONTS.display, fontSize, fontWeight, color, lineHeight,
          }}>{word}</span>
        );
      })}
    </div>
  );
};


// ─── DocuSlide — main narrative slide ────────────────────────────────────────
// This is the slide shown for most of the video duration.
// Reference video structure:
//   - Full-screen footage/photo as background
//   - Top-left: black box + white Impact text (section name)
//   - Lower-third: dark gradient + kinetic narration text
//   - Bottom-left (optional): white box + black Impact text (topic label)
const DocuSlide: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn  = interpolate(frame, [0, 14], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = fadeIn * fadeOut;

  const labelO  = interpolate(frame, [0, 10], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textO   = interpolate(frame, [5, 20], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const len      = data.displayText.length;
  const fontSize = len > 150 ? 30 : len > 110 ? 36 : len > 75 ? 44 : len > 50 ? 52 : 60;

  // Pulsing REC indicator
  const recPulse = Math.floor(frame / 24) % 2 === 0 ? 1 : 0.18;

  return (
    <AbsoluteFill>
      {/* ── LAYER 1: Media background — FUERA de la opacidad del slide.
          El video/foto NO hace fade-to-black entre transiciones.
          Solo el texto/UI hace fade, igual que un corte de edición real. ── */}
      <MediaBackground url={data.mediaUrl} mediaType={data.mediaType} />

      {/* Todo lo demás (texto, vignette, labels) sí usa la opacidad del slide */}
      <AbsoluteFill style={{ opacity }}>

      {/* ── LAYER 2: Vignette (always) ── */}
      <Vignette strength={data.mediaUrl ? 0.55 : 0.7} />

      {/* ── LAYER 3: Top-left label — lowerThird if available, hidden if it's an internal section name ── */}
      {data.lowerThird && data.lowerThird.trim() !== '' && (
        <div style={{
          position: 'absolute', top: 26, left: 26,
          opacity: labelO,
        }}>
          <LabelBox text={data.lowerThird} variant="dark" size={24} />
        </div>
      )}

      {/* ── LAYER 3b: Top-right PD watermark ── */}
      <div style={{
        position: 'absolute', top: 30, right: 28,
        opacity: labelO * 0.4,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{ width: 7, height: 7, background: THEME.accent, opacity: recPulse }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: '#ffffff',
          letterSpacing: 3, textTransform: 'uppercase',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        }}>PHANTOM DIRECTIVE</span>
      </div>

      {/* ── LAYER 4: Lower-third gradient + narration text ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        minHeight: '44%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.94) 55%, rgba(0,0,0,0.65) 80%, transparent 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '0 72px 54px',
        opacity: textO,
      }}>
        <KineticText
          text={data.displayText}
          fontSize={fontSize}
          color={'#ffffff'}
          startFrame={6}
          framePerWord={3}
          fontWeight={500}
          lineHeight={1.5}
          maxWidth={1700}
        />
      </div>

      </AbsoluteFill>{/* cierre del inner AbsoluteFill con opacity */}
    </AbsoluteFill>
  );
};


// ─── MilitaryChapterCard — section transition ─────────────────────────────────
// Pure black screen: red sweep + large Impact section title + redaction bars.
const MilitaryChapterCard: React.FC<{ data: NewsCardData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const barW    = interpolate(frame, [0, 24], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sideH   = interpolate(frame, [3, 40], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headerO = interpolate(frame, [5, 22],  [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleO  = interpolate(frame, [16, 38], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [16, 38], [36, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const redactO = interpolate(frame, [32, 52], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const oExit   = interpolate(frame, [durationInFrames - 24, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const len       = data.displayText.length;
  const titleSize = len > 60 ? 70 : len > 40 ? 88 : len > 25 ? 106 : 124;
  const recPulse  = Math.floor(frame / 24) % 2 === 0 ? 1 : 0.18;

  return (
    <AbsoluteFill style={{ background: '#000000', opacity: oExit }}>
      {/* Red sweep top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${barW}%`, height: 3, background: THEME.accent,
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
        <div style={{ width: 7, height: 7, background: THEME.accent, opacity: recPulse }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 11, color: THEME.muted,
          letterSpacing: 4, textTransform: 'uppercase',
        }}>PHANTOM DIRECTIVE · CLASSIFIED HISTORY · DECLASSIFIED</span>
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute', top: 56, bottom: 80, left: 0, right: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 88px',
      }}>
        <div style={{ opacity: headerO, marginBottom: 26 }}>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 12, color: THEME.accent,
            letterSpacing: 8, textTransform: 'uppercase',
          }}>CLASSIFIED · {data.section}</span>
        </div>

        <div style={{ opacity: titleO, transform: `translateY(${titleY}px)` }}>
          <span style={{
            fontFamily: FONTS.impact,
            fontSize: titleSize,
            color: THEME.text,
            textTransform: 'uppercase',
            lineHeight: 1.05, letterSpacing: 3,
            display: 'block',
          }}>{data.displayText}</span>
        </div>

        {/* Redaction bars */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 48,
          opacity: redactO, alignItems: 'center',
        }}>
          {[180, 110, 260, 90, 140].map((w, i) => (
            <div key={i} style={{
              height: 14, width: w, background: THEME.accent,
              opacity: i % 2 === 0 ? 0.6 : 0.38,
            }} />
          ))}
        </div>
      </div>

      {/* Section ID at bottom */}
      <div style={{
        position: 'absolute', bottom: 28, left: 88,
        opacity: redactO,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 3, height: 22, background: THEME.accent }} />
        <span style={{
          fontFamily: FONTS.mono, fontSize: 12, color: THEME.accent,
          letterSpacing: 4, textTransform: 'uppercase',
        }}>FILE · {data.section}</span>
      </div>
    </AbsoluteFill>
  );
};


// ─── Router ───────────────────────────────────────────────────────────────────
// 'chapter' → DocuSlide: reference video style (footage + text overlay).
// MilitaryChapterCard is kept but not used — doesn't match reference video.
export const NewsCard: React.FC<{ data: NewsCardData }> = ({ data }) => {
  switch (data.style) {
    case 'stat':  return <StatScene  data={data} />;
    case 'list':  return <ListScene  data={data} />;
    case 'outro': return <OutroScene data={data} />;
    default:      return <DocuSlide  data={data} />;
  }
};
