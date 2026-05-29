'use client'

import { useEffect, useState, use, useRef } from 'react'
import Link from 'next/link'
import type { Project, Task } from '@/lib/supabase'

type ProjectMeta = {
  supabase_url?: string
  supabase_anon_key?: string
  supabase_service_role_key?: string
  supabase_db_password?: string
  vercel_deploy_url?: string
  auto_deploy?: string
  setup_at?: string
}

function SetupModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: (meta: ProjectMeta) => void }) {
  const [mode, setMode] = useState<'choose' | 'new' | 'existing'>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState({ supabase_url: '', supabase_anon_key: '', supabase_service_role_key: '', supabase_db_password: '' })

  async function run(selectedMode: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/project-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, mode: selectedMode, existing_creds: existing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error en setup')
      onDone(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fade-in" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>⚡ Setup automático</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Crea la base de datos y el proyecto Vercel automáticamente</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>{error}</div>}

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => { setMode('new'); run('new_supabase') }}
              style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.25)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,207,142,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(62,207,142,0.08)')}>
              <div style={{ fontWeight: 700, color: '#3ecf8e', marginBottom: 4 }}>⬡ Crear nueva base de datos Supabase</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Crea un proyecto Supabase nuevo, obtiene las keys y escribe el .env.local automáticamente. Requiere credenciales de Management API en /admin.</div>
            </button>
            <button onClick={() => setMode('existing')}
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}>
              <div style={{ fontWeight: 700, color: 'var(--indigo2)', marginBottom: 4 }}>⬡ Usar credenciales existentes</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Ingresá las credenciales de un proyecto Supabase que ya tenés. OptiCoud las guardará y las pasará a Claude automáticamente.</div>
            </button>
          </div>
        )}

        {mode === 'new' && loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '30px 0', color: 'var(--text2)' }}>
            <div className="spin" style={{ width: 28, height: 28, border: '3px solid rgba(62,207,142,0.2)', borderTopColor: '#3ecf8e', borderRadius: '50%' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Creando proyecto Supabase…</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Puede tardar 2-5 minutos en activarse</div>
            </div>
          </div>
        )}

        {mode === 'existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'supabase_url', label: 'Supabase URL', placeholder: 'https://abc.supabase.co' },
              { key: 'supabase_anon_key', label: 'Anon Key', placeholder: 'sb_publishable_…' },
              { key: 'supabase_service_role_key', label: 'Service Role Key', placeholder: 'sb_secret_…' },
              { key: 'supabase_db_password', label: 'DB Password (opcional)', placeholder: 'tu-password' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.key.includes('key') || f.key.includes('password') ? 'password' : 'text'}
                  value={existing[f.key as keyof typeof existing]}
                  onChange={e => setExisting(x => ({ ...x, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '8px 12px', borderRadius: 7, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setMode('choose')} style={{ fontSize: 13, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', padding: '9px 18px', borderRadius: 8, cursor: 'pointer' }}>Atrás</button>
              <button
                onClick={() => run('existing')}
                disabled={loading || !existing.supabase_url}
                style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: loading ? '#3730a3' : 'var(--indigo)', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: loading ? 'wait' : 'pointer' }}
              >
                {loading ? 'Guardando…' : 'Guardar y configurar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pendiente',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',  icon: '○' },
  running:   { label: 'Ejecutando', color: '#818cf8', bg: 'rgba(129,140,248,0.12)',  icon: '◉' },
  completed: { label: 'Completado', color: '#4ade80', bg: 'rgba(74,222,128,0.1)',    icon: '●' },
  failed:    { label: 'Fallido',    color: '#f87171', bg: 'rgba(248,113,113,0.1)',   icon: '✕' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `${mins}m atrás`
  const hs = Math.floor(mins / 60)
  if (hs < 24) return `${hs}h atrás`
  return `${Math.floor(hs / 24)}d atrás`
}

function TaskItem({
  task, selected, onSelect, onDelete,
}: {
  task: Task; selected: boolean; onSelect: () => void; onDelete: () => void
}) {
  const cfg = STATUS_CONFIG[task.status]
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        background: selected ? 'rgba(79,70,229,0.08)' : 'transparent',
        borderLeft: selected ? '2px solid var(--indigo)' : '2px solid transparent',
        transition: 'all 0.15s', position: 'relative',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: cfg.color, fontSize: 12, marginTop: 2, flexShrink: 0 }} className={task.status === 'running' ? 'pulse' : ''}>
          {cfg.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: '1px 7px', borderRadius: 20 }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(task.created_at)}</span>
          </div>
          <p style={{ fontSize: 13, color: selected ? 'var(--text)' : 'var(--text2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {task.prompt}
          </p>
          {task.result && task.status === 'completed' && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.result.substring(0, 80)}…
            </div>
          )}
          {task.result && task.status === 'failed' && (
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.result.substring(0, 80)}
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 2, flexShrink: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
        >✕</button>
      </div>
    </div>
  )
}

// ── AI Planner panel ──────────────────────────────────────────────────────────

function AiPlannerPanel({
  projectId,
  onTasksAdded,
}: {
  projectId: string
  onTasksAdded: () => void
}) {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<boolean[]>([])

  async function generate() {
    if (!idea.trim()) return
    setLoading(true)
    setError('')
    setPreview([])
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, idea }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando tareas')
      setPreview(data.tasks)
      setChecked(data.tasks.map(() => true))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function addSelected() {
    const selected = preview.filter((_, i) => checked[i])
    if (!selected.length) return
    setAdding(true)
    for (const prompt of selected) {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, prompt }),
      })
    }
    setAdding(false)
    setPreview([])
    setIdea('')
    onTasksAdded()
  }

  const selectedCount = checked.filter(Boolean).length

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✦</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.2 }}>Product Owner IA</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)' }}>claude-opus</span>
      </div>

      {/* Idea textarea */}
      {!preview.length && (
        <>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="Describí la idea o feature completa. Cuanto más detalle, mejores tareas genera la IA…"
            rows={4}
            style={{
              width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, padding: '10px 12px', borderRadius: 8,
              resize: 'none', outline: 'none', lineHeight: 1.6, transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
          />
          {error && (
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 6, padding: '6px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>⌘+Enter para generar</span>
            <button
              onClick={generate}
              disabled={loading || !idea.trim()}
              style={{
                background: loading || !idea.trim() ? 'rgba(99,77,220,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '7px 14px', borderRadius: 7,
                cursor: loading || !idea.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {loading ? (
                <>
                  <div className="spin" style={{ width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Generando…
                </>
              ) : '✦ Generar tareas'}
            </button>
          </div>
        </>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa' }}>
              {preview.length} tareas generadas
            </span>
            <button
              onClick={() => { setPreview([]); setChecked([]) }}
              style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Editar idea
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 280, overflowY: 'auto' }}>
            {preview.map((task, i) => (
              <label
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                  borderRadius: 7, cursor: 'pointer',
                  background: checked[i] ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${checked[i] ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
                  transition: 'all 0.12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={e => {
                    const next = [...checked]
                    next[i] = e.target.checked
                    setChecked(next)
                  }}
                  style={{ marginTop: 2, accentColor: '#6366f1', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: checked[i] ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, flex: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 5 }}>{i + 1}.</span>
                  {task}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setChecked(preview.map(() => true))}
              style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              Seleccionar todas
            </button>
            <span style={{ color: 'var(--text3)', fontSize: 10 }}>·</span>
            <button
              onClick={() => setChecked(preview.map(() => false))}
              style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              Ninguna
            </button>
            <button
              onClick={addSelected}
              disabled={adding || selectedCount === 0}
              style={{
                marginLeft: 'auto',
                background: adding || selectedCount === 0 ? 'rgba(99,77,220,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '7px 14px', borderRadius: 7,
                cursor: adding || selectedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? 'Agregando…' : `+ Agregar ${selectedCount} tarea${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type PreviewUrl = { label: string; url: string }
type DeploySnapshot = { url: string; saved_at: string; label?: string }

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [prompt, setPrompt] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')
  const [inputMode, setInputMode] = useState<'manual' | 'ai'>('manual')
  const [showSetup, setShowSetup] = useState(false)
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null)
  // Preview tabs: 'result' | 'history' | number (index of previewUrls)
  const [activeTab, setActiveTab] = useState<'result' | 'history' | number>('result')
  const [previewUrls, setPreviewUrls] = useState<PreviewUrl[]>([])
  const [addingUrl, setAddingUrl] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newUrlLabel, setNewUrlLabel] = useState('')
  const [deployHistory, setDeployHistory] = useState<DeploySnapshot[]>([])
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [historyPreviewIdx, setHistoryPreviewIdx] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function loadProjectMeta() {
    const res = await fetch(`/api/admin/project-setup?project_id=${id}`)
    const data = await res.json()
    if (data.supabase_url) setProjectMeta(data)
    if (data.preview_urls) setPreviewUrls(data.preview_urls)
    if (data.deploy_history) setDeployHistory(data.deploy_history)
  }

  async function saveSnapshot() {
    const url = projectMeta?.vercel_deploy_url
    if (!url) return
    setSavingSnapshot(true)
    const snapshot: DeploySnapshot = { url, saved_at: new Date().toISOString() }
    const updated = [...deployHistory, snapshot]
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploy_history: updated }),
    })
    setDeployHistory(updated)
    setHistoryPreviewIdx(updated.length - 1)
    setActiveTab('history')
    setSavingSnapshot(false)
  }

  async function removeSnapshot(idx: number) {
    const updated = deployHistory.filter((_, i) => i !== idx)
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploy_history: updated }),
    })
    setDeployHistory(updated)
    if (historyPreviewIdx === idx) setHistoryPreviewIdx(null)
  }

  async function savePreviewUrls(urls: PreviewUrl[]) {
    setPreviewUrls(urls)
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview_urls: urls }),
    })
  }

  async function addPreviewUrl() {
    if (!newUrl.trim()) return
    const label = newUrlLabel.trim() || new URL(newUrl.trim()).hostname
    const updated = [...previewUrls, { label, url: newUrl.trim() }]
    await savePreviewUrls(updated)
    setNewUrl(''); setNewUrlLabel(''); setAddingUrl(false)
    setActiveTab(updated.length - 1)
  }

  async function removePreviewUrl(idx: number) {
    const updated = previewUrls.filter((_, i) => i !== idx)
    await savePreviewUrls(updated)
    if (activeTab === idx) setActiveTab('result')
  }

  async function loadProject() {
    const res = await fetch('/api/projects')
    const data: Project[] = await res.json()
    setProject(data.find(p => p.id === id) ?? null)
  }

  async function loadTasks() {
    const res = await fetch(`/api/tasks?project_id=${id}`)
    const data = await res.json()
    setTasks(data)
  }

  useEffect(() => {
    loadProject()
    loadTasks()
    loadProjectMeta()
    const interval = setInterval(loadTasks, 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    setAdding(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, prompt }),
    })
    setPrompt('')
    setAdding(false)
    loadTasks()
    textareaRef.current?.focus()
  }

  async function deleteTask(taskId: string) {
    if (selected === taskId) setSelected(null)
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    loadTasks()
  }

  const pending = tasks.filter(t => t.status === 'pending').length
  const running = tasks.filter(t => t.status === 'running').length
  const completed = tasks.filter(t => t.status === 'completed').length
  const failed = tasks.filter(t => t.status === 'failed').length

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const selectedTask = tasks.find(t => t.id === selected)

  return (
    <>
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'rgba(7,7,15,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <Link href="/" style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--text2)')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text3)')}
        >
          ← Proyectos
        </Link>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>/</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{project?.name ?? '…'}</span>

        {running > 0 && (
          <span style={{ fontSize: 11, color: 'var(--indigo2)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--indigo2)', display: 'inline-block' }} />
            {running} ejecutando
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {projectMeta?.supabase_url && (
            <span style={{ fontSize: 10, color: '#3ecf8e', background: 'rgba(62,207,142,0.1)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(62,207,142,0.2)' }}>
              ⬡ DB conectada
            </span>
          )}
          {projectMeta?.vercel_deploy_url && (
            <>
              <a href={projectMeta.vercel_deploy_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none' }}>
                ▲ Ver deploy
              </a>
              <button
                onClick={saveSnapshot}
                disabled={savingSnapshot}
                title="Guardar snapshot del deploy actual en el historial"
                style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', cursor: savingSnapshot ? 'wait' : 'pointer' }}
              >
                {savingSnapshot ? '…' : '◷ Snapshot'}
              </button>
            </>
          )}
          {project?.folder_path && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {project.folder_path}
            </span>
          )}
          <button
            onClick={() => setShowSetup(true)}
            style={{ fontSize: 11, fontWeight: 600, color: '#3ecf8e', background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,207,142,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(62,207,142,0.08)')}
          >
            ⚡ Setup
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: 'calc(100vh - 52px)' }}>

        {/* ── Left panel ── */}
        <div style={{ width: 400, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Stats bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([
              { key: 'all',       label: 'Todas',      count: tasks.length },
              { key: 'pending',   label: 'Pendientes', count: pending },
              { key: 'running',   label: 'Ejecutando', count: running },
              { key: 'completed', label: 'Listas',     count: completed },
              { key: 'failed',    label: 'Error',      count: failed },
            ] as const).filter(({ count }) => count > 0 || filter === 'all').map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: filter === key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  color: filter === key ? 'var(--indigo2)' : 'var(--text3)',
                }}
              >
                {label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
            <button
              onClick={() => setInputMode('manual')}
              style={{
                flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: inputMode === 'manual' ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: inputMode === 'manual' ? 'var(--text)' : 'var(--text3)',
              }}
            >
              ✎ Manual
            </button>
            <button
              onClick={() => setInputMode('ai')}
              style={{
                flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: inputMode === 'ai' ? 'rgba(99,77,220,0.15)' : 'transparent',
                color: inputMode === 'ai' ? '#a78bfa' : 'var(--text3)',
              }}
            >
              ✦ Product Owner IA
            </button>
          </div>

          {/* Input panel */}
          {inputMode === 'manual' ? (
            <form onSubmit={addTask} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describí la tarea para Claude… (⌘+Enter para enviar)"
                rows={3}
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                  fontSize: 13, padding: '10px 12px', borderRadius: 8, resize: 'none', outline: 'none',
                  lineHeight: 1.6, transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTask(e as unknown as React.FormEvent)
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>⌘+Enter para agregar</span>
                <button
                  type="submit"
                  disabled={adding || !prompt.trim()}
                  style={{
                    background: adding || !prompt.trim() ? 'rgba(79,70,229,0.3)' : 'var(--indigo)',
                    border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                    padding: '7px 14px', borderRadius: 7, cursor: adding || !prompt.trim() ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {adding ? 'Agregando…' : '+ Agregar'}
                </button>
              </div>
            </form>
          ) : (
            <AiPlannerPanel projectId={id} onTasksAdded={loadTasks} />
          )}

          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                {filter === 'all' ? 'Sin tareas todavía. Agregá la primera.' : `Sin tareas "${filter}"`}
              </div>
            ) : filtered.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                selected={selected === task.id}
                onSelect={() => setSelected(task.id === selected ? null : task.id)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right panel: tabs ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', overflowX: 'auto', flexShrink: 0, minHeight: 40 }}>
            {/* Result tab */}
            <button
              onClick={() => setActiveTab('result')}
              style={{
                fontSize: 12, fontWeight: activeTab === 'result' ? 600 : 400,
                color: activeTab === 'result' ? 'var(--text)' : 'var(--text3)',
                background: activeTab === 'result' ? 'var(--bg3)' : 'transparent',
                border: 'none', borderBottom: activeTab === 'result' ? '2px solid var(--indigo2)' : '2px solid transparent',
                padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {tasks.filter(t => t.status === 'running').length > 0
                ? <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo2)', display: 'inline-block' }} />
                : '◈'}
              Resultado
            </button>

            {/* History tab */}
            <button
              onClick={() => setActiveTab('history')}
              style={{
                fontSize: 12, fontWeight: activeTab === 'history' ? 600 : 400,
                color: activeTab === 'history' ? '#f59e0b' : 'var(--text3)',
                background: activeTab === 'history' ? 'var(--bg3)' : 'transparent',
                border: 'none', borderBottom: activeTab === 'history' ? '2px solid #f59e0b' : '2px solid transparent',
                padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ◷ Historial {deployHistory.length > 0 && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0 5px', borderRadius: 8 }}>{deployHistory.length}</span>}
            </button>

            {/* Preview URL tabs */}
            {previewUrls.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', borderBottom: activeTab === i ? '2px solid #3ecf8e' : '2px solid transparent', background: activeTab === i ? 'var(--bg3)' : 'transparent', transition: 'all 0.12s' }}>
                <button
                  onClick={() => setActiveTab(i)}
                  style={{ fontSize: 12, fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? '#3ecf8e' : 'var(--text3)', background: 'none', border: 'none', padding: '10px 4px 10px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ▲ {p.label}
                </button>
                <button
                  onClick={() => removePreviewUrl(i)}
                  style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', padding: '10px 10px 10px 4px', cursor: 'pointer', opacity: 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >✕</button>
              </div>
            ))}

            {/* Add URL tab */}
            {!addingUrl ? (
              <button
                onClick={() => setAddingUrl(true)}
                style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '2px solid transparent' }}
                title="Agregar URL de preview"
              >+ URL</button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}>
                <input
                  autoFocus
                  value={newUrlLabel}
                  onChange={e => setNewUrlLabel(e.target.value)}
                  placeholder="Label"
                  style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, padding: '4px 8px', borderRadius: 5, outline: 'none' }}
                />
                <input
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://…"
                  onKeyDown={e => { if (e.key === 'Enter') addPreviewUrl(); if (e.key === 'Escape') { setAddingUrl(false); setNewUrl(''); setNewUrlLabel('') } }}
                  style={{ width: 160, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, padding: '4px 8px', borderRadius: 5, outline: 'none' }}
                />
                <button onClick={addPreviewUrl} style={{ fontSize: 11, color: '#3ecf8e', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✓</button>
                <button onClick={() => { setAddingUrl(false); setNewUrl(''); setNewUrlLabel('') }} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✕</button>
              </div>
            )}
          </div>

          {/* Tab content */}
          {activeTab === 'history' ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="fade-in">
              {/* History sidebar */}
              <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>Snapshots de deploy</span>
                  {projectMeta?.vercel_deploy_url && (
                    <button
                      onClick={saveSnapshot}
                      disabled={savingSnapshot}
                      style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 8px', borderRadius: 5, cursor: savingSnapshot ? 'wait' : 'pointer' }}
                    >
                      {savingSnapshot ? '…' : '+ Guardar'}
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {deployHistory.length === 0 ? (
                    <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                      <div style={{ fontSize: 24, opacity: 0.2, marginBottom: 8 }}>◷</div>
                      Guardá snapshots después de cada deploy para ver cómo evoluciona la página.
                    </div>
                  ) : (
                    [...deployHistory].reverse().map((snap, revIdx) => {
                      const realIdx = deployHistory.length - 1 - revIdx
                      const date = new Date(snap.saved_at)
                      const label = snap.label || `Deploy #${realIdx + 1}`
                      const isSelected = historyPreviewIdx === realIdx
                      return (
                        <div
                          key={realIdx}
                          onClick={() => setHistoryPreviewIdx(isSelected ? null : realIdx)}
                          style={{
                            padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                            background: isSelected ? 'rgba(245,158,11,0.07)' : 'transparent',
                            borderLeft: isSelected ? '2px solid #f59e0b' : '2px solid transparent',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#f59e0b' : 'var(--text2)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); removeSnapshot(realIdx) }}
                              style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, flexShrink: 0 }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                            >✕</button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              {/* History preview */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {historyPreviewIdx !== null && deployHistory[historyPreviewIdx] ? (
                  <>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deployHistory[historyPreviewIdx].url}
                      </span>
                      <a href={deployHistory[historyPreviewIdx].url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        ↗ Abrir
                      </a>
                    </div>
                    <iframe
                      src={deployHistory[historyPreviewIdx].url}
                      style={{ flex: 1, border: 'none', background: '#fff' }}
                      title={deployHistory[historyPreviewIdx].label || 'Deploy snapshot'}
                    />
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8 }}>
                    <div style={{ fontSize: 32, opacity: 0.2 }}>◷</div>
                    <p style={{ fontSize: 14 }}>Seleccioná un snapshot para previsualizar</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'result' ? (
            selectedTask ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-in">
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: STATUS_CONFIG[selectedTask.status].color, marginBottom: 3 }}>
                      {STATUS_CONFIG[selectedTask.status].icon} {STATUS_CONFIG[selectedTask.status].label} · {timeAgo(selectedTask.created_at)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTask.prompt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {selectedTask.result && (
                      <button onClick={() => navigator.clipboard.writeText(selectedTask.result!)}
                        style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        Copiar
                      </button>
                    )}
                    {selectedTask.status === 'failed' && (
                      <button onClick={async () => {
                        await fetch(`/api/tasks/${selectedTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending', result: null }) })
                        loadTasks()
                      }}
                        style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        ↩ Reintentar
                      </button>
                    )}
                    <button onClick={() => setSelected(null)}
                      style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px' }}>✕</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {selectedTask.status === 'running' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--indigo2)', fontSize: 13, marginBottom: 16 }}>
                      <div className="spin" style={{ width: 13, height: 13, border: '2px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--indigo2)', borderRadius: '50%' }} />
                      Claude está ejecutando esta tarea…
                    </div>
                  )}
                  {selectedTask.result ? (
                    <pre style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace", background: 'var(--bg2)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                      {selectedTask.result}
                    </pre>
                  ) : selectedTask.status === 'pending' ? (
                    <div style={{ color: 'var(--text3)', fontSize: 14 }}>
                      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>○</div>
                      En cola. El worker la ejecutará cuando esté libre.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8 }}>
                <div style={{ fontSize: 36, opacity: 0.2 }}>◈</div>
                <p style={{ fontSize: 14 }}>Seleccioná una tarea para ver el resultado</p>
                {previewUrls.length === 0 && (
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>O agregá una <strong style={{ color: '#3ecf8e' }}>URL</strong> para ver el deploy en vivo</p>
                )}
              </div>
            )
          ) : (
            /* Preview iframe */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-in">
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewUrls[activeTab as number]?.url}
                </span>
                <a href={previewUrls[activeTab as number]?.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#3ecf8e', background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  ↗ Abrir
                </a>
                <button onClick={() => { const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement; if (iframe) iframe.src = iframe.src }}
                  style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                  ↻
                </button>
              </div>
              <iframe
                id="preview-iframe"
                src={previewUrls[activeTab as number]?.url}
                style={{ flex: 1, border: 'none', background: '#fff' }}
                title={previewUrls[activeTab as number]?.label}
              />
            </div>
          )}
        </div>
      </div>
    </div>

    {showSetup && (
      <SetupModal
        projectId={id}
        onClose={() => setShowSetup(false)}
        onDone={(meta) => {
          setProjectMeta(meta)
          setShowSetup(false)
        }}
      />
    )}
    </>
  )
}
