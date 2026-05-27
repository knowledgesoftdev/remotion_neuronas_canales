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
        <h1 className={styles.title}>New project</h1>
        <p className={styles.subtitle}>
          Pick one of the saved ideas or write your own topic
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <Sparkles size={15} color="var(--accent)" />
            Ideas for your channel
          </span>
          {!loadingSugg && (
            <span className={styles.remainingBadge}>
              {remaining} {remaining === 1 ? 'idea available' : 'ideas available'}
              {remaining === 0 && ' — 5 new ones will be generated on load'}
            </span>
          )}
        </div>

        {loadingSugg ? (
          <div className={styles.suggLoading}>
            <Loader size={20} className={styles.spin} />
            <span>
              {suggestions.length === 0
                ? 'Asking Claude to generate 5 new ideas...'
                : 'Loading ideas...'}
            </span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className={styles.suggEmpty}>
            No channel data yet. Connect YouTube Analytics to receive personalized ideas.
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
          <span className={styles.sectionTitle}>Project details</span>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Video title
              <span className={`${styles.charCount} ${title.length > 60 ? styles.over : ''}`}>
                {title.length}/60
              </span>
            </label>
            <input
              className={styles.input}
              type="text"
              placeholder="E.g.: The Code That Destroyed MySpace"
              value={title}
              onChange={e => { setTitle(e.target.value); setSelectedId(null) }}
              maxLength={80}
            />
            {title.length > 60 && (
              <span className={styles.warning}>
                YouTube truncates titles over 60 characters on mobile
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Topic / video angle</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe the core topic: what story you want to tell, what technical decisions or events to cover, the narrative angle..."
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
              <><Loader size={16} className={styles.spin} /> Creating project...</>
            ) : (
              <>Create project <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </section>
    </div>
  )
}

