import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Clock, Target, Zap, CalendarDays } from 'lucide-react'
import styles from './Calendario.module.css'

const API = 'http://localhost:8000'
const YT_THUMB = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
const YT_URL   = (id: string) => `https://youtube.com/watch?v=${id}`

/* ── Types ── */
interface PubEntry {
  date: string; time: string; title: string
  youtube_video_id: string; views: number; ctr: number
}
interface CalendarData {
  published: PubEntry[]
  recommended_days: number[]
  recommended_hour: string
}
interface Milestone { label: string; date: string; reached: boolean }
interface Scenario {
  key: string
  label: string
  color: string
  probability: number
  condition: string
  ypp_date: string
  over_5y: boolean
  bottleneck: string | null
  detail: string
}
interface GrowthData {
  subscribers: { current: number; target_ypp: number; pct: number }
  watch_hours:  { current: number; target_ypp: number; pct: number }
  days_active:  number
  scenarios:    Scenario[]
  milestones:   Milestone[]
  viral_insight?: { hours: number; pct_of_target: number; label: string }
}

/* ── Helpers ── */
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtMilestone(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProgressRing({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * Math.min(pct / 100, 1)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={6} strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

/* ═══════════════════════════════════════════════
   CALENDAR SECTION
═══════════════════════════════════════════════ */
function CalendarSection({ data }: { data: CalendarData }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const pubMap: Record<string, PubEntry[]> = {}
  for (const e of data.published) {
    if (!pubMap[e.date]) pubMap[e.date] = []
    pubMap[e.date].push(e)
  }

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const cells: { day: number | null; date: string | null }[] = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, date: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${cursor.y}-${String(cursor.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, date })
  }

  const prev = () => setCursor(c => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))
  const next = () => setCursor(c => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))

  return (
    <div className={styles.calCard}>
      {/* Month header */}
      <div className={styles.calHeader}>
        <button className={styles.calArrow} onClick={prev}><ChevronLeft size={16} /></button>
        <h2 className={styles.calMonth}>{MONTHS_ES[cursor.m]} {cursor.y}</h2>
        <button className={styles.calArrow} onClick={next}><ChevronRight size={16} /></button>
      </div>

      {/* Day-of-week labels */}
      <div className={styles.dowRow}>
        {DAYS_ES.map(d => (
          <span key={d} className={`${styles.dowLabel} ${d === 'Lun' || d === 'Mié' || d === 'Vie' ? styles.dowRec : ''}`}>
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell.day || !cell.date) return <div key={i} className={styles.cellEmpty} />

          const entries = pubMap[cell.date] ?? []
          const isToday = cell.date === todayStr
          const isPast  = cell.date < todayStr
          const dow = new Date(cell.date + 'T12:00:00').getDay()
          const isRec = !isPast && !isToday && data.recommended_days.includes(dow) && entries.length === 0

          return (
            <div
              key={i}
              className={[
                styles.cell,
                isToday  ? styles.cellToday : '',
                entries.length > 0 ? styles.cellPub : '',
                isRec    ? styles.cellRec : '',
                isPast && entries.length === 0 ? styles.cellPast : '',
              ].filter(Boolean).join(' ')}
            >
              <span className={styles.cellDay}>{cell.day}</span>

              {entries.map(e => (
                <a
                  key={e.youtube_video_id}
                  href={YT_URL(e.youtube_video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.pubCard}
                  title={`${e.title}\n${e.views} vistas · CTR ${e.ctr}%`}
                >
                  <img src={YT_THUMB(e.youtube_video_id)} alt="" className={styles.pubThumb} />
                  <span className={styles.pubTitle}>{e.title}</span>
                  <span className={styles.pubMeta}>{e.views}v · {e.ctr}%</span>
                </a>
              ))}

              {isRec && (
                <div className={styles.recSlot}>
                  <Clock size={10} />
                  {data.recommended_hour}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legDotGreen} /> Publicado</span>
        <span className={styles.legendItem}><span className={styles.legDotBlue} /> Publicar (L/X/V)</span>
        <span className={styles.legendItem}><Clock size={10} color="var(--accent)" /> {data.recommended_hour} Lima</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   GROWTH SECTION
═══════════════════════════════════════════════ */
function GrowthSection({ data }: { data: GrowthData }) {
  const { subscribers: subs, watch_hours: hours, scenarios, milestones, viral_insight } = data

  return (
    <div className={styles.growthCol}>

      {/* Title */}
      <div className={styles.growthTitle}>
        <Target size={16} color="var(--accent)" />
        <span>Monetización AdSense</span>
      </div>

      {/* Progress rings */}
      <div className={styles.rings}>
        <div className={styles.ringItem}>
          <div className={styles.ringWrap}>
            <ProgressRing pct={subs.pct} color="var(--accent)" size={80} />
            <div className={styles.ringCenter}>
              <span className={styles.ringVal} style={{ color: 'var(--accent)' }}>{subs.current}</span>
              <span className={styles.ringUnit}>subs</span>
            </div>
          </div>
          <span className={styles.ringLabel}>de 1.000</span>
          <span className={styles.ringPct}>{subs.pct.toFixed(1)}%</span>
        </div>

        <div className={styles.ringDivider} />

        <div className={styles.ringItem}>
          <div className={styles.ringWrap}>
            <ProgressRing pct={hours.pct} color="var(--purple)" size={80} />
            <div className={styles.ringCenter}>
              <span className={styles.ringVal} style={{ color: 'var(--purple)' }}>{hours.current.toFixed(0)}</span>
              <span className={styles.ringUnit}>hrs</span>
            </div>
          </div>
          <span className={styles.ringLabel}>de 4.000h</span>
          <span className={styles.ringPct}>{hours.pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* 3 Scenarios */}
      <div className={styles.scenariosTitle}>
        <CalendarDays size={13} color="var(--muted)" />
        <span>Escenarios de monetización</span>
      </div>

      <div className={styles.scenariosList}>
        {scenarios.map(sc => (
          <div key={sc.key} className={styles.scenarioCard} style={{ borderLeftColor: sc.color }}>
            <div className={styles.scTop}>
              <div className={styles.scLeft}>
                <span className={styles.scLabel} style={{ color: sc.color }}>{sc.label}</span>
                <span className={styles.scProb} style={{ background: sc.color + '22', color: sc.color }}>
                  {sc.probability}%
                </span>
              </div>
              <div className={styles.scDate} style={{ color: sc.over_5y ? '#ef4444' : sc.color }}>
                {sc.over_5y ? '> 5 años' : fmtMilestone(sc.ypp_date)}
              </div>
            </div>
            <div className={styles.scCondition}>{sc.condition}</div>
            <div className={styles.scDetail}>{sc.detail}</div>
            {sc.bottleneck && !sc.over_5y && (
              <div className={styles.scBottleneck}>
                Cuello de botella: <strong>{sc.bottleneck}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Milestones (escenario realista) */}
      <div className={styles.milestones}>
        <div className={styles.milestonesTitle}>Hitos (escenario realista)</div>
        {milestones.map((m, i) => (
          <div key={i} className={`${styles.milestone} ${m.reached ? styles.milestoneReached : ''}`}>
            <span className={m.reached ? styles.checkDone : styles.checkPending}>
              {m.reached ? '✓' : `${i + 1}`}
            </span>
            <div className={styles.mInfo}>
              <span className={styles.mLabel}>{m.label}</span>
              <span className={styles.mDate}>{m.reached ? 'Completado' : fmtMilestone(m.date)}</span>
            </div>
            {!m.reached && (
              <div className={styles.mBar}>
                <div className={styles.mBarFill} style={{
                  width: m.label === '100 subs'
                    ? `${Math.min(subs.current, 100)}%`
                    : m.label === '1K subs'
                    ? `${subs.pct}%`
                    : `${hours.pct}%`,
                  background: m.label.includes('hora') ? 'var(--purple)' : 'var(--accent)'
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Viral insight */}
      {viral_insight && (
        <div className={styles.viralBox}>
          <Zap size={14} color="#f0a500" />
          <div>
            <div className={styles.viralTitle}>El atajo</div>
            <div className={styles.viralText}>{viral_insight.label}</div>
            <div className={styles.viralSub}>
              Sin viral, las horas son el cuello de botella hasta 2028.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════ */
export default function Calendario() {
  const { data: calData } = useQuery<CalendarData>({
    queryKey: ['calendar'],
    queryFn: () => axios.get(`${API}/analytics/calendar`).then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: growthData } = useQuery<GrowthData>({
    queryKey: ['growth-projection'],
    queryFn: () => axios.get(`${API}/analytics/growth-projection`).then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calendario</h1>
        <p className={styles.subtitle}>
          Días recomendados: Lunes · Miércoles · Viernes a las 18:00 Lima
        </p>
      </header>

      <div className={styles.layout}>
        {calData
          ? <CalendarSection data={calData} />
          : <div className={styles.loading}>Cargando calendario…</div>}

        {growthData
          ? <GrowthSection data={growthData} />
          : <div className={styles.loading}>Cargando proyección…</div>}
      </div>
    </div>
  )
}
