/**
 * OptiCoud Worker v5.0
 * - Lee credenciales desde Supabase (settings table)
 * - Lee credenciales por proyecto desde projects table
 * - Escribe .env.local localmente si el proyecto tiene credenciales en DB
 * - Auto-crea CLAUDE.md en carpetas de proyecto (contexto persistente, sin inyección)
 * - Historial reducido: últimas 3 tareas, 300 chars por resultado (era 10 × 1500)
 * - --max-turns limita iteraciones de herramientas del CLI
 * - Reglas de eficiencia inyectadas en cada prompt (respuestas concisas)
 * - Auto-deploya a Vercel cuando se agotan las tareas pendientes
 */

import { spawn, execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Resolver la ruta del binario claude (compatible con local y Railway/cloud)
const CLAUDE_BIN = (() => {
  const searchPath = process.env.PATH || '/usr/local/bin:/usr/bin:/bin'
  try { return execSync('which claude', { encoding: 'utf8', env: { PATH: searchPath } }).trim() } catch {}
  try {
    const prefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim()
    const p = `${prefix}/bin/claude`
    if (existsSync(p)) return p
  } catch {}
  return 'claude'
})()

const __dir = dirname(fileURLToPath(import.meta.url))

// Leer .env.local (si existe) + merge con process.env (Railway/cloud)
const envPath = join(__dir, '.env.local')
const fileEnv = existsSync(envPath)
  ? Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
        .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
        .filter(([k]) => k)
    )
  : {}
// process.env tiene prioridad (variables de Railway/cloud sobreescriben el archivo)
const env = { ...fileEnv, ...process.env }

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const POLL_INTERVAL   = 5000
const TASK_TIMEOUT_MS = 45 * 60 * 1000
const MAX_RESULT_SIZE = 8 * 1024 * 1024
const HISTORY_LIMIT   = 3    // was 10 — reduces prompt tokens by ~70%
const MAX_TURNS       = 30   // limit claude tool-call iterations

let running = false
let processedToday = 0
const startTime = Date.now()
let rateLimitUntil = null   // timestamp en ms cuando se renueva el límite
let lastRateLimitLog = 0    // para no spamear el log

// In-memory cache for settings (refreshed every 5 min)
let cachedSettings = {}
let settingsCachedAt = 0

async function getSettings() {
  if (Date.now() - settingsCachedAt < 5 * 60 * 1000) return cachedSettings
  const { data } = await supabase.from('settings').select('key, value')
  cachedSettings = Object.fromEntries((data || []).map(r => [r.key, r.value || '']))
  settingsCachedAt = Date.now()
  return cachedSettings
}

function parseRateLimitReset(msg) {
  // "Your limit will reset at 2026-05-28T10:30:00Z" o similar
  const isoMatch = msg.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?/)
  if (isoMatch) return new Date(isoMatch[0]).getTime()
  // "try again in X hours/minutes"
  const inMatch = msg.match(/(\d+)\s*(hour|minute|min)/i)
  if (inMatch) {
    const val = parseInt(inMatch[1])
    const unit = inMatch[2].toLowerCase()
    return Date.now() + val * (unit.startsWith('hour') ? 3600000 : 60000)
  }
  // Default: esperar 1 hora
  return Date.now() + 3600000
}

function isRateLimitError(msg) {
  const lower = msg.toLowerCase()
  return lower.includes('rate limit') || lower.includes('usage limit') ||
         lower.includes('too many requests') || lower.includes('429') ||
         lower.includes('quota') || lower.includes('exceeded') ||
         lower.includes('limit reached') || lower.includes('limit has been') ||
         lower.includes('tokens per') || lower.includes('requests per')
}

function uptimeStr() {
  const secs = Math.floor((Date.now() - startTime) / 1000)
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function truncate(str, maxBytes = MAX_RESULT_SIZE) {
  const buf = Buffer.from(str, 'utf8')
  if (buf.byteLength <= maxBytes) return str
  return buf.slice(0, maxBytes).toString('utf8') + '\n\n[...resultado truncado por tamaño]'
}

async function fetchHistory(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('prompt, result, created_at')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT)

  if (error || !data?.length) return ''

  return [
    '=== HISTORIAL DE TAREAS ANTERIORES (últimas 3, solo contexto) ===',
    ...data.map((t, i) => {
      const date = new Date(t.created_at).toLocaleString('es-AR', { hour12: false })
      const resultSnippet = (t.result || '').replace(/\n+/g, ' ').trim().slice(0, 300)
      return `[${date}] ${t.prompt.slice(0, 120)}${resultSnippet ? `\n→ ${resultSnippet}` : ''}`
    }),
    '=== FIN HISTORIAL ===',
  ].join('\n')
}

