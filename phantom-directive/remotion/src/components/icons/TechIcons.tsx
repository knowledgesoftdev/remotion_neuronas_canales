import React from 'react';

interface IconProps { size?: number; color?: string; strokeWidth?: number; }

export const IconDatabase: React.FC<IconProps> = ({size=96,color='#cc2222',strokeWidth=3}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <ellipse cx="48" cy="22" rx="34" ry="12" stroke={color} strokeWidth={strokeWidth}/>
    <ellipse cx="48" cy="74" rx="34" ry="12" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="14" y1="22" x2="14" y2="74" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="82" y1="22" x2="82" y2="74" stroke={color} strokeWidth={strokeWidth}/>
    <ellipse cx="48" cy="48" rx="34" ry="12" stroke={color} strokeWidth={strokeWidth} strokeDasharray="6 4"/>
  </svg>
);

export const IconRails: React.FC<IconProps> = ({size=96,color='#cc2222',strokeWidth=3}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <polygon points="48,6 82,26 82,66 48,86 14,66 14,26" stroke={color} strokeWidth={strokeWidth}/>
    <text x="48" y="54" textAnchor="middle" fill={color} fontSize="18" fontFamily="'JetBrains Mono',monospace" fontWeight="700">RoR</text>
    <circle cx="48" cy="48" r="16" stroke={color} strokeWidth={strokeWidth} strokeDasharray="4 3"/>
  </svg>
);

export const IconJVM: React.FC<IconProps> = ({size=96,color='#8b5cf6',strokeWidth=3}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <polyline points="56,8 32,48 50,48 36,88 68,42 50,42 64,8" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
);

export const IconNetwork: React.FC<IconProps> = ({size=96,color='#8b5cf6',strokeWidth=2}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <circle cx="48" cy="48" r="10" stroke={color} strokeWidth={strokeWidth+1} fill={`${color}22`}/>
    {[0,60,120,180,240,300].map((deg,i) => {
      const rad=(deg*Math.PI)/180;
      const x=48+Math.cos(rad)*28, y=48+Math.sin(rad)*28;
      const lx=48+Math.cos(rad)*10, ly=48+Math.sin(rad)*10;
      return <g key={i}><line x1={lx} y1={ly} x2={x} y2={y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="3 2"/><circle cx={x} cy={y} r={6} stroke={color} strokeWidth={strokeWidth}/></g>;
    })}
  </svg>
);

export const IconFanout: React.FC<IconProps> = ({size=96,color='#00d4ff',strokeWidth=2.5}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <circle cx="48" cy="12" r="6" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="48" y1="18" x2="48" y2="36" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="48" y1="36" x2="24" y2="52" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="48" y1="36" x2="72" y2="52" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="24" cy="58" r="6" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="72" cy="58" r="6" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="24" y1="64" x2="14" y2="80" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="24" y1="64" x2="34" y2="80" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="72" y1="64" x2="62" y2="80" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="72" y1="64" x2="82" y2="80" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="14" cy="84" r="4" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="34" cy="84" r="4" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="62" cy="84" r="4" stroke={color} strokeWidth={strokeWidth}/>
    <circle cx="82" cy="84" r="4" stroke={color} strokeWidth={strokeWidth}/>
  </svg>
);

export const IconTeam: React.FC<IconProps> = ({size=96,color='#e2e8f0',strokeWidth=2.5}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <circle cx="30" cy="26" r="12" stroke={color} strokeWidth={strokeWidth}/>
    <path d="M 8 68 Q 8 46 30 46 Q 52 46 52 68" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    <circle cx="66" cy="26" r="12" stroke={color} strokeWidth={strokeWidth} opacity="0.5"/>
    <path d="M 44 68 Q 44 46 66 46 Q 88 46 88 68" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.5"/>
    <line x1="57" y1="17" x2="75" y2="35" stroke="#cc2222" strokeWidth="3" strokeLinecap="round"/>
    <line x1="75" y1="17" x2="57" y2="35" stroke="#cc2222" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export const IconGear: React.FC<IconProps> = ({size=96,color='#f59e0b',strokeWidth=2.5}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <circle cx="48" cy="48" r="14" stroke={color} strokeWidth={strokeWidth}/>
    {[0,45,90,135,180,225,270,315].map((deg,i) => {
      const rad=(deg*Math.PI)/180, perp=(deg+90)*Math.PI/180, pw=5;
      const x1=48+Math.cos(rad)*18, y1=48+Math.sin(rad)*18;
      const x2=48+Math.cos(rad)*30, y2=48+Math.sin(rad)*30;
      return <polygon key={i} points={`${x1+Math.cos(perp)*pw},${y1+Math.sin(perp)*pw} ${x1-Math.cos(perp)*pw},${y1-Math.sin(perp)*pw} ${x2-Math.cos(perp)*pw},${y2-Math.sin(perp)*pw} ${x2+Math.cos(perp)*pw},${y2+Math.sin(perp)*pw}`} stroke={color} strokeWidth="1.5"/>;
    })}
  </svg>
);

export const IconAlert: React.FC<IconProps> = ({size=96,color='#cc2222',strokeWidth=3}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <polygon points="48,8 90,84 6,84" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    <line x1="48" y1="38" x2="48" y2="62" stroke={color} strokeWidth={strokeWidth+1} strokeLinecap="round"/>
    <circle cx="48" cy="73" r="3" fill={color}/>
  </svg>
);

export const IconClock: React.FC<IconProps> = ({size=96,color='#64748b',strokeWidth=2.5}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <circle cx="48" cy="48" r="34" stroke={color} strokeWidth={strokeWidth}/>
    <line x1="48" y1="48" x2="48" y2="24" stroke={color} strokeWidth={strokeWidth+0.5} strokeLinecap="round"/>
    <line x1="48" y1="48" x2="66" y2="58" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    <circle cx="48" cy="48" r="3" fill={color}/>
  </svg>
);

export const IconCode: React.FC<IconProps> = ({size=96,color='#8b5cf6',strokeWidth=2.5}) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <polyline points="34,28 14,48 34,68" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="62,28 82,48 62,68" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="56" y1="22" x2="40" y2="74" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.6"/>
  </svg>
);
