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
  impressions: number
  avg_view_duration: number
  avg_view_percentage: number
  published_at: string | null
}

function parseImpressions(val: string): number {
  const s = val.trim().replace(/,/g, '.').toLowerCase()
  if (s.endsWith('k')) return Math.round(parseFloat(s) * 1000)
  if (s.endsWith('m')) return Math.round(parseFloat(s) * 1_000_000)
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function fmtImpressions(n: number): string {
  if (n <= 0) return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function parseDuration(str: string): number {
  const parts = str.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  return 0
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ImpressionsCell({ video }: { video: Video }) {
  const qc = useQueryClient()
  const [val, setVal] = useState(video.impressions > 0 ? fmtImpressions(video.impressions) : '')
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (impressions: number) =>
      axios.patch(`${API}/analytics/videos/${video.youtube_video_id}/impressions`, { impressions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const commit = () => {
    const n = parseImpressions(val)
    if (n >= 0 && n !== video.impressions) save.mutate(n)
  }

  return (
    <div className={styles.ctrCell}>
      <input
        className={`${styles.ctrInput} ${saved ? styles.ctrSaved : ''}`}
        type="text"
        placeholder="—"
        value={val}
        onChange={e => { setVal(e.target.value); setSaved(false) }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        title="Impressions (e.g. 1.2K, 3.4K)"
        style={{ width: 56 }}
      />
      {save.isPending && <Loader size={11} className={styles.spin} />}
      {saved && <span className={styles.savedDot} title="Saved" />}
    </div>
  )
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
      {saved && <span className={styles.savedDot} title="Saved" />}
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

  const commit = () => {
    const body: { avg_view_duration?: number; avg_view_percentage?: number } = {}
    const durSecs = parseDuration(dur)
    if (durSecs > 0 && durSecs !== video.avg_view_duration) body.avg_view_duration = durSecs
    const pctNum = parseFloat(pct)
    if (!isNaN(pctNum) && pctNum >= 0 && pctNum !== video.avg_view_percentage) body.avg_view_percentage = pctNum
    if (Object.keys(body).length > 0) save.mutate(body)
  }

  return (
    <div className={styles.retCell}>
      <input
        className={`${styles.retInput} ${saved ? styles.ctrSaved : ''}`}
        type="text"
        placeholder="m:ss"
        value={dur}
        onChange={e => { setDur(e.target.value); setSaved(false) }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
      />
      <input
        className={`${styles.retInputPct} ${saved ? styles.ctrSaved : ''}`}
        type="number"
        step="0.1"
        min="0"
        max="100"
        placeholder="%"
        value={pct}
        onChange={e => { setPct(e.target.value); setSaved(false) }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
      />
      {save.isPending && <Loader size={11} className={styles.spin} />}
      {saved && <span className={styles.savedDot} title="Saved" />}
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
          <h1 className={styles.title}>Channel videos</h1>
          <p className={styles.subtitle}>
            Enter CTR and retention from YouTube Studio — the system learns from this data
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
            <span className={styles.summaryLabel}>Avg CTR</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal} style={{ color: 'var(--purple)' }}>
              {avgRet}{avgRet !== '—' ? '%' : ''}
            </span>
            <span className={styles.summaryLabel}>Avg Retention</span>
          </div>
        </div>
      </header>

      <div className={styles.hint}>
        <Save size={13} />
        Enter CTR and retention, then press <kbd>Enter</kbd> or click outside to save. Find them in YouTube Studio → Content.
      </div>

      {isLoading ? (
        <div className={styles.loading}><Loader size={24} className={styles.spin} /></div>
      ) : videos.length === 0 ? (
        <div className={styles.empty}>Sync the channel first to see videos.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thThumb} />
                <th className={styles.thTitle}>Video</th>
                <th className={styles.thNum}>Views</th>
                <th className={styles.thNum}>Likes</th>
                <th className={styles.thCtr}>Impressions</th>
                <th className={styles.thDate}>Published</th>
                <th className={styles.thRet}>Retention</th>
                <th className={styles.thCtr}>CTR (YouTube Studio)</th>
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
                    <span className={styles.videoCounts}>{v.comments} comments</span>
                  </td>
                  <td className={styles.tdNum}>{v.views.toLocaleString()}</td>
                  <td className={styles.tdNum}>{v.likes.toLocaleString()}</td>
                  <td className={styles.tdCtr}><ImpressionsCell video={v} /></td>
                  <td className={styles.tdDate}>{fmtDate(v.published_at)}</td>
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