function buildCredsBlock(project) {
  const lines = []
  if (project.supabase_url)              lines.push(`NEXT_PUBLIC_SUPABASE_URL=${project.supabase_url}`)
  if (project.supabase_anon_key)         lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${project.supabase_anon_key}`)
  if (project.supabase_service_role_key) lines.push(`SUPABASE_SERVICE_ROLE_KEY=${project.supabase_service_role_key}`)
  if (project.supabase_db_password)      lines.push(`DATABASE_PASSWORD=${project.supabase_db_password}`)
  if (project.vercel_deploy_url)         lines.push(`VERCEL_DEPLOY_URL=${project.vercel_deploy_url}`)
  if (!lines.length) return ''
  return ['=== CREDENCIALES DEL PROYECTO (usar en .env.local y código) ===', ...lines, '=== FIN CREDENCIALES ==='].join('\n')
}

function ensureEnvLocal(project, settings) {
  if (!project.folder_path || !existsSync(project.folder_path)) return
  const envFile = join(project.folder_path, '.env.local')
  if (existsSync(envFile)) return // ya existe, no sobreescribir

  const lines = [
    project.supabase_url         && `NEXT_PUBLIC_SUPABASE_URL=${project.supabase_url}`,
    project.supabase_anon_key    && `NEXT_PUBLIC_SUPABASE_ANON_KEY=${project.supabase_anon_key}`,
    project.supabase_service_role_key && `SUPABASE_SERVICE_ROLE_KEY=${project.supabase_service_role_key}`,
    project.supabase_db_password && `DATABASE_PASSWORD=${project.supabase_db_password}`,
    settings.vercel_token        && `VERCEL_TOKEN=${settings.vercel_token}`,
    settings.vercel_team_id      && `VERCEL_TEAM_ID=${settings.vercel_team_id}`,
    settings.anthropic_api_key   && `ANTHROPIC_API_KEY=${settings.anthropic_api_key}`,
  ].filter(Boolean)

  if (lines.length) {
    writeFileSync(envFile, lines.join('\n') + '\n')
    console.log(`[ENV] Wrote .env.local → ${envFile}`)
  }
}

const EFFICIENCY_RULES = `=== REGLAS DE EJECUCIÓN (leer primero) ===
- Sé CONCISO: solo reporta cambios realizados y errores relevantes
- NO expliques cada herramienta o paso intermedio
- Ejecuta directamente SIN pedir confirmaciones
- Prefiere editar archivos existentes sobre crear nuevos
- Usa el mínimo de herramientas necesarias para completar la tarea
- Respuesta final: 3-10 líneas máximo con lo que hiciste
=== FIN REGLAS ===`

function ensureProjectClaudeMd(project, projectName) {
  if (!project.folder_path || !existsSync(project.folder_path)) return
  const mdPath = join(project.folder_path, 'CLAUDE.md')
  if (existsSync(mdPath)) return // respect existing CLAUDE.md

  const stack = project.description
    ? `Stack: Next.js App Router + Supabase + Tailwind CSS\nDescripción: ${project.description}`
    : 'Stack: Next.js App Router + Supabase + Tailwind CSS'

  const content = [
    `# ${projectName}`,
    '',
    stack,
    '',
    '## Reglas para el agente',
    '- Respuestas CONCISAS: solo cambios realizados y errores relevantes (3-10 líneas)',
    '- Ejecutar directamente SIN pedir confirmaciones',
    '- NO explicar pasos intermedios ni herramientas usadas',
    '- Prefiere editar archivos existentes, no crear nuevos',
    '- Usa mínimas herramientas para completar la tarea',
    '',
    '## Convenciones del proyecto',
    '- API routes en src/app/api/',
    '- Componentes server-side por defecto (`use client` solo si necesario)',
    '- Variables de entorno en .env.local (ya configuradas)',
    '- Supabase client vía @supabase/supabase-js',
    '',
  ].join('\n')

  writeFileSync(mdPath, content)
  console.log(`[CLAUDE.MD] Creado → ${mdPath}`)
}

async function buildPrompt(task, project, projectName) {
  const history    = await fetchHistory(task.project_id)
  const credsBlock = buildCredsBlock(project)

  const parts = [EFFICIENCY_RULES, '']
  if (credsBlock) parts.push(credsBlock, '')
  if (history)    parts.push(history, '')
  parts.push(`=== TAREA: ${projectName} ===`, task.prompt)
  return parts.join('\n')
}

async function getActiveVercelCred() {
  const { data } = await supabase
    .from('credential_sets')
    .select('*')
    .eq('provider', 'vercel')
    .eq('status', 'active')
    .order('priority')
    .order('last_used_at', { nullsFirst: true })
    .limit(1)
    .single()
  return data
}

