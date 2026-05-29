import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Save, ExternalLink, Loader, Edit2, Check, X, History } from 'lucide-react'
import styles from './Videos.module.css'

const API = 'http://localhost:8000'
const YT_THUMB = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
const YT_URL   = (id: string) => `https://youtube.com/watch?v=${id}`

interface TitleHistoryEntry {
  old_title: string
  new_title: string
  ctr_before: number
  changed_at: string
}

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
  is_canal_b: boolean
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

/* ── Gap 5: edición de título + historial A/B ── */
function TitleCell({ video }: { video: Video }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(video.title)
  const [showHistory, setShowHistory] = useState(false)

  const { data: history } = useQuery<{ history: TitleHistoryEntry[]; current_ctr: number }>({
    queryKey: ['title-history', video.youtube_video_id],
    queryFn: () => axios.get(`${API}/analytics/videos/${video.youtube_video_id}/title-history`).then(r => r.data),
    enabled: showHistory,
  })

  const save = useMutation({
    mutationFn: (title: string) =>
      axios.patch(`${API}/analytics/videos/${video.youtube_video_id}/title`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] })
      qc.invalidateQueries({ queryKey: ['title-history', video.youtube_video_id] })
      setEditing(false)
    },
  })

  const cancel = () => { setVal(video.title); setEditing(false) }

  return (
    <div className={styles.titleCellWrap}>
      {editing ? (
        <div className={styles.titleEdit}>
          <input
            className={styles.titleInput}
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save.mutate(val); if (e.key === 'Escape') cancel() }}
          />
          <span className={`${styles.titleCharCount} ${val.length > 55 ? styles.over : ''}`}>{val.length}/55</span>
          <button className={styles.titleSaveBtn} onClick={() => save.mutate(val)} disabled={save.isPending || !val.trim()}>
            {save.isPending ? <Loader size={11} className={styles.spin} /> : <Check size={11} />}
          </button>
          <button className={styles.titleCancelBtn} onClick={cancel}><X size={11} /></button>
        </div>
      ) : (
        <div className={styles.titleRow}>
          <a href={YT_URL(video.youtube_video_id)} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
            {video.title || video.youtube_video_id}
            <ExternalLink size={11} />
          </a>
          <button className={styles.titleEditBtn} onClick={() => setEditing(true)} title="Cambiar título (A/B test)">
            <Edit2 size={10} />
          </button>
          {history && history.history.length > 0 && (
            <button
              className={styles.titleHistoryBtn}
              onClick={() => setShowHistory(v => !v)}
              title="Historial de cambios"
            >
              <History size={10} />
            </button>
          )}
        </div>
      )}

      {showHistory && history && history.history.length > 0 && (
        <div className={styles.historyPanel}>
          {history.history.map((h, i) => {
            const delta = history.current_ctr - h.ctr_before
            return (
              <div key={i} className={styles.historyEntry}>
                <span className={styles.histOld}>{h.old_title}</span>
                <span className={styles.histArrow}>→</span>
                <span className={styles.histNew}>{h.new_title}</span>
                <span className={`${styles.histDelta} ${delta > 0 ? styles.deltaPos : delta < 0 ? styles.deltaNeg : ''}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}% CTR
                </span>
                <span className={styles.histDate}>{new Date(h.changed_at).toLocaleDateString('es-PE')}</span>
              </div>
            )
          })}
        </div>
      )}
      <span className={styles.videoCounts}>{video.comments} comentarios</span>
    </div>
  )
}

/* ── Gap 3: toggle Canal B ── */
function CanalBToggle({ video }: { video: Video }) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: (val: boolean) =>
      axios.patch(`${API}/analytics/videos/${video.youtube_video_id}/canal-b`, { is_canal_b: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['videos'] }),
  })
  return (
    <button
      className={`${styles.canalBBtn} ${video.is_canal_b ? styles.canalBActive : ''}`}
      onClick={() => toggle.mutate(!video.is_canal_b)}
      title={video.is_canal_b ? 'Canal B — clic para desmarcar' : 'Marcar como Canal B (baja resonancia LatAm)'}
      disabled={toggle.isPending}
    >
      {toggle.isPending ? <Loader size={10} className={styles.spin} /> : video.is_canal_b ? 'B' : '·'}
    </button>
  )
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
        title="Impresiones (ej: 1.2K, 3.4K)"
        style={{ width: 56 }}
      />
      {save.isPending && <Loader size={11} className={styles.spin} />}
      {saved && <span className={styles.savedDot} title="Guardado" />}
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
  const avgCtrNum = withCtr.length
    ? withCtr.reduce((a, v) => a + v.ctr, 0) / withCtr.length
    : null
  const avgCtr = avgCtrNum !== null ? avgCtrNum.toFixed(2) : '—'

  const withRet = videos.filter(v => v.avg_view_percentage > 0)
  const avgRetNum = withRet.length
    ? withRet.reduce((a, v) => a + v.avg_view_percentage, 0) / withRet.length
    : null
  const avgRet = avgRetNum !== null ? avgRetNum.toFixed(1) : '—'

  const CTR_RED = 1.5
  const CTR_YELLOW = 3.0
  const RET_RED = 20
  const RET_YELLOW = 35

  const ctrColor = (ctr: number) => {
    if (ctr <= 0) return undefined
    if (ctr < CTR_RED) return 'var(--danger)'
    if (ctr < CTR_YELLOW) return '#f0a500'
    return '#22c55e'
  }
  const retColor = (ret: number) => {
    if (ret <= 0) return undefined
    if (ret < RET_RED) return 'var(--danger)'
    if (ret < RET_YELLOW) return '#f0a500'
    return '#22c55e'
  }

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
            <span className={styles.summaryVal} style={{ color: avgCtrNum !== null ? ctrColor(avgCtrNum) : 'var(--accent)' }}>
              {avgCtr}{avgCtr !== '—' ? '%' : ''}
            </span>
            <span className={styles.summaryLabel}>CTR promedio</span>
            <span className={styles.summaryBenchmark}>benchmark: 4%</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal} style={{ color: avgRetNum !== null ? retColor(avgRetNum) : 'var(--purple)' }}>
              {avgRet}{avgRet !== '—' ? '%' : ''}
            </span>
            <span className={styles.summaryLabel}>Retención prom.</span>
            <span className={styles.summaryBenchmark}>benchmark: 40%</span>
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
                <th className={styles.thCtr}>Impresiones</th>
                <th className={styles.thRet}>Retención (mm:ss / %)</th>
                <th className={styles.thCtr}>CTR</th>
                <th className={styles.thCtr} title="Canal B = baja resonancia en LatAm">B</th>
              </tr>
            </thead>
            <tbody>
              {videos.map(v => (
                <tr key={v.id} className={styles.row}>
                  <td className={styles.tdThumb}>
                    <img src={YT_THUMB(v.youtube_video_id)} alt="" className={styles.thumb} />
                  </td>
                  <td className={styles.tdTitle}>
                    {v.is_canal_b && (
                      <span className={styles.canalBBadge} title="Canal B — baja resonancia en LatAm">Canal B</span>
                    )}
                    <TitleCell video={v} />
                  </td>
                  <td className={styles.tdNum}>{fmtDate(v.published_at)}</td>
                  <td className={styles.tdNum}>{v.views.toLocaleString()}</td>
                  <td className={styles.tdNum}>{v.likes.toLocaleString()}</td>
                  <td className={styles.tdCtr}>
                    <ImpressionsCell video={v} />
                  </td>
                  <td className={styles.tdRet}>
                    <RetentionCell video={v} />
                    {v.avg_view_percentage > 0 && (
                      <span style={{ fontSize: 10, color: retColor(v.avg_view_percentage), marginLeft: 4 }}>
                        {v.avg_view_percentage < RET_RED ? '▼' : v.avg_view_percentage < RET_YELLOW ? '◆' : '▲'}
                      </span>
                    )}
                  </td>
                  <td className={styles.tdCtr}>
                    <CTRCell video={v} />
                    {v.ctr > 0 && (
                      <span style={{ fontSize: 10, color: ctrColor(v.ctr), marginLeft: 2 }}>
                        {v.ctr < CTR_RED ? '▼' : v.ctr < CTR_YELLOW ? '◆' : '▲'}
                      </span>
                    )}
                  </td>
                  <td className={styles.tdCtr}>
                    <CanalBToggle video={v} />
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
