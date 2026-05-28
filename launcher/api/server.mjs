import http from 'http'
import { spawn, execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const PORT = 5171

function backendCmd(channelDir, port) {
  const venvPy = path.join(channelDir, 'backend', 'venv', 'Scripts', 'python.exe')
  const python = existsSync(venvPy) ? venvPy : 'python'
  return {
    cmd: python,
    args: ['-m', 'uvicorn', 'main:app', '--reload', '--port', String(port)],
    cwd: path.join(channelDir, 'backend'),
    log: true,
  }
}

function npmCmd(cwd, script) {
  return { cmd: 'cmd', args: ['/c', `npm ${script}`], cwd }
}

// Ports used by each channel — killed on launcher startup to free orphans
const CHANNEL_PORTS = {
  cm: [8000, 5173, 3000],
  pd: [8001, 5175, 3000],
}

function freePort(port) {
  try {
    const result = execSync(
      `netstat -ano | findstr :${port}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )
    for (const line of result.split('\n')) {
      const m = line.trim().match(/LISTENING\s+(\d+)$/)
      if (m) {
        try { execSync(`taskkill /F /PID ${m[1]}`, { stdio: 'ignore' }) } catch {}
        console.log(`[startup] freed port ${port} (PID ${m[1]})`)
      }
    }
  } catch {}
}

const CHANNELS = {
  cm: {
    backend: backendCmd(path.join(ROOT, 'codigo-muerto'), 8000),
    frontend: npmCmd(path.join(ROOT, 'codigo-muerto', 'frontend'), 'run dev'),
    remotion: npmCmd(path.join(ROOT, 'codigo-muerto', 'remotion'), 'start'),
  },
  pd: {
    backend: backendCmd(path.join(ROOT, 'phantom-directive'), 8001),
    frontend: npmCmd(path.join(ROOT, 'phantom-directive', 'frontend'), 'run dev'),
    remotion: npmCmd(path.join(ROOT, 'phantom-directive', 'remotion'), 'start'),
  },
}

const state = {
  activeChannel: null,
  procs: { cm: {}, pd: {} },
}

function isAlive(proc) {
  return proc && proc.exitCode === null && !proc.killed
}

function killTree(proc) {
  if (!proc || !proc.pid) return
  try {
    spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore' })
  } catch {}
}

function stopChannel(channelId) {
  const procs = state.procs[channelId]
  if (!procs) return
  for (const proc of Object.values(procs)) killTree(proc)
  state.procs[channelId] = {}
  console.log(`[${channelId}] stopped`)
}

function startChannel(channelId) {
  const defs = CHANNELS[channelId]
  if (!defs) return
  const procs = {}
  for (const [name, def] of Object.entries(defs)) {
    const proc = spawn(def.cmd, def.args, {
      cwd: def.cwd,
      stdio: def.log ? ['ignore', 'pipe', 'pipe'] : 'ignore',
      windowsHide: true,
    })
    if (def.log) {
      proc.stdout?.on('data', d => console.log(`[${channelId}:${name}] ${d.toString().trimEnd()}`))
      proc.stderr?.on('data', d => console.error(`[${channelId}:${name}] ${d.toString().trimEnd()}`))
    }
    proc.on('exit', code => console.log(`[${channelId}:${name}] exited (${code})`))
    procs[name] = proc
    console.log(`[${channelId}:${name}] started PID=${proc.pid}`)
  }
  state.procs[channelId] = procs
}

function getStatus() {
  const channels = {}
  for (const [id, procs] of Object.entries(state.procs)) {
    channels[id] = {}
    for (const [name, proc] of Object.entries(procs)) {
      channels[id][name] = isAlive(proc) ? 'running' : 'stopped'
    }
  }
  return { activeChannel: state.activeChannel, channels }
}

function readBody(req) {
  return new Promise(resolve => {
    let raw = ''
    req.on('data', chunk => (raw += chunk))
    req.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({}) } })
  })
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/api/status') {
    return json(res, getStatus())
  }

  if (req.method === 'POST' && req.url === '/api/launch') {
    const { channelId } = await readBody(req)
    if (!CHANNELS[channelId]) return json(res, { error: 'unknown channel' }, 400)
    if (state.activeChannel === channelId) return json(res, { ok: true, message: 'already active' })
    if (state.activeChannel) stopChannel(state.activeChannel)
    startChannel(channelId)
    state.activeChannel = channelId
    return json(res, { ok: true, activeChannel: channelId })
  }

  if (req.method === 'POST' && req.url === '/api/stop') {
    if (state.activeChannel) { stopChannel(state.activeChannel); state.activeChannel = null }
    return json(res, { ok: true })
  }

  json(res, { error: 'not found' }, 404)
}).listen(PORT, () => {
  console.log(`[launcher-api] http://localhost:${PORT}`)
  // Free any orphan processes from a previous launcher session
  const seen = new Set()
  for (const ports of Object.values(CHANNEL_PORTS)) {
    for (const p of ports) {
      if (!seen.has(p)) { seen.add(p); freePort(p) }
    }
  }
})

process.on('exit', () => { for (const id of Object.keys(CHANNELS)) stopChannel(id) })
process.on('SIGINT', () => process.exit())
process.on('SIGTERM', () => process.exit())