async function maybeAutoDeploy(project, projectName) {
  if (!project.auto_deploy) return
  if (!project.folder_path || !existsSync(project.folder_path)) return

  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .in('status', ['pending', 'running'])

  if (count > 0) return

  let attempts = 0
  while (attempts < 5) {
    const credSet = await getActiveVercelCred()
    if (!credSet) { console.log(`[DEPLOY] Sin cuentas Vercel activas`); return }

    const { token, team_id } = credSet.credentials
    console.log(`\n[DEPLOY] ▶ Auto-deploying "${projectName}" (${credSet.label})…`)

    const args = ['vercel', 'deploy', '--prod', '--yes', '--token', token]
    if (team_id) args.push('--scope', team_id)

    try {
      const url = await new Promise((resolve, reject) => {
        const proc = spawn('npx', args, {
          cwd: project.folder_path,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { PATH: process.env.PATH, HOME: process.env.HOME, VERCEL_TOKEN: token },
        })
        let out = '', err = ''
        proc.stdout.on('data', c => { out += c })
        proc.stderr.on('data', c => { err += c })
        proc.on('close', code => {
          if (code === 0) resolve(out.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0] || 'ok')
          else reject(Object.assign(new Error(err || `exit ${code}`), { out, err }))
        })
        proc.on('error', reject)
      })

      await supabase.from('credential_sets').update({ last_used_at: new Date().toISOString() }).eq('id', credSet.id)
      await supabase.from('projects').update({ vercel_deploy_url: url }).eq('id', project.id)
      console.log(`[DEPLOY] ✓ ${url}`)
      return
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('limit') || msg.includes('exceeded') || msg.includes('402')) {
        console.log(`[DEPLOY] Cuenta "${credSet.label}" agotada → switcheando…`)
        await supabase.from('credential_sets').update({ status: 'exhausted' }).eq('id', credSet.id)
        attempts++
      } else {
        console.error(`[DEPLOY] FAIL: ${msg.slice(0, 200)}`)
        return
      }
    }
  }
  console.error(`[DEPLOY] Todas las cuentas Vercel agotadas`)
}

async function processNextTask() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, projects(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) { console.error(`[ERROR] ${error.message}`); return }
  if (!tasks?.length) return

  const task    = tasks[0]
  const project = task.projects
  const folderExists = project?.folder_path && existsSync(project.folder_path)
  const workDir = folderExists ? project.folder_path : process.cwd()
  const projectName = project?.name || 'sin proyecto'

  const ts = new Date().toLocaleTimeString('es-AR', { hour12: false })
  console.log(`\n[${ts}] ▶ Tarea: "${task.prompt.slice(0, 70)}${task.prompt.length > 70 ? '…' : ''}"`)
  console.log(`             Proyecto: ${projectName}`)
  console.log(`             Dir: ${workDir}`)

  await supabase.from('tasks').update({ status: 'running' }).eq('id', task.id)

  const settings = await getSettings()

  // Write .env.local and CLAUDE.md if they don't exist yet
  if (project) {
    ensureEnvLocal(project, settings)
    ensureProjectClaudeMd(project, projectName)
  }

  try {
    const fullPrompt = await buildPrompt(task, project || {}, projectName)
    const anthropicKey = settings.anthropic_api_key || env.ANTHROPIC_API_KEY
    // CLAUDE_CODE_OAUTH_TOKEN usa el plan Pro de claude.ai (sin créditos de API)
    const oauthToken   = env.CLAUDE_CODE_OAUTH_TOKEN

    const output = await new Promise((resolve, reject) => {
      const proc = spawn(CLAUDE_BIN, [
        '--dangerously-skip-permissions',
        '-p', fullPrompt,
        '--output-format', 'text',
        '--max-turns', String(MAX_TURNS),
      ], {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          HOME: process.env.HOME || '/root',
          TERM: process.env.TERM,
          USER: process.env.USER,
          // OAuth token (plan Pro) tiene prioridad sobre API key
          ...(oauthToken            ? { CLAUDE_CODE_OAUTH_TOKEN: oauthToken }        : {}),
          ...(anthropicKey          ? { ANTHROPIC_API_KEY: anthropicKey }            : {}),
          ...(settings.vercel_token ? { VERCEL_TOKEN: settings.vercel_token }        : {}),
          ...(settings.vercel_team_id ? { VERCEL_TEAM_ID: settings.vercel_team_id } : {}),
        },
      })

      let stdout = '', stderr = '', killed = false

      const timer = setTimeout(() => {
        killed = true
        proc.kill('SIGTERM')
        reject(Object.assign(new Error(`TIMEOUT: La tarea superó los ${TASK_TIMEOUT_MS / 60000} minutos.`), { code: 'ETIMEDOUT' }))
      }, TASK_TIMEOUT_MS)

      proc.stdout.on('data', c => { stdout += c })
      proc.stderr.on('data', c => { stderr += c })

      proc.on('close', code => {
        clearTimeout(timer)
        if (killed) return
        if (code === 0) resolve(truncate(stdout.trim()))
        else reject(new Error(stderr.slice(0, 4000) || stdout.slice(0, 4000) || `exit ${code}`))
      })
      proc.on('error', err => { clearTimeout(timer); reject(err) })
    })

    await supabase.from('tasks').update({ status: 'completed', result: output }).eq('id', task.id)
    processedToday++
    console.log(`[OK] Completado (${(output.match(/\n/g) || []).length + 1} líneas · ${processedToday} tareas hoy · uptime ${uptimeStr()})`)

    if (project) await maybeAutoDeploy(project, projectName)

  } catch (err) {
    const msg = err.message || 'Error desconocido'

    if (isRateLimitError(msg)) {
      const resetAt = parseRateLimitReset(msg)
      rateLimitUntil = resetAt
      const resetStr = new Date(resetAt).toLocaleTimeString('es-AR', { hour12: false })
      console.log(`[RATE LIMIT] Límite de tokens alcanzado. Retomando a las ${resetStr}`)
      await supabase.from('tasks').update({ status: 'pending' }).eq('id', task.id)
      return
    }

    // Timeout: volver a pending para reintentar (no marcar como failed)
    if (err.code === 'ETIMEDOUT') {
      console.log(`[TIMEOUT] Tarea superó ${TASK_TIMEOUT_MS / 60000} min → vuelve a pending para reintentar`)
      await supabase.from('tasks').update({ status: 'pending' }).eq('id', task.id)
      return
    }

    await supabase.from('tasks').update({ status: 'failed', result: `ERROR: ${msg.slice(0, 4000)}` }).eq('id', task.id)
    console.error(`[FAIL] ${msg.slice(0, 200)}`)
  }
}

