import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { SEQUENCES, TOTAL_FRAMES } from './sequences';
import { THEME } from './constants/theme';
import { IntroScene } from './components/scenes/IntroScene';
import { NewsCard, NewsCardData } from './components/scenes/NewsCard';
import { BrandOverlay } from './components/BrandOverlay';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ALL_SLIDES: NewsCardData[] = require('./paragraphSlides.json');

export { TOTAL_FRAMES };

// Intro dura hasta el inicio real del primer slide de audio
// Así no hay vacío entre la animación de intro y el primer contenido.
const INTRO_FRAMES = SEQUENCES.HOOK.from;  // e.g. 228

const SUBSCRIBE_BADGE_FRAME = Math.round(TOTAL_FRAMES * 0.70);

// Crossfade overlap: cada slide empieza OVERLAP frames antes de que el anterior termine.
// Esto elimina el corte brusco — el fondo cambia suavemente mientras el texto
// del slide anterior aún se está yendo.
const OVERLAP = 12;

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const SlideWithCap: React.FC<{ data: NewsCardData }> = ({ data }) => (
  <NewsCard data={{ ...data, displayText: cap(data.displayText) }} />
);

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: THEME.bg }}>
    <Audio src={staticFile('audio.mp3')} />

    {/* IntroScene — termina exactamente cuando empieza el primer slide de audio */}
    <Sequence from={0} durationInFrames={INTRO_FRAMES + OVERLAP}>
      <IntroScene />
    </Sequence>

    {/* Body slides — sincronizados con Whisper.
        Cada slide empieza OVERLAP frames antes para un crossfade suave.
        La duración se extiende OVERLAP frames para que el fade-out del texto
        coincida con el fade-in del siguiente slide. */}
    {ALL_SLIDES.map((slide, i) => {
      const from     = Math.max(0, slide.from - OVERLAP);
      const duration = slide.duration + OVERLAP;
      return (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <SlideWithCap data={slide} />
        </Sequence>
      );
    })}

    {/* Branding persistente: watermark + badge de suscripción */}
    <BrandOverlay subscribeBadgeFrame={SUBSCRIBE_BADGE_FRAME} />
  </AbsoluteFill>
);
