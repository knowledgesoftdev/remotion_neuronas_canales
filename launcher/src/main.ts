import './style.css'

interface ChannelDef {
  id: string
  name: string
  lang: string
  desc: string
  icon: string
  cssClass: string
  frontendUrl: string
  backendUrl: string
  ports: { label: string }[]
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'cm',
    name: 'Código Muerto',
    lang: 'Español',
    desc: 'Canal de tecnología en español. Pipeline: guion → audio → Remotion → video.',
    icon: '💀',
    cssClass: 'cm',
    frontendUrl: 'http://localhost:5173',
    backendUrl: 'http://localhost:8000',
    ports: [
      { label: ':5173 Frontend' },
      { label: ':8000 Backend' },
      { label: ':3000 Remotion' },
    ],
  },
  {
    id: 'pd',
    name: 'Phantom Directive',
    lang: 'English',
    desc: 'English tech channel. Independent pipeline with its own DB and environment.',
    icon: '👻',
    cssClass: 'pd',
    frontendUrl: 'http://localhost:5175',
    backendUrl: 'http://localhost:8001',
    ports: [
      { label: ':5175 Frontend' },
      { label: ':8001 Backend' },
      { label: ':3000 Remotion' },
    ],
  },
]

type CardState = 'idle' | 'launching' | 'active' | 'locked'

let activeChannel: string | null = null
const cardStates: Record<string, CardState> = { cm: 'idle', pd: 'idle' }

function applyStates(active: string | null) {
  activeChannel = active
  for (const ch of CHANNELS) {
    if (active === null)        cardStates[ch.id] = 'idle'
    else if (ch.id === active)  cardStates[ch.id] = 'active'
    else                        cardStates[ch.id] = 'locked'
  }
  renderCards()
}

function renderCard(ch: ChannelDef): string {
  const st = cardStates[ch.id]
  const portTags = ch.ports.map(p => `<span class="port-tag">${p.label}</span>`).join('')

  let primaryBtn = ''
  let secondaryBtn = ''

  if (st === 'launching') {
    primaryBtn = `<button class="btn btn-primary" disabled>⏳ Iniciando…</button>`
    secondaryBtn = ''
  } else if (st === 'active') {
    primaryBtn = `<a class="btn btn-primary" href="${ch.frontendUrl}" target="_blank" rel="noopener">↗ Abrir app</a>`
    secondaryBtn = `<button class="btn btn-stop" data-id="${ch.id}">■ Detener</button>`
  } else if (st === 'locked') {
    primaryBtn = `<button class="btn btn-primary btn-disabled" disabled>Bloqueado</button>`
    secondaryBtn = ''
  } else {
    primaryBtn = `<button class="btn btn-primary btn-launch" data-id="${ch.id}">▶ Iniciar</button>`
    secondaryBtn = `<a class="btn btn-ghost" href="${ch.backendUrl}/docs" target="_blank" rel="noopener">API docs</a>`
  }

  return `
    <div class="card ${ch.cssClass}${st === 'active' ? ' card-active' : ''}${st === 'locked' ? ' card-locked' : ''}">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <div class="card-icon">${ch.icon}</div>
          <div class="card-title">
            <h2>${ch.name}${st === 'active' ? ' <span class="active-badge">● Activo</span>' : ''}</h2>
            <div class="lang">${ch.lang}</div>
          </div>
        </div>
        <div class="status-badge">
          <div class="status-dot checking" id="dot-${ch.id}"></div>
          <span id="status-label-${ch.id}">verificando…</span>
        </div>
      </div>
      <p class="card-desc">${ch.desc}</p>
      <div class="ports">${portTags}</div>
      <div class="card-actions">
        ${primaryBtn}
        ${secondaryBtn}
      </div>
    </div>
  `
}

function renderCards() {
  const container = document.querySelector<HTMLDivElement>('.channels')
  if (!container) return
  container.innerHTML = CHANNELS.map(renderCard).join('')
  bindButtons()
  refreshStatus()
}

async function refreshStatus() {
  try {
    const data = await fetch('/api/status').then(r => r.json())
    for (const ch of CHANNELS) {
      const dot = document.getElementById(`dot-${ch.id}`)
      const lbl = document.getElementById(`status-label-${ch.id}`)
      if (!dot || !lbl) continue
      const alive = data.channels?.[ch.id]?.backend === 'running'
      dot.className = `status-dot ${alive ? 'online' : 'offline'}`
      lbl.textContent = alive ? 'backend activo' : 'backend offline'
    }
  } catch {
    // API server unreachable
  }
}

async function launch(channelId: string) {
  cardStates[channelId] = 'launching'
  renderCards()
  try {
    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    })
    const data = await res.json()
    applyStates(data.ok ? channelId : activeChannel)
  } catch {
    applyStates(activeChannel)
  }
}

async function stop(channelId: string) {
  const dot = document.getElementById(`dot-${channelId}`)
  if (dot) dot.className = 'status-dot checking'
  await fetch('/api/stop', { method: 'POST' }).catch(() => {})
  applyStates(null)
}

function bindButtons() {
  document.querySelectorAll<HTMLButtonElement>('.btn-launch').forEach(btn => {
    btn.addEventListener('click', () => launch(btn.dataset.id!))
  })
  document.querySelectorAll<HTMLButtonElement>('.btn-stop').forEach(btn => {
    btn.addEventListener('click', () => stop(btn.dataset.id!))
  })
}

// Mount shell
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header>
    <h1>Neural Studio</h1>
    <p>Selecciona el canal en el que quieres trabajar</p>
  </header>
  <div class="channels"></div>
  <footer>localhost:5172 — launcher</footer>
`

// Sync state from server, then render
fetch('/api/status')
  .then(r => r.json())
  .then(d => applyStates(d.activeChannel))
  .catch(() => applyStates(null))

// Refresh backend status dots every 15s
setInterval(refreshStatus, 8_000)
