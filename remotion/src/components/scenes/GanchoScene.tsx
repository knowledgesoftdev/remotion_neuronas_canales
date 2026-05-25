import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONTS, THEME} from '../../constants/theme';
import {
  IconAlert, IconClock, IconCode, IconDatabase,
  IconFanout, IconGear, IconJVM, IconNetwork, IconRails, IconTeam,
} from '../icons/TechIcons';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface GanchoLine { text: string; from: number; size: number; color: string; weight: number; }
interface VisualData {
  channel_header: string; date_range: string;
  gancho_icon: string; gancho_stat: string; gancho_stat_desc: string;
  gancho_lines: GanchoLine[];
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const V: VisualData = require('../../visualData.json');

const COLOR_MAP: Record<string, string> = {
  text: THEME.text, accent: THEME.accent, muted: THEME.muted, purple: THEME.purple,
};
const IMPACT = '#cc2222'; // color rojo para la fase de impacto

// ─── Icono selector ───────────────────────────────────────────────────────────
const Icon: React.FC<{name: string; color: string; size: number}> = ({name, color, size}) => {
  const p = {color, size, strokeWidth: 3};
  switch (name) {
    case 'database': return <IconDatabase {...p}/>;
    case 'rails':    return <IconRails    {...p}/>;
    case 'jvm':      return <IconJVM      {...p}/>;
    case 'network':  return <IconNetwork  {...p}/>;
    case 'fanout':   return <IconFanout   {...p}/>;
    case 'team':     return <IconTeam     {...p}/>;
    case 'gear':     return <IconGear     {...p}/>;
    case 'alert':    return <IconAlert    {...p}/>;
    case 'clock':    return <IconClock    {...p}/>;
    default:         return <IconCode     {...p}/>;
  }
};

// ─── Icono orbital animado ────────────────────────────────────────────────────
const OrbitalIcon: React.FC<{icon: string; color: string; size: number}> = ({icon, color, size}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entryScale = spring({frame: frame - 8, fps, from: 0.3, to: 1, durationInFrames: 32, config: {damping: 11, stiffness: 88}});
  const entryO    = interpolate(frame, [8, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const breathe   = 1 + 0.038 * Math.sin((frame * Math.PI * 2) / 95);
  const ring1A    = (frame / 210) * 360;
  const ring2A    = -(frame / 310) * 360;
  const glow      = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin((frame * Math.PI * 2) / 78));
  const r         = size * 0.70;
  const dots = [0, 120, 240].map(o => {
    const a = ((ring1A + o) * Math.PI) / 180;
    return {x: size/2 + Math.cos(a) * r, y: size/2 + Math.sin(a) * r};
  });
  const gh = Math.round(glow * 55).toString(16).padStart(2,'0');
  const rh = Math.round(glow * 100).toString(16).padStart(2,'0');

  return (
    <div style={{opacity: entryO, transform: `scale(${entryScale})`, position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'absolute', inset: -size*0.5, borderRadius: '50%', background: `radial-gradient(circle, ${color}${gh} 0%, transparent 60%)`, pointerEvents: 'none'}}/>
      <svg width={size*1.9} height={size*1.9} viewBox={`${-size*0.45} ${-size*0.45} ${size*1.9} ${size*1.9}`} style={{position: 'absolute', overflow: 'visible', pointerEvents: 'none'}}>
        <circle cx={size/2} cy={size/2} r={r} stroke={`${color}${rh}`} strokeWidth="1.5" strokeDasharray="12 8" fill="none" transform={`rotate(${ring1A},${size/2},${size/2})`}/>
        <circle cx={size/2} cy={size/2} r={size*0.52} stroke={`${color}${Math.round(glow*42).toString(16).padStart(2,'0')}`} strokeWidth="1" strokeDasharray="4 12" fill="none" transform={`rotate(${ring2A},${size/2},${size/2})`}/>
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r={i===0?9:5.5} fill={color} opacity={0.13}/>
            <circle cx={d.x} cy={d.y} r={i===0?4.5:2.8} fill={color} opacity={0.9}/>
          </g>
        ))}
      </svg>
      <div style={{position: 'absolute', inset: -8, borderRadius: '50%', border: `2px solid ${color}${rh}`, boxShadow: `0 0 ${26*glow}px ${color}${gh}, 0 0 ${62*glow}px ${color}22`, pointerEvents: 'none'}}/>
      <div style={{transform: `scale(${breathe})`}}><Icon name={icon} color={color} size={size}/></div>
    </div>
  );
};

