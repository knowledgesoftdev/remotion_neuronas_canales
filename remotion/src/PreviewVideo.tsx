import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {TOTAL_FRAMES} from './sequences';
import {THEME, FONTS} from './constants/theme';

interface SlideData {
  section: string;
  from: number;
  duration: number;
  text: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SLIDES: SlideData[] = require('./paragraphSlides.json');

const SECTION_COLORS: Record<string, string> = {
  GANCHO:   THEME.accent,
  CONTEXTO: THEME.purple,
  LEGADO:   THEME.accent,
  CRITERIO: THEME.purple,
};

function sectionColor(section: string): string {
  if (section.startsWith('DECISION')) return '#a78bfa';
  return SECTION_COLORS[section] ?? THEME.accent;
}

const Grid: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(${THEME.grid} 1px, transparent 1px),
      linear-gradient(90deg, ${THEME.grid} 1px, transparent 1px)
    `,
    backgroundSize: '80px 80px',
    opacity: 0.5,
    pointerEvents: 'none',
  }} />
);

const PreviewSlide: React.FC<{slide: SlideData}> = ({slide}) => {
  const frame = useCurrentFrame();
  const color = sectionColor(slide.section);

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideUp = interpolate(frame, [0, 18], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      background: THEME.bg,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 140px',
    }}>
      <Grid />

      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
        opacity: 0.9,
      }} />

      <div style={{opacity: fadeIn, transform: `translateY(${slideUp}px)`}}>
        {/* Section label */}
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          color,
          letterSpacing: 5,
          textTransform: 'uppercase',
          marginBottom: 28,
        }}>
          {slide.section.replace(/_/g, ' ')}
        </div>

        {/* Slide text */}
        <p style={{
          fontFamily: FONTS.body,
          fontSize: 42,
          fontWeight: 300,
          color: THEME.text,
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 1200,
        }}>
          {slide.text}
        </p>
      </div>

      {/* Bottom frame indicator */}
      <div style={{
        position: 'absolute', bottom: 48, right: 140,
        fontFamily: FONTS.mono, fontSize: 11,
        color: THEME.muted, letterSpacing: 3,
        opacity: fadeIn,
      }}>
        {Math.round(slide.from / 30)}s — {Math.round((slide.from + slide.duration) / 30)}s
      </div>
    </AbsoluteFill>
  );
};

export {TOTAL_FRAMES};

export const PreviewVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: THEME.bg}}>
      <Audio src={staticFile('audio.mp3')} />
      {SLIDES.map((slide, i) => (
        <Sequence key={i} from={slide.from} durationInFrames={slide.duration}>
          <PreviewSlide slide={slide} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
