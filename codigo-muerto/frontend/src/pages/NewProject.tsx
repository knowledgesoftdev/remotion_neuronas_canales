import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Sparkles, Loader, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import styles from './NewProject.module.css'

interface ValidationRule {
  id: string
  label: string
  pass: boolean
  hint: string | null
}
interface ValidationResult {
  score: number
  max_score: number
  strong: boolean
  rules: ValidationRule[]
}

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
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)

  // Validate title whenever it changes (debounced 400ms)
  useEffect(() => {
    if (!title.trim()) { setValidation(null); return }
    const t = setTimeout(async () => {
      setValidating(true)
      try {
        const res = await axios.post(`${API}/analytics/validate-title`, { title, topic })
        setValidation(res.data)
      } catch { /* ignore */ }
      finally { setValidating(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [title, topic])

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
              <span className={`${styles.charCount} ${title.length > 55 ? styles.over : ''}`}>
                {title.length}/55
              </span>
            </label>
            <input
              className={`${styles.input} ${validation && !validation.strong ? styles.inputWarn : validation?.strong ? styles.inputOk : ''}`}
              type="text"
              placeholder='Ej: Nokia tenía el smartphone perfecto — y lo mató su propio código'
              value={title}
              onChange={e => { setTitle(e.target.value); setSelectedId(null) }}
              maxLength={80}
            />

            {/* Validation rules */}
            {title.trim().length > 0 && (
              <div className={styles.validationBox}>
                {validating && <span className={styles.validating}><Loader size={11} className={styles.spin} /> Validando...</span>}
                {validation && validation.rules.map(rule => (
                  <div key={rule.id} className={`${styles.rule} ${rule.pass ? styles.rulePass : styles.ruleFail}`}>
                    {rule.pass
                      ? <CheckCircle size={11} color="#22c55e" />
                      : rule.id === 'canal_b'
                      ? <AlertCircle size={11} color="#f0a500" />
                      : <XCircle size={11} color="#ef4444" />}
                    <span className={styles.ruleLabel}>{rule.label}</span>
                    {!rule.pass && rule.hint && (
                      <span className={styles.ruleHint}>{rule.hint}</span>
                    )}
                  </div>
                ))}
                {validation?.strong && (
                  <div className={styles.titleStrong}>
                    <CheckCircle size={12} color="#22c55e" /> Título óptimo para CTR
                  </div>
                )}
              </div>
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
