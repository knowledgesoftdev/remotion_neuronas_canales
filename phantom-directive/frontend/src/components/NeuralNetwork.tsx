import { useEffect, useRef } from 'react'

export interface GraphNode {
  id: number
  title: string
  status: string
  views: number
}
export interface GraphEdge {
  from: number
  to: number
  strength: number
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const STATUS_COLORS: Record<string, string> = {
  pending:  '#475569',
  guion:    '#a855f7',
  audio:    '#8b5cf6',
  sync:     '#7c3aed',
  visual:   '#6d28d9',
  metadata: '#5b21b6',
  done:     '#00d4ff',
}

interface SimNode {
  id: number
  x: number; y: number
  vx: number; vy: number
  targetR: number; r: number
  energy: number
  color: string
  label: string
}

interface SimEdge {
  fromId: number; toId: number
  strength: number
  pulse: number; speed: number
}

interface SimState { nodes: SimNode[]; edges: SimEdge[] }

function targetRadius(views: number): number {
  return 7 + Math.min(views / 5000, 1) * 13
}

export default function NeuralNetwork({ nodes, edges }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<SimState>({ nodes: [], edges: [] })
  const rafRef = useRef<number>(0)

  // Animation loop — starts once on mount, reads from simRef
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { nodes: sn, edges: se } = simRef.current
      const W = canvas.offsetWidth, H = canvas.offsetHeight
      ctx.clearRect(0, 0, W, H)

      if (sn.length === 0) {
        ctx.font = '13px Inter, system-ui, sans-serif'
        ctx.fillStyle = '#475569'
        ctx.textAlign = 'center'
        ctx.fillText('Create your first project to feed the neural network', W / 2, H / 2)
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const cx = W / 2, cy = H / 2

      sn.forEach(n => {
        // Spring toward center (orbit radius grows with node count)
        const dx = n.x - cx, dy = n.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const orbit = Math.min(W, H) * (0.15 + sn.length * 0.018)
        const springF = (dist - Math.min(orbit, Math.min(W, H) * 0.42)) * 0.0012
        n.vx -= (dx / dist) * springF
        n.vy -= (dy / dist) * springF

        // Repulsion between nodes
        sn.forEach(m => {
          if (m === n) return
          const rx = n.x - m.x, ry = n.y - m.y
          const rd = Math.sqrt(rx * rx + ry * ry) || 1
          if (rd < 120) {
            const rep = 700 / (rd * rd)
            n.vx += (rx / rd) * rep * 0.01
            n.vy += (ry / rd) * rep * 0.01
          }
        })

        // Edge attraction toward connected nodes
        se.forEach(e => {
          const otherId = e.fromId === n.id ? e.toId : e.toId === n.id ? e.fromId : null
          if (otherId === null) return
          const other = sn.find(m => m.id === otherId)
          if (!other) return
          const ex = other.x - n.x, ey = other.y - n.y
          const ed = Math.sqrt(ex * ex + ey * ey) || 1
          const f = (ed - 130) * 0.00015 * e.strength
          n.vx += (ex / ed) * f
          n.vy += (ey / ed) * f
        })

        n.vx *= 0.90; n.vy *= 0.90
        n.x = Math.max(50, Math.min(W - 50, n.x + n.vx))
        n.y = Math.max(50, Math.min(H - 50, n.y + n.vy))
        n.r += (n.targetR - n.r) * 0.06
        n.energy = (n.energy + 0.004) % 1
      })

      // Draw edges
      se.forEach(e => {
        const a = sn.find(n => n.id === e.fromId)
        const b = sn.find(n => n.id === e.toId)
        if (!a || !b) return

        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        const alpha = Math.min(0.05 + e.strength * 0.06, 0.35)
        grad.addColorStop(0, `rgba(139,92,246,${alpha})`)
        grad.addColorStop(1, `rgba(0,212,255,${alpha})`)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.5 + e.strength * 0.3
        ctx.stroke()

        // Traveling pulse
        e.pulse = (e.pulse + e.speed) % 1
        const px = a.x + (b.x - a.x) * e.pulse
        const py = a.y + (b.y - a.y) * e.pulse
        const pg = ctx.createRadialGradient(px, py, 0, px, py, 5)
        pg.addColorStop(0, 'rgba(0,212,255,0.85)')
        pg.addColorStop(1, 'rgba(0,212,255,0)')
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = pg
        ctx.fill()
      })

      // Draw nodes
      sn.forEach(n => {
        if (n.r < 0.5) return

        const glowR = n.r + 20
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR)
        g.addColorStop(0, n.color + '44')
        g.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.shadowBlur = 8 + Math.sin(n.energy * Math.PI * 2) * 5
        ctx.shadowColor = n.color
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.font = '10px Inter, system-ui, sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'center'
        ctx.fillText(n.label, n.x, n.y + n.r + 14)
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Sync props into sim state without interrupting the animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    const sim = simRef.current
    const cx = (canvas?.offsetWidth ?? 500) / 2
    const cy = (canvas?.offsetHeight ?? 300) / 2

    const existingMap = new Map(sim.nodes.map(n => [n.id, n]))

    sim.nodes = nodes.map(n => {
      const existing = existingMap.get(n.id)
      const tr = targetRadius(n.views)
      const color = STATUS_COLORS[n.status] ?? '#8b5cf6'
      const label = n.title.length > 18 ? n.title.slice(0, 16) + '…' : n.title

      if (existing) {
        existing.targetR = tr
        existing.color = color
        existing.label = label
        return existing
      }

      return {
        id: n.id,
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        targetR: tr, r: 0,
        energy: Math.random(),
        color, label,
      }
    })

    sim.edges = edges.map(e => {
      const existing = sim.edges.find(se => se.fromId === e.from && se.toId === e.to)
      return existing ?? {
        fromId: e.from, toId: e.to,
        strength: e.strength,
        pulse: Math.random(),
        speed: 0.003 + Math.random() * 0.003,
      }
    })
  }, [nodes, edges])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