// ─── Header compartido (igual en ambas fases) ─────────────────────────────────
const Header: React.FC<{dotColor: string; frame: number}> = ({dotColor, frame}) => {
  const o = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const dot = 0.3 + 0.7 * (Math.floor(frame / 22) % 2 === 0 ? 1 : 0.2);
  return (
    <div style={{position: 'absolute', top: 4, left: 4, right: 0, height: 52, opacity: o, display: 'flex', alignItems: 'center', padding: '0 88px', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.28)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <div style={{width: 8, height: 8, borderRadius: '50%', background: dotColor, opacity: dot, boxShadow: `0 0 12px ${dotColor}`}}/>
        <span style={{fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 3, textTransform: 'uppercase'}}>{V.channel_header}</span>
      </div>
      <span style={{fontFamily: FONTS.mono, fontSize: 12, color: THEME.muted, letterSpacing: 2, opacity: 0.55}}>{V.date_range}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — Revelación del gancho (icono orbital + líneas de texto)
// ═══════════════════════════════════════════════════════════════════════════════
const Phase1: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  const barW = interpolate(frame, [2, 34], [0, 100], {extrapolateRight: 'clamp'});
  const sideH = interpolate(frame, [4, 50], [0, 100], {extrapolateRight: 'clamp'});
  const divO  = interpolate(frame, [20, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const glow  = 0.055 + 0.025 * Math.sin((frame * Math.PI * 2) / 88);

  return (
    <AbsoluteFill style={{
      opacity,
      background: THEME.bg,
      backgroundImage: `linear-gradient(${THEME.grid} 1px,transparent 1px),linear-gradient(90deg,${THEME.grid} 1px,transparent 1px)`,
      backgroundSize: '80px 80px',
    }}>
      {/* Glow izquierdo centrado en el icono */}
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 22% 55%,${THEME.accent}${Math.round(glow*255).toString(16).padStart(2,'0')} 0%,transparent 50%)`,pointerEvents:'none'}}/>

      {/* Barra superior */}
      <div style={{position:'absolute',top:0,left:0,width:`${barW}%`,height:3,background:THEME.accent,boxShadow:`0 0 22px ${THEME.accent},0 0 55px ${THEME.accent}44`}}/>
      {/* Barra lateral izquierda */}
      <div style={{position:'absolute',left:0,top:0,width:4,height:`${sideH}%`,background:`linear-gradient(to bottom,${THEME.accent},${THEME.accent}44,transparent)`}}/>

      <Header dotColor={THEME.accent} frame={frame}/>

      {/* Cuerpo: icono izquierda | separador | texto derecha */}
      <div style={{position:'absolute',top:56,bottom:56,left:0,right:0,display:'flex',alignItems:'center'}}>

        {/* Columna icono (40%) */}
        <div style={{flex:'0 0 40%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18}}>
          <OrbitalIcon icon={V.gancho_icon ?? 'code'} color={THEME.accent} size={185}/>
          <span style={{fontFamily:FONTS.mono,fontSize:13,color:`${THEME.accent}bb`,letterSpacing:5,textTransform:'uppercase',opacity:interpolate(frame,[38,55],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
            {V.gancho_icon}
          </span>
        </div>

        {/* Separador vertical */}
        <div style={{flex:'0 0 1px',alignSelf:'stretch',background:`linear-gradient(to bottom,transparent,${THEME.accent}55,transparent)`,opacity:divO}}/>

        {/* Columna texto (60%) */}
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'0 72px 0 60px',overflow:'hidden'}}>
          {V.gancho_lines.map((line, i) => {
            const color = COLOR_MAP[line.color] ?? THEME.text;
            const sc = spring({frame: frame - line.from, fps: 30, from: 0.92, to: 1, durationInFrames: 22, config: {damping: 10, stiffness: 118}});
            const xIn = interpolate(frame, [line.from, line.from+22], [120, 0], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
            const oIn = interpolate(frame, [line.from, line.from+16], [0, 1], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
            return (
              <p key={i} style={{
                opacity: oIn,
                transform: `scale(${sc}) translateX(${xIn}px)`,
                fontSize: line.size, color, fontFamily: FONTS.body, fontWeight: line.weight,
                lineHeight: 1.25, margin: '0 0 12px',
                ...(line.color === 'accent' ? {textShadow: `0 0 55px ${THEME.accent}aa,0 0 110px ${THEME.accent}44`} : {}),
              }}>{line.text}</p>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:56,borderTop:'1px solid rgba(255,255,255,0.04)',background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',padding:'0 88px',opacity:interpolate(frame,[145,168],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
        <span style={{fontFamily:FONTS.mono,fontSize:11,color:THEME.muted,letterSpacing:3,textTransform:'uppercase',opacity:0.45}}>Neural Studio · Historia Tecnológica</span>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 — Impacto del dato (número gigante + línea clave)
// ═══════════════════════════════════════════════════════════════════════════════
const Phase2: React.FC<{opacity: number; startFrame: number}> = ({opacity, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f = Math.max(0, frame - startFrame); // frame relativo a la fase 2

  const barW    = interpolate(f, [2, 30], [0, 100], {extrapolateRight: 'clamp'});
  const sideH   = interpolate(f, [4, 48], [0, 100], {extrapolateRight: 'clamp'});
  const entryS  = spring({frame: f, fps, from: 0.92, to: 1, durationInFrames: 32, config: {damping: 13}});
  const statSlam = spring({frame: f - 2, fps, from: 3.2, to: 1, durationInFrames: 20, config: {damping: 7, stiffness: 260}});
  const statO   = interpolate(f, [2, 16], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const lineO   = interpolate(f, [24, 44], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const descO   = interpolate(f, [42, 60], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const barAccO = interpolate(f, [55, 78], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const glow    = 0.08 + 0.04 * Math.sin((frame * Math.PI * 2) / 72); // usa frame global para continuidad
  const accentLine = V.gancho_lines.find(l => l.color === 'accent') ?? V.gancho_lines[1];

  // Escáner horizontal sutil
  const scanCycle = 140;
  const scanPos   = (frame % scanCycle) / scanCycle;
  const scanO     = Math.sin(scanPos * Math.PI) * 0.05;

  return (
    <AbsoluteFill style={{
      opacity,
      background: THEME.bg,
      backgroundImage: `linear-gradient(${THEME.grid} 1px,transparent 1px),linear-gradient(90deg,${THEME.grid} 1px,transparent 1px)`,
      backgroundSize: '80px 80px',
    }}>
      {/* Glow rojo de impacto */}
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 50% 50%,${IMPACT}${Math.round(glow*255).toString(16).padStart(2,'0')} 0%,transparent 58%)`,pointerEvents:'none'}}/>

      {/* Escáner horizontal */}
      <div style={{position:'absolute',top:0,bottom:0,left:`${scanPos*100}%`,width:100,background:`linear-gradient(to right,transparent,${IMPACT}${Math.round(scanO*255).toString(16).padStart(2,'0')},transparent)`,pointerEvents:'none'}}/>

      {/* Número fantasma de fondo */}
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',pointerEvents:'none'}}>
        <span style={{fontFamily:FONTS.mono,fontSize:520,fontWeight:900,color:IMPACT,opacity:0.055,letterSpacing:'-0.07em',lineHeight:1,userSelect:'none',whiteSpace:'nowrap'}}>
          {V.gancho_stat}
        </span>
      </div>

      {/* Barras estructurales */}
      <div style={{position:'absolute',top:0,left:0,width:`${barW}%`,height:3,background:IMPACT,boxShadow:`0 0 22px ${IMPACT},0 0 55px ${IMPACT}44`}}/>
      <div style={{position:'absolute',left:0,top:0,width:4,height:`${sideH}%`,background:`linear-gradient(to bottom,${IMPACT},${IMPACT}44,transparent)`}}/>

      <Header dotColor={IMPACT} frame={f}/>

      {/* Contenido central */}
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 180px',transform:`scale(${entryS})`}}>

        {/* Stat principal — SLAM desde escala 3x */}
        <div style={{opacity:statO,transform:`scale(${statSlam})`,fontFamily:FONTS.mono,fontSize:200,fontWeight:900,color:IMPACT,letterSpacing:'-0.04em',lineHeight:1,textShadow:`0 0 70px ${IMPACT}99,0 0 140px ${IMPACT}44,0 0 200px ${IMPACT}33`,marginBottom:16}}>
          {V.gancho_stat}
        </div>

        {/* Línea accent del gancho */}
        <p style={{opacity:lineO,fontFamily:FONTS.body,fontSize:accentLine.size,fontWeight:accentLine.weight,color:THEME.text,textAlign:'center',lineHeight:1.25,margin:'0 0 18px',textShadow:`0 0 40px ${IMPACT}55`}}>
          {accentLine.text}
        </p>

        {/* Descripción del stat */}
        <span style={{opacity:descO,fontFamily:FONTS.mono,fontSize:15,color:THEME.muted,letterSpacing:4,textTransform:'uppercase'}}>
          {V.gancho_stat_desc}
        </span>

        {/* Barra inferior */}
        <div style={{width:100,height:2,background:IMPACT,marginTop:38,opacity:barAccO*0.7,boxShadow:`0 0 14px ${IMPACT}88`}}/>
      </div>

      {/* Footer */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:56,borderTop:'1px solid rgba(255,255,255,0.04)',background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',padding:'0 88px',opacity:interpolate(f,[60,85],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
        <span style={{fontFamily:FONTS.mono,fontSize:11,color:THEME.muted,letterSpacing:3,textTransform:'uppercase',opacity:0.45}}>Neural Studio · Historia Tecnológica</span>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export const GanchoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const mid = Math.floor(durationInFrames / 2);
  const phase1O = interpolate(frame, [mid - 28, mid + 12], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const phase2O = interpolate(frame, [mid - 18, mid + 22], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const phase2Start = mid - 18;

  // Fade to black en los últimos 40 frames (transición al primer NewsCard)
  const blackO = interpolate(frame, [durationInFrames - 40, durationInFrames], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});

  return (
    <AbsoluteFill>
      <Phase1 opacity={phase1O}/>
      <Phase2 opacity={phase2O} startFrame={phase2Start}/>
      <AbsoluteFill style={{background:'#000000', opacity:blackO, pointerEvents:'none'}}/>
    </AbsoluteFill>
  );
};
