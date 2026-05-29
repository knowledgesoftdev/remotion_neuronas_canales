import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import styles from './SidebarCalendar.module.css'

const API = 'http://localhost:8000'

interface PublishedEntry {
  date: string
  time: string
  title: string
  youtube_video_id: string
  views: number
  ctr: number
}

interface CalendarData {
  published: PublishedEntry[]
  recommended_days: number[]   // 0=Dom…6=Sáb
  recommended_hour: string
  optimal_tz: string
}

const DAYS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function SidebarCalendar() {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const { data } = useQuery<CalendarData>({
    queryKey: ['calendar'],
    queryFn: () => axios.get(`${API}/analytics/calendar`).then(r => r.data),
    refetchInterval: 60_000,
  })

  const published = data?.published ?? []
  const recDays = data?.recommended_days ?? [1, 3, 5]
  const recHour = data?.recommended_hour ?? '18:00'

  // Map date-string → entry (last published per date wins if multiple)
  const pubMap: Record<string, PublishedEntry> = {}
  for (const e of published) pubMap[e.date] = e

  const firstDay = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()

  const prev = () => setCursor(c => {
    const m = c.m === 0 ? 11 : c.m - 1
    return { y: c.m === 0 ? c.y - 1 : c.y, m }
  })
  const next = () => setCursor(c => {
    const m = c.m === 11 ? 0 : c.m + 1
    return { y: c.m === 11 ? c.y + 1 : c.y, m }
  })

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Build grid cells (leading blanks + days)
  const cells: Array<{ day: number | null; date: string | null }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, date: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.arrow} onClick={prev}><ChevronLeft size={12} /></button>
        <span className={styles.monthLabel}>
          {MONTHS_ES[cursor.m].slice(0, 3)} {cursor.y}
        </span>
        <button className={styles.arrow} onClick={next}><ChevronRight size={12} /></button>
      </div>

      <div className={styles.dayHeaders}>
        {DAYS_ES.map(d => <span key={d} className={styles.dayHead}>{d}</span>)}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell.day || !cell.date) return <span key={i} />

          const pub = pubMap[cell.date]
          const isToday = cell.date === todayStr
          // Recommended: future + matches recommended day of week
          const dow = new Date(cell.date + 'T12:00:00').getDay()
          const isPast = cell.date < todayStr
          const isRec = !isPast && recDays.includes(dow) && !pub

          return (
            <span
              key={i}
              className={[
                styles.cell,
                isToday ? styles.today : '',
                pub ? styles.published : '',
                isRec ? styles.recommended : '',
              ].join(' ')}
              title={pub
                ? `✓ ${pub.title}\n${pub.views} vistas · CTR ${pub.ctr}%`
                : isRec ? `Publicar a las ${recHour} (Lima)` : ''}
            >
              {cell.day}
              {pub && <span className={styles.dot} />}
            </span>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dotLegend} />
          publicado
        </span>
        <span className={styles.legendItem}>
          <span className={styles.recLegend} />
          publicar
        </span>
        <span className={styles.hourHint}>
          <Clock size={9} />
          {recHour} Lima
        </span>
      </div>
    </div>
  )
}
