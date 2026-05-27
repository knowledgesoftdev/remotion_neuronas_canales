import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, TOTAL_FRAMES} from './MainVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
