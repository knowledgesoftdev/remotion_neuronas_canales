import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Plus, Clock, CheckCircle, Loader } from 'lucide-react'
import styles from './Projects.module.css'

const API = 'http://localhost:8000'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  guion: 'Guion',
  audio: 'Audio',
  sync: 'Sincronización',
  visual: 'Visual',
  metadata: 'Metadata',
  done: 'Completado',
}

const STATUS_ICON: Record<string, JSX.Element> = {
  done: <CheckCircle size={14} color="var(--accent)" />,
  pending: <Clock size={14} color="var(--muted)" />,
}

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => axios.get(`${API}/projects/`).then(r => r.data),
    refetchInterval: 5000,
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Proyectos</h1>
          <p className={styles.subtitle}>{projects.length} video{projects.length !== 1 ? 's' : ''} en el sistema</p>
        </div>
        <Link to="/projects/new" className={styles.newBtn}>
          <Plus size={16} />
          Nuevo proyecto
        </Link>
      </header>

      {isLoading ? (
        <div className={styles.loading}><Loader size={24} className={styles.spin} /></div>
      ) : projects.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay proyectos aún.</p>
          <p>Crea uno nuevo para que el pipeline empiece a trabajar.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {projects.map((p: any) => (
            <Link to={`/projects/${p.id}`} key={p.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{p.title}</span>
                <span className={styles.rowTopic}>{p.topic}</span>
              </div>
              <div className={styles.rowMeta}>
                <span className={styles.status}>
                  {STATUS_ICON[p.status] ?? <Loader size={14} color="var(--purple)" className={styles.spin} />}
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                <span className={styles.date}>
                  {new Date(p.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
