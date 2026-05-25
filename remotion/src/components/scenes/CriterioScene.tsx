import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {FONTS, THEME} from '../../constants/theme';

interface CriterioLine { text: string; }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VISUAL: {criterio_lines: CriterioLine[]; criterio_title?: string; channel_header: string; date_range: string} = require('../../visualData.json');

export const CriterioScene: React.FC = () => {
  const frame = useCurrentFrame();

  const delays  = [0, 40, 80];
  const opacities = delays.map(d => interpolate(frame, [d, d+25], [0,1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'}));
  const lineW   = interpolate(frame, [5, 40], [0, 120], {extrapolateRight:'clamp'});
  const lineW2  = interpolate(frame, [110, 145], [0, 120], {extrapolateRight:'clamp'});
  const barW    = interpolate(frame, [2, 34], [0, 100], {extrapolateRight:'clamp'});
  const headerO = interpolate(frame, [0, 20], [0, 1], {extrapolateRight:'clamp'});
  const dotPulse = 0.35 + 0.65 * (Math.floor(frame / 22) % 2 === 0 ? 1 : 0.2);

  const lines = VISUAL.criterio_lines;
  const title = VISUAL.criterio_title ?? VISUAL.channel_header;

  return (
    <AbsoluteFill style={{
      background: THEME.bg,
      backgroundImage:`linear-gradient(${THEME.grid} 1px,transparent 1px),linear-gradient(90deg,${THEME.grid} 1px,transparent 1px)`,
      backgroundSize:'80px 80px',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'0 180px', textAlign:'center',
    }}>
      {/* Barra superior */}
      <div style={{position:'absolute',top:0,left:0,width:`${barW}%`,height:3,background:THEME.accent,boxShadow:`0 0 22px ${THEME.accent}`}}/>

      {/* Header */}
      <div style={{position:'absolute',top:4,left:4,right:0,height:52,opacity:headerO,display:'flex',alignItems:'center',padding:'0 88px',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.04)',background:'rgba(0,0,0,0.28)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:THEME.accent,opacity:dotPulse,boxShadow:`0 0 12px ${THEME.accent}`}}/>
          <span style={{fontFamily:FONTS.mono,fontSize:12,color:THEME.muted,letterSpacing:3,textTransform:'uppercase'}}>{VISUAL.channel_header}</span>
        </div>
        <span style={{fontFamily:FONTS.mono,fontSize:12,color:THEME.muted,letterSpacing:2,opacity:0.55}}>{VISUAL.date_range}</span>
      </div>

      {/* Título de sección */}
      <p style={{position:'absolute',top:72,fontFamily:FONTS.mono,fontSize:13,color:THEME.accent,letterSpacing:5,textTransform:'uppercase',opacity:headerO}}>
        {title}
      </p>

      {/* Línea accent superior */}
      <div style={{width:lineW, height:2, background:THEME.accent, marginBottom:56, boxShadow:`0 0 14px ${THEME.accent}88`}}/>

      {lines[0] && (
        <p style={{opacity:opacities[0], fontFamily:FONTS.body, fontSize:38, color:THEME.muted, fontWeight:300, margin:'0 0 20px', lineHeight:1.4}}>
          {lines[0].text}
        </p>
      )}
      {lines[1] && (
        <p style={{opacity:opacities[1], fontFamily:FONTS.body, fontSize:44, color:THEME.text, fontWeight:400, margin:'0 0 20px', lineHeight:1.4}}>
          <span style={{color:THEME.accent, fontWeight:700, textShadow:`0 0 40px ${THEME.accent}88`}}>{lines[1].text}</span>
        </p>
      )}
      {lines[2] && (
        <p style={{opacity:opacities[2], fontFamily:FONTS.mono, fontSize:22, color:THEME.muted, margin:'40px 0 0', letterSpacing:2}}>
          {lines[2].text}
        </p>
      )}

      {/* Línea accent inferior */}
      <div style={{width:lineW2, height:2, background:THEME.accent, marginTop:56, boxShadow:`0 0 14px ${THEME.accent}88`, opacity:0.7}}/>
    </AbsoluteFill>
  );
};
