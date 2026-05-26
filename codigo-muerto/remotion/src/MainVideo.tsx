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

const INTRO_FRAMES = 300;
const SUBSCRIBE_BADGE_FRAME = Math.round(TOTAL_FRAMES * 0.70);
const MIN_SLIDE_FRAMES = 240; // 8 segundos mínimo por slide

// Agrupa slides consecutivos de la misma sección hasta alcanzar 8s.
// Mantiene el from/color/style del primero; concatena el texto.
function groupSlides(slides: NewsCardData[]): NewsCardData[] {
  const result: NewsCardData[] = [];
  let i = 0;
  while (i < slides.length) {
    const first = slides[i];
    let j = i + 1;
    while (
      j < slides.length &&
      slides[j].section === first.section &&
      (slides[j].from + slides[j].duration) - first.from < MIN_SLIDE_FRAMES
    ) {
      j++;
    }
    const group = slides.slice(i, j);
    const last  = group[group.length - 1];
    const endFrame = last.from + last.duration;
    const rawText  = group.map(s => s.displayText).join(' ').replace(/\s+/g, ' ').trim();
    const displayText = rawText.length > 220
      ? rawText.slice(0, 220).replace(/\s\S+$/, '…')
      : rawText;
    result.push({ ...first, duration: Math.max(endFrame - first.from, MIN_SLIDE_FRAMES), displayText });
    i = j;
  }
  return result;
}

const BODY_SLIDES = groupSlides(
  ALL_SLIDES.filter(s => !(s.section === 'GANCHO' && s.from < INTRO_FRAMES)),
);

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const SlideWithCap: React.FC<{ data: NewsCardData }> = ({ data }) => (
  <NewsCard data={{ ...data, displayText: cap(data.displayText) }} />
);

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: THEME.bg }}>
    <Audio src={staticFile('audio.mp3')} />

    {/* IntroScene — animación dramática de 10 segundos */}
    <Sequence from={0} durationInFrames={INTRO_FRAMES}>
      <IntroScene />
    </Sequence>

    {/* Body slides — sincronizados con el audio vía Whisper */}
    {BODY_SLIDES.map((slide, i) => (
      <Sequence key={i} from={slide.from} durationInFrames={slide.duration}>
        <SlideWithCap data={slide} />
      </Sequence>
    ))}

    {/* Branding persistente: watermark + badge de suscripción */}
    <BrandOverlay subscribeBadgeFrame={SUBSCRIBE_BADGE_FRAME} />
  </AbsoluteFill>
);