async function tick() {
  if (running) return

  // Pausar si estamos en cooldown por rate limit
  if (rateLimitUntil) {
    const now = Date.now()
    if (now < rateLimitUntil) {
      // Loguear una vez por minuto
      if (now - lastRateLimitLog > 60000) {
        const minLeft = Math.ceil((rateLimitUntil - now) / 60000)
        console.log(`[RATE LIMIT] Esperando renovación de tokens (${minLeft} min restantes)…`)
        lastRateLimitLog = now
      }
      return
    }
    // Límite renovado
    const resetStr = new Date(rateLimitUntil).toLocaleTimeString('es-AR', { hour12: false })
    console.log(`[RATE LIMIT] ✓ Tokens renovados (reset fue a las ${resetStr}), retomando…`)
    rateLimitUntil = null
  }

  running = true
  try { await processNextTask() } finally { running = false }
}

// Startup check + orphan recovery
try {
  const { error } = await supabase.from('projects').select('id').limit(1)
  if (error) throw new Error(error.message)
} catch (err) {
  console.error('[FATAL] No se pudo conectar a Supabase:', err.message)
  process.exit(1)
}

// Reset tasks stuck in 'running' from a previous worker instance
{
  const { data: orphans } = await supabase
    .from('tasks')
    .select('id, prompt')
    .eq('status', 'running')

  if (orphans?.length) {
    await supabase
      .from('tasks')
      .update({ status: 'pending' })
      .eq('status', 'running')
    console.log(`[RECOVERY] ${orphans.length} tarea(s) huérfana(s) reseteadas a pending`)
  }
}

const settings = await getSettings()
console.log('┌─────────────────────────────────────────────┐')
console.log('│         OptiCoud Worker v5.0                │')
console.log('└─────────────────────────────────────────────┘')
console.log(`  Supabase:    ${env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('.')[0]}`)
console.log(`  Poll:        cada ${POLL_INTERVAL / 1000}s`)
console.log(`  Timeout:     ${TASK_TIMEOUT_MS / 60000} min por tarea`)
console.log(`  Historial:   últimas ${HISTORY_LIMIT} tareas (300 chars c/u)`)
console.log(`  Max turns:   ${MAX_TURNS} por tarea`)
console.log(`  Anthropic:   ${settings.anthropic_api_key ? '✓ API key' : '✓ CLI session (claude.ai)'}`)
console.log(`  Vercel:      ${settings.vercel_token ? '✓ configurado' : '✗ sin token'}`)
console.log('  Ctrl+C para detener\n')

tick()
const interval = setInterval(tick, POLL_INTERVAL)

process.on('SIGINT', async () => {
  console.log('\n[STOP] Deteniendo worker…')
  clearInterval(interval)
  let wait = 0
  while (running && wait < 30000) { await new Promise(r => setTimeout(r, 500)); wait += 500 }
  console.log(`[STOP] ${processedToday} tareas procesadas. Hasta la próxima.`)
  process.exit(0)
})
