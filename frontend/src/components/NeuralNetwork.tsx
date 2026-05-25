import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  energy: number       // 0–1, cuánto brilla el nodo
  label?: string
  color: string
}

interface Edge {
  from: number
  to: number
  pulse: number        // 0–1, posición del pulso viajando por la arista
  active: boolean
  speed: number
}

const LABELS = [
  'GuionAgent', 'AudioAgent', 'SincAgent', 'VisualAgent',
  'MetadatosAgent', 'MiniaturasAgent', 'AnaliticasAgent',
]

const NODE_COLORS = [
  '#8b5cf6', '#00d4ff', '#8b5cf6', '#00d4ff',
  '#8b5cf6', '#00d4ff', '#cc2222',
]

function buildGraph(w: number, h: number): { nodes: Node[]; edges: Edge[] } {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.3

  const nodes: Node[] = LABELS.map((label, i) => {
    const angle = (i / LABELS.length) * Math.PI * 2 - Math.PI / 2
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: 8,
      energy: Math.random(),
      label,
      color: NODE_COLORS[i],
    }
  })

  // Conexiones del pipeline: cada agente conecta al siguiente
  const edges: Edge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: i, to: i + 1, pulse: Math.random(), active: true, speed: 0.003 + Math.random() * 0.003 })
  }
  // Conexión AnaliticasAgent → GuionAgent (feedback loop)
  edges.push({ from: 6, to: 0, pulse: Math.random(), active: true, speed: 0.004 })
  // Conexiones extra para densidad visual
  edges.push({ from: 6, to: 1, pulse: Math.random(), active: true, speed: 0.002 })
  edges.push({ from: 6, to: 4, pulse: Math.random(), active: true, speed: 0.002 })
  edges.push({ from: 0, to: 3, pulse: Math.random(), active: false, speed: 0.001 })

  return { nodes, edges }
}

interface Props {
  stats: {
    total_projects: number
    completed_videos: number
    subscribers: number
    total_views: number
  }
}

export default function NeuralNetwork({ stats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      stateRef.current = buildGraph(canvas.offsetWidth, canvas.offsetHeight)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const state = stateRef.current
      if (!state) return
      const { nodes, edges } = state
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight

      ctx.clearRect(0, 0, w, h)

      // Drift suave de nodos
      nodes.forEach(n => {
        n.x += n.vx
        n.y += n.vy
        const cx = w / 2, cy = h / 2
        const dx = n.x - cx, dy = n.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const target = Math.min(w, h) * 0.3
        const force = (dist - target) * 0.002
        n.vx -= (dx / dist) * force
        n.vy -= (dy / dist) * force
        n.vx *= 0.99
        n.vy *= 0.99
        n.energy = (n.energy + 0.003) % 1
      })

      // Aristas
      edges.forEach(e => {
        const a = nodes[e.from]
        const b = nodes[e.to]
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        grad.addColorStop(0, 'rgba(139,92,246,0.15)')
        grad.addColorStop(1, 'rgba(0,212,255,0.15)')

        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1
        ctx.stroke()

        // Pulso viajando por la arista
        if (e.active) {
          e.pulse = (e.pulse + e.speed) % 1
          const px = a.x + (b.x - a.x) * e.pulse
          const py = a.y + (b.y - a.y) * e.pulse
          const pulseGrad = ctx.createRadialGradient(px, py, 0, px, py, 6)
          pulseGrad.addColorStop(0, 'rgba(0,212,255,0.9)')
          pulseGrad.addColorStop(1, 'rgba(0,212,255,0)')
          ctx.beginPath()
          ctx.arc(px, py, 6, 0, Math.PI * 2)
          ctx.fillStyle = pulseGrad
          ctx.fill()
        }
      })

      // Nodos
      nodes.forEach(n => {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 28)
        const alpha = 0.1 + Math.sin(n.energy * Math.PI * 2) * 0.08
        glow.addColorStop(0, n.color + '33')
        glow.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(n.x, n.y, 28, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.shadowBlur = 12 + Math.sin(n.energy * Math.PI * 2) * 6
        ctx.shadowColor = n.color
        ctx.fill()
        ctx.shadowBlur = 0

        if (n.label) {
          ctx.font = '11px Inter, system-ui, sans-serif'
          ctx.fillStyle = '#94a3b8'
          ctx.textAlign = 'center'
          ctx.fillText(n.label, n.x, n.y + 24)
        }
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
