import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { RefreshCw, Loader, CheckCircle, Link2, Link2Off, AlertTriangle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import NeuralNetwork from '../components/NeuralNetwork'
import styles from './Index.module.css'

const API = 'http://localhost:8000'

const DEFAULT_STATS = {
  total_projects: 0, completed_videos: 0,
  subscribers: 0, total_views: 0, avg_ctr: 0, avg_retention: 0,
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
      setSyncMsg(`${res.data.videos_synced} videos synced`)
      setTimeout(() => setSyncMsg(null), 4000)
    },
  })

  const formatSync = (iso: string | null) => {
    if (!iso) return 'Never synced'
    const d = new Date(iso)
    return `Last sync: ${d.toLocaleDateString('en-US')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
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

  const statCards = [
    { label: 'Projects', value: stats.total_projects, color: 'var(--purple)' },
    { label: 'Published videos', value: stats.completed_videos, color: 'var(--accent)' },
    { label: 'Subscribers', value: stats.subscribers.toLocaleString(), color: 'var(--purple)' },
    { label: 'Total views', value: stats.total_views.toLocaleString(), color: 'var(--accent)' },
    { label: 'Avg CTR', value: `${stats.avg_ctr.toFixed(2)}%`, color: 'var(--purple)' },
    { label: 'Avg retention', value: `${Math.round(stats.avg_retention)}s`, color: 'var(--accent)' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Phantom Directive</h1>
          <p className={styles.subtitle}>Autonomous production system — channel learning in real time</p>
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
            title={oauthStatus?.connected ? 'Analytics connected — CTR available' : 'Connect to see real CTR'}
          >
            {oauthStatus?.connected
              ? <><Link2 size={14} /> CTR connected</>
              : <><Link2Off size={14} /> Connect CTR</>}
          </button>
          <button
            className={styles.syncBtn}
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending
              ? <Loader size={14} className={styles.spin} />
              : <RefreshCw size={14} />}
            {sync.isPending ? 'Syncing...' : 'Sync channel'}
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
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <AlertTriangle size={15} color="var(--danger)" />
            <span>Underperforming videos (+2 days)</span>
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
                      <strong>Alternative titles:</strong>
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
                  Generate improvement suggestions
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

