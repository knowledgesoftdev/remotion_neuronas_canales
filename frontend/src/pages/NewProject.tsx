import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Sparkles, Loader, ChevronRight } from 'lucide-react'
import styles from './NewProject.module.css'

const API = 'http://localhost:8000'

interface Suggestion {
  id: number
  title: string
  topic: string
  reason: string
}

export default function NewProject() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: suggData, isLoading: loadingSugg } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => axios.get(`${API}/agents/suggest-titles`).then(r => r.data),
    staleTime: Infinity,  // never re-fetch automatically
  })

  const suggestions: Suggestion[] = suggData?.suggestions ?? []
  const remaining = suggestions.length

  const markUsed = (id: number) =>
    axios.post(`${API}/agents/suggestions/${id}/use`)

  const create = useMutation({
    mutationFn: () =>
      axios.post(`${API}/projects/`, { title, topic, status: 'pending' }),
    onSuccess: async (res) => {
      if (selectedId !== null) {
        await markUsed(selectedId)
        qc.invalidateQueries({ queryKey: ['suggestions'] })
      }
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${res.data.id}`)
    },
  })

  const pickSuggestion = (s: Suggestion) => {
    setSelectedId(s.id)
    setTitle(s.title)
    setTopic(s.topic)
  }

  const canSubmit = title.trim().length > 0 && topic.trim().length > 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nuevo proyecto</h1>
        <p className={styles.subtitle}>
          Elige una de las ideas guardadas o escribe tu propio tema
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <Sparkles size={15} color="var(--accent)" />
            Ideas para tu canal
          </span>
          {!loadingSugg && (
            <span className={styles.remainingBadge}>
              {remaining} {remaining === 1 ? 'idea disponible' : 'ideas disponibles'}
              {remaining === 0 && ' — se generarán 5 nuevas al cargar'}
            </span>
          )}
        </div>

        {loadingSugg ? (
          <div className={styles.suggLoading}>
            <Loader size={20} className={styles.spin} />
            <span>
              {suggestions.length === 0
                ? 'Consultando a Claude para generar 5 ideas nuevas...'
                : 'Cargando ideas...'}
            </span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className={styles.suggEmpty}>
            No hay datos del canal todavía. Conecta YouTube Analytics para recibir ideas personalizadas.
          </div>
        ) : (
          <div className={styles.suggGrid}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                className={`${styles.suggCard} ${selectedId === s.id ? styles.suggSelected : ''}`}
                onClick={() => pickSuggestion(s)}
              >
                <span className={styles.suggTitle}>{s.title}</span>
                <span className={styles.suggTopic}>{s.topic}</span>
                <span className={styles.suggReason}>{s.reason}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Detalles del proyecto</span>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Título del video
              <span className={`${styles.charCount} ${title.length > 60 ? styles.over : ''}`}>
                {title.length}/60
              </span>
            </label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ej: El Código que Destruyó MySpace"
              value={title}
              onChange={e => { setTitle(e.target.value); setSelectedId(null) }}
              maxLength={80}
            />
            {title.length > 60 && (
              <span className={styles.warning}>
                YouTube trunca títulos mayores a 60 caracteres en móvil
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tema / ángulo del video</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe el tema central: qué historia quieres contar, qué decisiones técnicas o eventos cubrir, el enfoque narrativo..."
              value={topic}
              onChange={e => { setTopic(e.target.value); setSelectedId(null) }}
              rows={4}
            />
          </div>

          <button
            className={styles.submitBtn}
            onClick={() => create.mutate()}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending ? (
              <><Loader size={16} className={styles.spin} /> Creando proyecto...</>
            ) : (
              <>Crear proyecto <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </section>
    </div>
  )
}
