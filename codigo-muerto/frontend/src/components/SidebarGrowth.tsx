import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Target, Clock } from 'lucide-react'
import styles from './SidebarGrowth.module.css'

const API = 'http://localhost:8000'

interface Milestone {
  label: string
  date: string
  reached: boolean
}

interface ViralInsight {
  views: number
  hours: number
  label: string
}

interface GrowthData {
  subscribers: { current: number; target_ypp: number; pct: number }
  watch_hours: { current: number; target_ypp: number; pct: number }
  days_active: number
  milestones: Milestone[]
  scenario: string
  viral_insight?: ViralInsight
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
}

function Bar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${clamped}%`, background: color }} />
    </div>
  )
}

export default function SidebarGrowth() {
  const { data } = useQuery<GrowthData>({
    queryKey: ['growth-projection'],
    queryFn: () => axios.get(`${API}/analytics/growth-projection`).then(r => r.data),
    refetchInterval: 60_000,
  })

  if (!data) return null

  const { subscribers: subs, watch_hours: hours, milestones, viral_insight } = data

  // YPP milestone
  const ypp = milestones.find(m => m.label === 'YPP activo')
  const m100 = milestones.find(m => m.label === '100 subs')

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <Target size={12} color="var(--accent)" />
        <span className={styles.title}>Monetización</span>
      </div>

      {/* Suscriptores */}
      <div className={styles.metric}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>Suscriptores</span>
          <span className={styles.metricVal}>
            <span style={{ color: 'var(--accent)' }}>{subs.current.toLocaleString()}</span>
            <span className={styles.metricTarget}> / 1K</span>
          </span>
        </div>
        <Bar pct={subs.pct} color="var(--accent)" />
        <span className={styles.pctLabel}>{subs.pct.toFixed(1)}%</span>
      </div>

      {/* Watch hours */}
      <div className={styles.metric}>
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>Horas de vista</span>
          <span className={styles.metricVal}>
            <span style={{ color: 'var(--purple)' }}>{hours.current.toFixed(0)}h</span>
            <span className={styles.metricTarget}> / 4K</span>
          </span>
        </div>
        <Bar pct={hours.pct} color="var(--purple)" />
        <span className={styles.pctLabel}>{hours.pct.toFixed(1)}%</span>
      </div>

      {/* Milestones */}
      <div className={styles.milestones}>
        {milestones.filter(m => m.label !== 'YPP activo').map(m => (
          <div key={m.label} className={`${styles.milestone} ${m.reached ? styles.milestoneReached : ''}`}>
            <span className={m.reached ? styles.checkDone : styles.checkPending}>
              {m.reached ? '✓' : '○'}
            </span>
            <span className={styles.mLabel}>{m.label}</span>
            <span className={styles.mDate}>{m.reached ? 'listo' : fmtDate(m.date)}</span>
          </div>
        ))}
      </div>

      {/* YPP target date */}
      {ypp && !ypp.reached && (
        <div className={styles.yppTarget}>
          <Clock size={10} color="var(--accent)" />
          <span>YPP estimado: <strong>{fmtDate(ypp.date)}</strong></span>
        </div>
      )}
      {ypp?.reached && (
        <div className={styles.yppReached}>¡Canal monetizado! 🎉</div>
      )}

      {/* Next milestone hint */}
      {!m100?.reached && (
        <div className={styles.hint}>
          Meta inmediata: {m100 ? fmtDate(m100.date) : '—'}
        </div>
      )}

      {viral_insight && (
        <div className={styles.viralHint}>
          <span className={styles.viralBolt}>&#9889;</span>
          {viral_insight.label}
        </div>
      )}

      <div className={styles.scenario}>{data.scenario}</div>
    </div>
  )
}
