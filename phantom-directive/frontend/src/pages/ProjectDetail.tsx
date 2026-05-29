import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Play, Loader, FileText, ChevronDown, ChevronUp, Save, Copy, Check, MonitorPlay, Film, Images, Link } from 'lucide-react'
import styles from './ProjectDetail.module.css'

const API = 'http://localhost:8001'

const STEPS = ['pending','guion','guion_done','audio','audio_done','sync','sync_done','pexels','pexels_done','metadata','done']
const STEP_LABELS = ['Start','Script','Script ✓','Audio','Audio ✓','Sync','Sync ✓','Footage','Footage ✓','Metadata','Completed']

const STATUS_ALIAS: Record<string, string> = {
  metadata_done: 'done',
}

function statusStep(status: string) {
  const resolved = STATUS_ALIAS[status] ?? status
  const i = STEPS.indexOf(resolved)
  return i === -1 ? 0 : i
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={styles.copyBtn} onClick={copy}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

interface ProgressEntry {
  step: string
  message: string
  done: boolean
  error?: boolean
}

export default function ProjectDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [scriptOpen, setScriptOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [ytId, setYtId] = useState<string>('')
  const [ytIdSaved, setYtIdSaved] = useState(false)
  const [editingNarration, setEditingNarration] = useState<string | null>(null)
  const [savedNarration, setSavedNarration] = useState(false)
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([])
  const [renderDone, setRenderDone] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => axios.get(`${API}/projects/${id}`).then(r => r.data),
    refetchInterval: 3000,
  })

  const { data: renderStatus } = useQuery({
    queryKey: ['render-status', id],
    queryFn: () => axios.get(`${API}/agents/${id}/render-status`).then(r => r.data),
    enabled: !!id,
  })

  const { data: script, refetch: refetchScript } = useQuery({
    queryKey: ['script', id],
    queryFn: () => axios.get(`${API}/agents/${id}/script`).then(r => r.data),
    enabled: scriptOpen,
  })

  const { data: metaData, refetch: refetchMeta } = useQuery({
    queryKey: ['metadatos', id],
    queryFn: () => axios.get(`${API}/agents/${id}/metadatos`).then(r => r.data),
    enabled: metaOpen,
  })

  const { data: miniatura } = useQuery({
    queryKey: ['miniatura', id],
    queryFn: () => axios.get(`${API}/agents/${id}/miniatura`).then(r => r.data),
    enabled: !!id,
    refetchInterval: 10000,
  })

  // SSE: progreso en vivo
  useEffect(() => {
    if (!id) return

    const es = new EventSource(`${API}/agents/${id}/progress`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const data: ProgressEntry = JSON.parse(e.data)
        setProgressLog(prev => {
          const isDupe = prev.length > 0 && prev[prev.length - 1].step === data.step
          return isDupe ? prev : [...prev, data]
        })
        if (data.step === 'render_done') setRenderDone(true)
        if (data.step === 'render_error') setRenderError(data.message)
        if (data.done) {
          qc.invalidateQueries({ queryKey: ['project', id] })
          qc.invalidateQueries({ queryKey: ['render-status', id] })
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      // SSE reconnects automatically; don't close unless intentional
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [id, qc])

  // Auto-scroll del log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [progressLog])

  const saveYtId = useMutation({
    mutationFn: (youtube_video_id: string) =>
      axios.patch(`${API}/projects/${id}/youtube-id`, { youtube_video_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      setYtIdSaved(true)
      setTimeout(() => setYtIdSaved(false), 2000)
    },
  })

  const runGuion    = useMutation({ mutationFn: (force = false) => axios.post(`${API}/agents/${id}/guion?force=${force}`),    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }) })
  const runAudio    = useMutation({ mutationFn: (force = false) => axios.post(`${API}/agents/${id}/audio?force=${force}`),    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }) })
  const runSync     = useMutation({ mutationFn: () => axios.post(`${API}/agents/${id}/sync`),                                  onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }) })
  const runPexels   = useMutation({ mutationFn: (force = false) => axios.post(`${API}/agents/${id}/pexels?force=${force}`),   onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }) })
  const runMeta     = useMutation({ mutationFn: (force = false) => axios.post(`${API}/agents/${id}/metadatos?force=${force}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); refetchMeta() } })
  const saveNarration = useMutation({
    mutationFn: (narration: string) => axios.put(`${API}/agents/${id}/script`, { narration }),
    onSuccess: () => { setSavedNarration(true); setTimeout(() => setSavedNarration(false), 2000); refetchScript() },
  })

  const exportRemotion = useMutation({
    mutationFn: () => axios.post(`${API}/agents/${id}/export-remotion`).then(r => r.data),
    onSuccess: (data) => window.open(data.url ?? 'http://localhost:3001', '_blank'),
  })

  const renderRemotion = useMutation({
    mutationFn: () => axios.post(`${API}/agents/${id}/render-remotion`),
    onSuccess: () => {
      setRenderDone(false)
      setRenderError(null)
      setProgressLog(prev => [...prev, { step: 'render', message: 'Render started...', done: false }])
    },
  })

  useEffect(() => {
    if (project?.youtube_video_id) setYtId(project.youtube_video_id)
  }, [project?.youtube_video_id])

  if (isLoading || !project) return (
    <div className={styles.loading}><Loader size={28} className={styles.spin} /></div>
  )

  const stepIndex = statusStep(project.status)
  const st = project.status

  const isRunningGuion  = st === 'guion'
  const isRunningAudio  = st === 'audio'
  const isRunningSync   = st === 'sync'
  const isRunningPexels = st === 'pexels'
  const isRunningMeta   = st === 'metadata'
  const isRendering     = renderRemotion.isPending || (progressLog.some(e => e.step === 'render') && !renderDone && !renderError)

  const isDone      = st === 'done'
  const hasScript   = stepIndex >= statusStep('guion_done')
  const hasAudio    = stepIndex >= statusStep('audio_done')
  const hasSync     = stepIndex >= statusStep('sync_done')
  const hasPexels   = stepIndex >= statusStep('pexels_done')
  const hasMeta     = isDone

  const audioUnlocked  = stepIndex >= statusStep('guion_done')
  const syncUnlocked   = stepIndex >= statusStep('audio_done')
  const pexelsUnlocked = stepIndex >= statusStep('sync_done')
  const metaUnlocked   = stepIndex >= statusStep('pexels_done')

  const isAnyRunning = isRunningGuion || isRunningAudio || isRunningSync || isRunningPexels || isRunningMeta
  const showLog = progressLog.length > 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{project.title}</h1>
          <p className={styles.topic}>{project.topic}</p>
        </div>
        <div className={styles.actions}>
          {project.mood && <span className={styles.moodBadge}>{project.mood}</span>}
          {isDone && <span className={styles.doneBadge}>Completed</span>}
          {hasSync && (
            <>
              <button
                className={styles.remotionBtn}
                onClick={() => exportRemotion.mutate()}
                disabled={exportRemotion.isPending}
                title="Copy files to Remotion and open preview"
              >
                {exportRemotion.isPending
                  ? <Loader size={14} className={styles.spin} />
                  : <MonitorPlay size={14} />}
                {exportRemotion.isPending ? 'Exporting...' : 'Preview in Remotion'}
              </button>
              <button
                className={styles.renderBtn}
                onClick={() => renderRemotion.mutate()}
                disabled={isRendering}
                title="Render final MP4 video"
              >
                {isRendering
                  ? <Loader size={14} className={styles.spin} />
                  : <Film size={14} />}
                {isRendering ? 'Rendering...' : renderStatus?.rendered ? 'Re-render' : 'Render video'}
              </button>
            </>
          )}
          {renderStatus?.rendered && !isRendering && (
            <span className={styles.renderDone}>Video ready ({renderStatus.size_mb} MB)</span>
          )}
        </div>
      </header>

      {/* Pipeline */}
      <div className={styles.pipeline}>
        {STEPS.map((step, i) => (
          <div key={step} className={styles.stepWrap}>
            <div className={`${styles.step} ${i < stepIndex ? styles.done : ''} ${i === stepIndex ? styles.active : ''}`}>
              <div className={styles.dot} />
              <span className={styles.stepLabel}>{STEP_LABELS[i]}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`${styles.line} ${i < stepIndex ? styles.lineDone : ''}`} />}
          </div>
        ))}
      </div>

      {/* Log de progreso en vivo */}
      {showLog && (
        <div className={styles.agentCard}>
          <div className={styles.agentHeader}>
            <div className={styles.agentTitle}>
              <span className={styles.agentDot} style={{ background: isAnyRunning || isRendering ? '#00d4ff' : '#22c55e' }} />
              Live progress
            </div>
            <button className={styles.viewBtn} onClick={() => setProgressLog([])}>Clear</button>
          </div>
          <div className={styles.progressLog} ref={logRef}>
            {progressLog.map((entry, i) => (
              <div
                key={i}
                className={`${styles.progressEntry} ${entry.done ? '' : i === progressLog.length - 1 ? styles.active : ''} ${entry.error ? styles.error : ''}`}
              >
                <span className={styles.progressDot} />
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GuionAgent */}
      <div className={styles.agentCard}>
        <div className={styles.agentHeader}>
          <div className={styles.agentTitle}><span className={styles.agentDot} style={{ background: '#8b5cf6' }} />GuionAgent</div>
          <div className={styles.agentControls}>
            {hasScript && (
              <button className={styles.viewBtn} onClick={() => { setScriptOpen(v => !v); setEditingNarration(null) }}>
                <FileText size={13} />{scriptOpen ? 'Hide' : 'View script'}
                {scriptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
            {(st === 'pending' || st === 'guion_done') && (
              <button className={styles.runBtn} onClick={() => runGuion.mutate(st === 'guion_done')} disabled={runGuion.isPending || isRunningGuion}>
                {(runGuion.isPending || isRunningGuion) ? <Loader size={13} className={styles.spin} /> : <Play size={13} />}
                {isRunningGuion ? 'Generating...' : st === 'guion_done' ? 'Regenerate (uses credits)' : 'Generate script'}
              </button>
            )}
            {isRunningGuion && <span className={styles.runningLabel}><Loader size={12} className={styles.spin} /> Claude is writing...</span>}
          </div>
        </div>
        {scriptOpen && script && (
          <div className={styles.scriptPanel}>
            <div className={styles.scriptSection}>
              <div className={styles.scriptSectionHeader}>
                <span>Narration</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {savedNarration && <span className={styles.savedLabel}>Saved</span>}
                  {editingNarration !== null && (
                    <button className={styles.saveBtn} onClick={() => saveNarration.mutate(editingNarration)} disabled={saveNarration.isPending}>
                      <Save size={12} />Save
                    </button>
                  )}
                  <button className={styles.editToggle} onClick={() => setEditingNarration(editingNarration === null ? (script.narration ?? '') : null)}>
                    {editingNarration !== null ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>
              {editingNarration !== null
                ? <textarea className={styles.narrationEditor} value={editingNarration} onChange={e => setEditingNarration(e.target.value)} rows={20} />
                : <pre className={styles.scriptText}>{script.narration || '—'}</pre>}
            </div>
            <details className={styles.fullScriptDetails}>
              <summary className={styles.fullScriptSummary}>View full script with structure</summary>
              <pre className={styles.scriptText}>{script.full_script || '—'}</pre>
            </details>
          </div>
        )}
      </div>

      {/* AudioAgent */}
      <div className={`${styles.agentCard} ${!audioUnlocked ? styles.agentLocked : ''}`}>
        <div className={styles.agentHeader}>
          <div className={styles.agentTitle}><span className={styles.agentDot} style={{ background: '#00d4ff' }} />AudioAgent</div>
          <div className={styles.agentControls}>
            {audioUnlocked && !isRunningAudio && (
              <button className={styles.runBtn} onClick={() => runAudio.mutate(hasAudio)} disabled={runAudio.isPending}>
                {runAudio.isPending ? <Loader size={13} className={styles.spin} /> : <Play size={13} />}
                {hasAudio ? 'Regenerate (uses credits)' : 'Generate audio'}
              </button>
            )}
            {isRunningAudio && <span className={styles.runningLabel}><Loader size={12} className={styles.spin} /> Fish Audio generating voice...</span>}
            {!audioUnlocked && <span className={styles.lockedLabel}>Available after generating the script</span>}
          </div>
        </div>
        {hasAudio && (
          <div className={styles.audioPanel}>
            <audio controls className={styles.audioPlayer} src={`${API}/agents/${id}/audio/file`} />
            <span className={styles.audioHint}>Listen before continuing. Edit the narration above if you need changes.</span>
          </div>
        )}
      </div>

      {/* SincAgent */}
      <div className={`${styles.agentCard} ${!syncUnlocked ? styles.agentLocked : ''}`}>
        <div className={styles.agentHeader}>
          <div className={styles.agentTitle}><span className={styles.agentDot} style={{ background: '#8b5cf6' }} />SincronizacionAgent</div>
          <div className={styles.agentControls}>
            {syncUnlocked && !isRunningSync && (
              <button className={styles.runBtn} onClick={() => runSync.mutate()} disabled={runSync.isPending}>
                {runSync.isPending ? <Loader size={13} className={styles.spin} /> : <Play size={13} />}
                {hasSync ? 'Re-sync' : 'Sync timestamps'}
              </button>
            )}
            {isRunningSync && <span className={styles.runningLabel}><Loader size={12} className={styles.spin} /> Processing Whisper...</span>}
            {!syncUnlocked && <span className={styles.lockedLabel}>Available after generating audio</span>}
            {hasSync && !isRunningSync && <span className={styles.doneLabel}>sequences.ts and paragraphSlides.json ready</span>}
          </div>
        </div>
      </div>

      {/* PexelsAgent */}
      <div className={`${styles.agentCard} ${!pexelsUnlocked ? styles.agentLocked : ''}`}>
        <div className={styles.agentHeader}>
          <div className={styles.agentTitle}>
            <span className={styles.agentDot} style={{ background: '#ef4444' }} />
            PexelsAgent
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>stock footage</span>
          </div>
          <div className={styles.agentControls}>
            {pexelsUnlocked && !isRunningPexels && (
              <button className={styles.runBtn} onClick={() => runPexels.mutate(hasPexels)} disabled={runPexels.isPending}>
                {runPexels.isPending ? <Loader size={13} className={styles.spin} /> : <Images size={13} />}
                {hasPexels ? 'Re-download footage' : 'Download footage'}
              </button>
            )}
            {isRunningPexels && <span className={styles.runningLabel}><Loader size={12} className={styles.spin} /> Searching and downloading from Pexels...</span>}
            {!pexelsUnlocked && <span className={styles.lockedLabel}>Available after syncing timestamps</span>}
            {hasPexels && !isRunningPexels && <span className={styles.doneLabel}>Footage downloaded — check pexels/ folder</span>}
          </div>
        </div>
      </div>

      {/* MetadatosAgent */}
      <div className={`${styles.agentCard} ${!metaUnlocked ? styles.agentLocked : ''}`}>
        <div className={styles.agentHeader}>
          <div className={styles.agentTitle}><span className={styles.agentDot} style={{ background: '#00d4ff' }} />MetadatosAgent</div>
          <div className={styles.agentControls}>
            {metaUnlocked && !isRunningMeta && (
              <>
                {hasMeta && (
                  <button className={styles.viewBtn} onClick={() => setMetaOpen(v => !v)}>
                    <FileText size={13} />{metaOpen ? 'Hide' : 'View metadata'}
                    {metaOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
                <button className={styles.runBtn} onClick={() => runMeta.mutate(hasMeta)} disabled={runMeta.isPending}>
                  {runMeta.isPending ? <Loader size={13} className={styles.spin} /> : <Play size={13} />}
                  {hasMeta ? 'Regenerate (uses credits)' : 'Generate metadata'}
                </button>
              </>
            )}
            {isRunningMeta && <span className={styles.runningLabel}><Loader size={12} className={styles.spin} /> Claude generating metadata...</span>}
            {!metaUnlocked && <span className={styles.lockedLabel}>Available after syncing</span>}
          </div>
        </div>
        {miniatura?.url && (
          <div className={styles.miniaturaPreview}>
            <img
              src={`${API}${miniatura.url}`}
              alt="Thumbnail"
              className={styles.miniaturaImg}
            />
          </div>
        )}
        {metaOpen && metaData?.metadatos && (
          <div className={styles.scriptPanel}>
            <div className={styles.scriptSection}>
              <div className={styles.scriptSectionHeader}>
                <span>YouTube metadata</span>
                <CopyButton text={metaData.metadatos} />
              </div>
              <pre className={styles.scriptText}>{metaData.metadatos}</pre>
            </div>
            {metaData?.prompt_miniatura && (
              <div className={styles.scriptSection}>
                <div className={styles.scriptSectionHeader}>
                  <span>Thumbnail prompt</span>
                  <CopyButton text={metaData.prompt_miniatura} />
                </div>
                <pre className={styles.scriptText}>{metaData.prompt_miniatura}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Folder</span>
          <span className={styles.metaVal} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{project.folder ?? '—'}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Created</span>
          <span className={styles.metaVal}>{new Date(project.created_at).toLocaleString('en-US')}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}><Link size={12} style={{ marginRight: 4 }} />YouTube ID</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text)', width: 140 }}
              placeholder="e.g. dQw4w9WgXcQ"
              value={ytId}
              onChange={e => { setYtId(e.target.value); setYtIdSaved(false) }}
              onBlur={() => { if (ytId !== (project.youtube_video_id ?? '')) saveYtId.mutate(ytId) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
            {saveYtId.isPending && <Loader size={11} className={styles.spin} />}
            {ytIdSaved && <Check size={12} style={{ color: 'var(--accent)' }} />}
            {project.youtube_video_id && (
              <a href={`https://youtube.com/watch?v=${project.youtube_video_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 11 }}>
                View video
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

