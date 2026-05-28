import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Save, ExternalLink, Loader } from 'lucide-react'
import styles from './Videos.module.css'

const API = 'http://localhost:8001'
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
}

function fmtDuration(s: number): string {
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
        type="number"
        step="0.1"
        min="0"
        max="100"
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

export default function Videos() {
  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ['videos'],
    queryFn: () => axios.get(`${API}/analytics/videos`).then(r => r.data),
  })

  const withCtr    = videos.filter(v => v.ctr > 0)
  const avgCtr     = withCtr.length
    ? (withCtr.reduce((a, v) => a + v.ctr, 0) / withCtr.length).toFixed(2)
    : '—'
  const avgRet     = videos.length
    ? fmtDuration(videos.reduce((a, v) => a + v.avg_view_duration, 0) / videos.length)
    : '—'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Videos del canal</h1>
          <p className={styles.subtitle}>
            Ingresa el CTR de cada video desde YouTube Studio — el sistema aprende de estos datos
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
            <span className={styles.summaryVal} style={{ color: 'var(--purple)' }}>{avgRet}</span>
            <span className={styles.summaryLabel}>Retención prom.</span>
          </div>
        </div>
      </header>

      <div className={styles.hint}>
        <Save size={13} />
        Escribe el CTR y presiona <kbd>Enter</kbd> o haz clic fuera del campo para guardar. Lo encuentras en YouTube Studio → Contenido → columna CTR.
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
                <th className={styles.thNum}>Vistas</th>
                <th className={styles.thNum}>Likes</th>
                <th className={styles.thNum}>Retención</th>
                <th className={styles.thCtr}>CTR (YouTube Studio)</th>
              </tr>
            </thead>
            <tbody>
              {videos.map(v => (
                <tr key={v.id} className={styles.row}>
                  <td className={styles.tdThumb}>
                    <img
                      src={YT_THUMB(v.youtube_video_id)}
                      alt=""
                      className={styles.thumb}
                    />
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
                    <span className={styles.videoCounts}>
                      {v.comments} comentarios
                    </span>
                  </td>
                  <td className={styles.tdNum}>{v.views.toLocaleString()}</td>
                  <td className={styles.tdNum}>{v.likes.toLocaleString()}</td>
                  <td className={styles.tdNum}>
                    {v.avg_view_duration > 0
                      ? <><span>{fmtDuration(v.avg_view_duration)}</span><span className={styles.retPct}>{v.avg_view_percentage.toFixed(1)}%</span></>
                      : '—'}
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

