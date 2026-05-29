import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { RefreshCw, Loader, CheckCircle, Link2, Link2Off, AlertTriangle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import NeuralNetwork from '../components/NeuralNetwork'
import styles from './Index.module.css'

const API = 'http://localhost:8000'

const DEFAULT_STATS = {
  total_projects: 0, completed_videos: 0,
  subscribers: 0, total_views: 0, avg_ctr: 0, avg_retention: 0, total_impressions: 0,
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

export default function Index() {
  const qc = useQueryClient()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const { data: stats = DEFAULT_STATS } = useQuery({
    queryKey: ['summary'],
    queryFn: () => axios.get(`${API}/analytics/summary`).then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: graphData } = useQuery({
    queryKey: ['neural-graph'],
    queryFn: () => axios.get(`${API}/projects/neural-graph`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: lastSync } = useQuery({
    queryKey: ['last-sync'],
    queryFn: () => axios.get(`${API}/analytics/last-sync`).then(r => r.data),
  })

  const { data: oauthStatus } = useQuery({
    queryKey: ['oauth-status'],
    queryFn: () => axios.get(`${API}/analytics/oauth/status`).then(r => r.data),
    refetchInterval: 5000,
  })

  const connectAnalytics = async () => {
    const res = await axios.get(`${API}/analytics/oauth/start`)
    window.open(res.data.url, '_blank', 'width=500,height=650')
  }

  const sync = useMutation({
    mutationFn: () => axios.post(`${API}/analytics/sync`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['last-sync'] })
      qc.invalidateQueries({ queryKey: ['suggestions'] })
      setSyncMsg(`${res.data.videos_synced} videos sincronizados`)
      setTimeout(() => setSyncMsg(null), 4000)
    },
  })

  const formatSync = (iso: string | null) => {
    if (!iso) return 'Nunca sincronizado'
    const d = new Date(iso)
    return `Última sync: ${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  }

  const { data: alertsData } = useQuery({
    queryKey: ['performance-alerts'],
    queryFn: () => axios.get(`${API}/agents/performance-alerts`).then(r => r.data),
    refetchInterval: 30000,
  })

  const improve = useMutation({
    mutationFn: (projectId: number) => axios.post(`${API}/agents/${projectId}/improve`).then(r => r.data),
  })

  const alerts = alertsData?.alerts ?? []

  const ctrHealthColor = (ctr: number) => {
    if (ctr <= 0) return 'var(--purple)'
    if (ctr < 1.5) return 'var(--danger)'
    if (ctr < 3.0) return '#f0a500'
    return '#22c55e'
  }

  const statCards = [
    { label: 'Proyectos', value: stats.total_projects, color: 'var(--purple)', benchmark: null },
    { label: 'Videos publicados', value: stats.completed_videos, color: 'var(--accent)', benchmark: null },
    { label: 'Suscriptores', value: stats.subscribers.toLocaleString(), color: 'var(--purple)', benchmark: null },
    { label: 'Vistas totales', value: stats.total_views.toLocaleString(), color: 'var(--accent)', benchmark: null },
    {
      label: 'CTR promedio',
      value: `${stats.avg_ctr.toFixed(2)}%`,
      color: ctrHealthColor(stats.avg_ctr),
      benchmark: 'meta: 4%',
    },
    {
      label: 'Retención prom.',
      value: stats.avg_retention > 0 ? `${Math.round(stats.avg_retention)}s` : '—',
      color: 'var(--accent)',
      benchmark: 'meta: 40%',
    },
    { label: 'Impresiones totales', value: stats.total_impressions > 0 ? fmtNum(stats.total_impressions) : '—', color: 'var(--purple)', benchmark: null },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Neural Studio</h1>
          <p className={styles.subtitle}>Sistema de producción autónoma — canal aprendiendo en tiempo real</p>
        </div>
        <div className={styles.syncArea}>
          {syncMsg && (
            <span className={styles.syncOk}>
              <CheckCircle size={13} /> {syncMsg}
            </span>
          )}
          <span className={styles.lastSync}>
            {formatSync(lastSync?.last_sync ?? null)}
          </span>
          <button
            className={`${styles.oauthBtn} ${oauthStatus?.connected ? styles.oauthConnected : ''}`}
            onClick={connectAnalytics}
            title={oauthStatus?.connected ? 'Analytics conectado — CTR disponible' : 'Conectar para ver CTR real'}
          >
            {oauthStatus?.connected
              ? <><Link2 size={14} /> CTR conectado</>
              : <><Link2Off size={14} /> Conectar CTR</>}
          </button>
          <button
            className={styles.syncBtn}
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending
              ? <Loader size={14} className={styles.spin} />
              : <RefreshCw size={14} />}
            {sync.isPending ? 'Sincronizando...' : 'Sincronizar canal'}
          </button>
        </div>
      </header>

      <div className={styles.canvas}>
        <NeuralNetwork
          nodes={graphData?.nodes ?? []}
          edges={graphData?.edges ?? []}
        />
      </div>

      <div className={styles.grid}>
        {statCards.map(card => (
          <div key={card.label} className={styles.card}>
            <span className={styles.cardValue} style={{ color: card.color }}>{card.value}</span>
            <span className={styles.cardLabel}>{card.label}</span>
            {card.benchmark && (
              <span className={styles.cardBenchmark}>{card.benchmark}</span>
            )}
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <AlertTriangle size={15} color="var(--danger)" />
            <span>Videos con bajo rendimiento (+2 días)</span>
          </div>
          {alerts.map((alert: any) => (
            <div key={alert.project_id} className={styles.alertCard}>
              <div className={styles.alertTop}>
                <span className={styles.alertTitle}>{alert.title}</span>
                <div className={styles.alertBadges}>
                  <span className={styles.badgeDanger}>CTR {alert.ctr}% (ref. {alert.ref_ctr}%)</span>
                  <span className={styles.badgeDanger}>Ret. {alert.retention}% (ref. {alert.ref_retention}%)</span>
                </div>
              </div>
              <div className={styles.alertIssues}>
                {alert.issues.map((issue: string) => <span key={issue}>• {issue}</span>)}
              </div>
              {improve.data && improve.variables === alert.project_id ? (
                <div className={styles.improveSuggestions}>
                  {improve.data.titulos_alternativos && (
                    <div>
                      <strong>Títulos alternativos:</strong>
                      <ul>{improve.data.titulos_alternativos.map((t: string) => <li key={t}>{t}</li>)}</ul>
                    </div>
                  )}
                  {improve.data.razon && <p className={styles.improveRazon}>{improve.data.razon}</p>}
                </div>
              ) : (
                <button
                  className={styles.improveBtn}
                  onClick={() => improve.mutate(alert.project_id)}
                  disabled={improve.isPending}
                >
                  {improve.isPending && improve.variables === alert.project_id
                    ? <Loader size={12} className={styles.spin} />
                    : <Sparkles size={12} />}
                  Generar sugerencias de mejora
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
