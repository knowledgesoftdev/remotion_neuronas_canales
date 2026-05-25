import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {FONTS, THEME} from '../../constants/theme';

interface LegadoItem { label: string; desc: string; }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VISUAL: {legado_items: LegadoItem[]; legado_title?: string; channel_header: string} = require('../../visualData.json');

const Item: React.FC<{item: LegadoItem; from: number}> = ({item, from}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 25], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const x = interpolate(frame, [from, from + 25], [32, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  return (
    <div style={{opacity, transform:`translateX(${x}px)`, display:'flex', gap:28, marginBottom:36, alignItems:'flex-start'}}>
      <span style={{fontFamily:FONTS.mono, fontSize:24, color:THEME.purple, marginTop:4, flexShrink:0}}>◈</span>
      <div>
        <p style={{fontFamily:FONTS.mono, fontSize:22, color:THEME.accent, fontWeight:700, margin:'0 0 6px', letterSpacing:1}}>{item.label}</p>
        <p style={{fontFamily:FONTS.body, fontSize:28, color:THEME.text, fontWeight:300, margin:0, lineHeight:1.4}}>{item.desc}</p>
      </div>
    </div>
  );
};

export const LegadoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleO = interpolate(frame, [0, 22], [0, 1], {extrapolateRight:'clamp'});
  const barW   = interpolate(frame, [2, 36], [0, 100], {extrapolateRight:'clamp'});
  const dotPulse = 0.35 + 0.65 * (Math.floor(frame / 22) % 2 === 0 ? 1 : 0.2);
  const title = VISUAL.legado_title ?? VISUAL.channel_header;

  return (
    <AbsoluteFill style={{
      background: THEME.bg,
      backgroundImage:`linear-gradient(${THEME.grid} 1px,transparent 1px),linear-gradient(90deg,${THEME.grid} 1px,transparent 1px)`,
      backgroundSize:'80px 80px',
      display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 160px',
    }}>
      {/* Barra superior */}
      <div style={{position:'absolute',top:0,left:0,width:`${barW}%`,height:3,background:THEME.purple,boxShadow:`0 0 20px ${THEME.purple}`}}/>

      {/* Header */}
      <div style={{position:'absolute',top:4,left:4,right:0,height:52,opacity:titleO,display:'flex',alignItems:'center',padding:'0 88px',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.04)',background:'rgba(0,0,0,0.28)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:THEME.purple,opacity:dotPulse,boxShadow:`0 0 12px ${THEME.purple}`}}/>
          <span style={{fontFamily:FONTS.mono,fontSize:12,color:THEME.muted,letterSpacing:3,textTransform:'uppercase'}}>{VISUAL.channel_header}</span>
        </div>
      </div>

      {/* Título de sección — usa el título real del proyecto */}
      <p style={{opacity:titleO, fontFamily:FONTS.mono, fontSize:13, color:THEME.purple, letterSpacing:5, textTransform:'uppercase', marginBottom:56}}>
        {title}
      </p>

      {VISUAL.legado_items.map((item, i) => (
        <Item key={i} item={item} from={25 + i * 45}/>
      ))}
    </AbsoluteFill>
  );
};
