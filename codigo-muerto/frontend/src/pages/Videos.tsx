import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Save, ExternalLink, Loader } from 'lucide-react'
import styles from './Videos.module.css'

const API = 'http://localhost:8000'
const YT_THUMB = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
const YT_URL   = (id: string) => `https://youtube.com/watch?v=${id}`

interface Video {
  id: number
  youtube_video_id: string
  title: string
  views: number
  likes: number
  comments: number
  ctr: number
  avg_view_duration: number
  avg_view_percentage: number
  published_at: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Converts mm:ss string to total seconds
function parseDuration(val: string): number {
  const parts = val.trim().split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

function fmtDuration(s: number): string {
  if (s <= 0) return ''
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function CTRCell({ video }: { video: Video }) {
  const qc = useQueryClient()
  const [val, setVal] = useState(video.ctr > 0 ? String(video.ctr) : '')
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (ctr: number) =>
      axios.patch(`${API}/analytics/videos/${video.youtube_video_id}/ctr`, { ctr }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const commit = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0 && n !== video.ctr) save.mutate(n)
  }

  return (
    <div className={styles.ctrCell}>
      <input
        className={`${styles.ctrInput} ${saved ? styles.ctrSaved : ''}`}
        type="number" step="0.1" min="0" max="100"
        placeholder="—"
        value={val}
        onChange={e => { setVal(e.target.value); setSaved(false) }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
      />
      <span className={styles.ctrPct}>%</span>
      {save.isPending && <Loader size={11} className={styles.spin} />}
      {saved && <span className={styles.savedDot} title="Guardado" />}
    </div>
  )
}

function RetentionCell({ video }: { video: Video }) {
  const qc = useQueryClient()
  const [dur, setDur] = useState(video.avg_view_duration > 0 ? fmtDuration(video.avg_view_duration) : '')
  const [pct, setPct] = useState(video.avg_view_percentage > 0 ? String(video.avg_view_percentage) : '')
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (body: { avg_view_duration?: number; avg_view_percentage?: number }) =>
      axios.patch(`${API}/analytics/videos/${video.youtube_video_id}/retention`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const commitDur = () => {
    const secs = parseDuration(dur)
    if (secs >= 0 && secs !== video.avg_view_duration) save.mutate({ avg_view_duration: secs })
  }

  const commitPct = () => {
    const n = parseFloat(pct)
    if (!isNaN(n) && n >= 0 && n !== video.avg_view_percentage) save.mutate({ avg_view_percentage: n })
  }

  return (
    <div className={styles.retCell}>
      <input
        className={`${styles.retInput} ${saved ? styles.ctrSaved : ''}`}
        type="text"
        placeholder="0:00"
        value={dur}
        onChange={e => { setDur(e.target.value); setSaved(false) }}
        onBlur={commitDur}
        onKeyDown={e => e.key === 'Enter' && commitDur()}
        title="Duración promedio (mm:ss)"
      />
      <input
        className={`${styles.retInputPct} ${saved ? styles.ctrSaved : ''}`}
        type="number" step="0.1" min="0" max="100"
        placeholder="0"
        value={pct}
        onChange={e => { setPct(e.target.value); setSaved(false) }}
        onBlur={commitPct}
        onKeyDown={e => e.key === 'Enter' && commitPct()}
        title="Retención %"
      />
      <span className={styles.ctrPct}>%</span>
      {save.isPending && <Loader size={11} className={styles.spin} />}
      {saved && <span className={styles.savedDot} title="Guardado" />}
    </div>
  )
}

export default function Videos() {
  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ['videos'],
    queryFn: () => axios.get(`${API}/analytics/videos`).then(r => r.data),
  })

  const withCtr = videos.filter(v => v.ctr > 0)
  const avgCtr  = withCtr.length
    ? (withCtr.reduce((a, v) => a + v.ctr, 0) / withCtr.length).toFixed(2)
    : '—'
  const withRet = videos.filter(v => v.avg_view_percentage > 0)
  const avgRet  = withRet.length
    ? (withRet.reduce((a, v) => a + v.avg_view_percentage, 0) / withRet.length).toFixed(1)
    : '—'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Videos del canal</h1>
          <p className={styles.subtitle}>
            Ingresa CTR y retención desde YouTube Studio — el sistema aprende de estos datos
          </p>
        </div>
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{videos.length}</span>
            <span className={styles.summaryLabel}>Videos</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal} style={{ color: 'var(--accent)' }}>
              {avgCtr}{avgCtr !== '—' ? '%' : ''}
            </span>
            <span className={styles.summaryLabel}>CTR promedio</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal} style={{ color: 'var(--purple)' }}>
              {avgRet}{avgRet !== '—' ? '%' : ''}
            </span>
            <span className={styles.summaryLabel}>Retención prom.</span>
          </div>
        </div>
      </header>

      <div className={styles.hint}>
        <Save size={13} />
        Escribe CTR y retención desde YouTube Studio → Contenido. Retención: ingresa <kbd>mm:ss</kbd> y el porcentaje por separado. Presiona <kbd>Enter</kbd> o clic fuera para guardar.
      </div>

      {isLoading ? (
        <div className={styles.loading}><Loader size={24} className={styles.spin} /></div>
      ) : videos.length === 0 ? (
        <div className={styles.empty}>Sincroniza el canal primero para ver los videos.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thThumb} />
                <th className={styles.thTitle}>Video</th>
                <th className={styles.thNum}>Publicado</th>
                <th className={styles.thNum}>Vistas</th>
                <th className={styles.thNum}>Likes</th>
                <th className={styles.thRet}>Retención (mm:ss / %)</th>
                <th className={styles.thCtr}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {videos.map(v => (
                <tr key={v.id} className={styles.row}>
                  <td className={styles.tdThumb}>
                    <img src={YT_THUMB(v.youtube_video_id)} alt="" className={styles.thumb} />
                  </td>
                  <td className={styles.tdTitle}>
                    <a
                      href={YT_URL(v.youtube_video_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.videoLink}
                    >
                      {v.title || v.youtube_video_id}
                      <ExternalLink size={11} />
                    </a>
                    <span className={styles.videoCounts}>{v.comments} comentarios</span>
                  </td>
                  <td className={styles.tdNum}>{fmtDate(v.published_at)}</td>
                  <td className={styles.tdNum}>{v.views.toLocaleString()}</td>
                  <td className={styles.tdNum}>{v.likes.toLocaleString()}</td>
                  <td className={styles.tdRet}>
                    <RetentionCell video={v} />
                  </td>
                  <td className={styles.tdCtr}>
                    <CTRCell video={v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
