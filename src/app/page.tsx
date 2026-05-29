'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Project } from '@/lib/supabase'

type SortBy = 'recent' | 'name' | 'oldest'

function ProjectCard({ project, onDelete }: { project: Project & { task_count?: number; running?: number }; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirm(`¿Eliminar "${project.name}"? Se eliminarán también todas sus tareas.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDelete()
  }

  const hasPath = !!project.folder_path
  const since = new Date(project.created_at)
  const daysAgo = Math.floor((Date.now() - since.getTime()) / 86400000)
  const ageLabel = daysAgo === 0 ? 'hoy' : daysAgo === 1 ? 'ayer' : `hace ${daysAgo}d`

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card-hover"
      style={{
        display: 'block',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Running indicator */}
      {(project.running ?? 0) > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--indigo), var(--indigo2))', animation: 'shimmer 2s linear infinite', backgroundSize: '200% 100%' }} className="pulse" />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Project icon + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--indigo) 0%, var(--indigo2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {project.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {project.description}
            </div>
          )}

          {/* Path */}
          {hasPath && (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 14 }}>
              {project.folder_path}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {typeof project.task_count !== 'undefined' && (
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                {project.task_count} tarea{project.task_count !== 1 ? 's' : ''}
              </span>
            )}
            {(project.running ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: 'var(--indigo2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo2)', display: 'inline-block' }} className="pulse" />
                {project.running} ejecutando
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{ageLabel}</span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 14, flexShrink: 0, lineHeight: 1, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          title="Eliminar proyecto"
        >
          {deleting ? '…' : '✕'}
        </button>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<(Project & { task_count?: number; running?: number; is_self?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', folder_path: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [selfProject, setSelfProject] = useState<(Project & { task_count?: number; running?: number; is_self?: boolean }) | null>(null)
  const [registeringSelf, setRegisteringSelf] = useState(false)
  const [showSelfTask, setShowSelfTask] = useState(false)
  const [selfTaskPrompt, setSelfTaskPrompt] = useState('')
  const [submittingSelf, setSubmittingSelf] = useState(false)

  async function loadProjects() {
    const res = await fetch('/api/projects')
    const data: (Project & { task_count?: number; running?: number; is_self?: boolean })[] = await res.json()
    const self = data.find(p => p.is_self)
    setSelfProject(self ?? null)
    setProjects(data.filter(p => !p.is_self))
    setLoading(false)
  }

  async function registerSelf() {
    setRegisteringSelf(true)
    await fetch('/api/projects/self', { method: 'POST' })
    await loadProjects()
    setRegisteringSelf(false)
  }

  async function submitSelfTask(e: React.FormEvent) {
    e.preventDefault()
    if (!selfTaskPrompt.trim() || !selfProject) return
    setSubmittingSelf(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: selfProject.id, prompt: selfTaskPrompt.trim() }),
    })
    setSelfTaskPrompt('')
    setShowSelfTask(false)
    setSubmittingSelf(false)
    loadProjects()
  }

  useEffect(() => { loadProjects() }, [])

  // Poll every 8s for running task updates
  useEffect(() => {
    const interval = setInterval(loadProjects, 30000)
    return () => clearInterval(interval)
  }, [])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', description: '', folder_path: '' })
    setShowForm(false)
    setSaving(false)
    loadProjects()
  }

  const filtered = projects
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalRunning = projects.reduce((s, p) => s + (p.running ?? 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(7,7,15,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, var(--indigo) 0%, var(--indigo2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.5 }}>OptiCoud</span>
          {totalRunning > 0 && (
            <span style={{ fontSize: 11, color: 'var(--indigo2)', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--indigo2)', display: 'inline-block' }} />
              {totalRunning} en curso
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            ⚙ Credenciales
          </Link>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--indigo2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--indigo)')}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nuevo proyecto
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', padding: '36px 32px', width: '100%' }}>
        {/* Page header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Proyectos</h1>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              {loading ? 'Cargando…' : `${projects.length} proyecto${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Search + sort */}
          {!loading && projects.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13, pointerEvents: 'none' }}>⌕</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar proyectos…"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '8px 12px 8px 30px', borderRadius: 8, outline: 'none', width: 200, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', outline: 'none' }}
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </div>
          )}
        </div>

        {/* ── OptiCoud self-project ── */}
        {!loading && (
          selfProject ? (
            <div
              style={{
                marginBottom: 28,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '16px 24px',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3ecf8e)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>O</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>OptiCoud</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '1px 7px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.25)' }}>proyecto padre</span>
                    {(selfProject.running ?? 0) > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--indigo2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--indigo2)', display: 'inline-block' }} />
                        {selfProject.running} ejecutando
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Las tareas aquí modifican OptiCoud mismo · {selfProject.task_count ?? 0} tareas</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setShowSelfTask(true)}
                    style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    ✦ Mejorar
                  </button>
                  <Link
                    href={`/projects/${selfProject.id}`}
                    style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.25)', padding: '7px 12px', borderRadius: 8, textDecoration: 'none' }}
                  >
                    Ver tareas →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 28, background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.25)', borderRadius: 12, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 22, opacity: 0.4 }}>◈</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>OptiCoud no está registrado como proyecto</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Registralo para que el worker pueda mejorar esta plataforma desde su propia interfaz.</div>
              </div>
              <button
                onClick={registerSelf}
                disabled={registeringSelf}
                style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', padding: '8px 16px', borderRadius: 8, cursor: registeringSelf ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {registeringSelf ? 'Registrando…' : '+ Registrar OptiCoud'}
              </button>
            </div>
          )
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)', fontSize: 14, padding: '48px 0' }}>
            <div className="spin" style={{ width: 16, height: 16, border: '2px solid var(--border2)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            Cargando proyectos…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, padding: '64px 32px', textAlign: 'center' }}>
            {search ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⌕</div>
                <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 8 }}>Sin resultados para &ldquo;{search}&rdquo;</p>
                <button onClick={() => setSearch('')} style={{ fontSize: 12, color: 'var(--indigo2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar búsqueda</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>◈</div>
                <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 20 }}>Todavía no tenés proyectos.</p>
                <button
                  onClick={() => setShowForm(true)}
                  style={{ background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}
                >
                  Crear el primero
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }} className="fade-in">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onDelete={loadProjects} />
            ))}
          </div>
        )}

        {/* Quick tips */}
        {!loading && projects.length > 0 && (
          <div style={{ marginTop: 48, padding: '20px 24px', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--indigo2)', marginBottom: 12 }}>Atajos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {[
                ['Cmd+Enter', 'Agregar tarea rápido'],
                ['Esc', 'Cerrar modals'],
                ['Click en proyecto', 'Ver tareas y resultados'],
                ['Worker local', 'node worker.mjs'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border2)', padding: '2px 6px', borderRadius: 4, color: 'var(--text2)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>{key}</kbd>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Modal mejorar OptiCoud ── */}
      {showSelfTask && selfProject && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowSelfTask(false); setSelfTaskPrompt('') } }}
        >
          <div className="fade-in" style={{ background: 'var(--bg3)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 520, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3ecf8e)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>O</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>Mejorar OptiCoud</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              Describí qué querés cambiar o agregar. El worker va a modificar el código de OptiCoud directamente.
            </p>
            <form onSubmit={submitSelfTask} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <textarea
                value={selfTaskPrompt}
                onChange={e => setSelfTaskPrompt(e.target.value)}
                placeholder="ej: agregá un contador de tareas completadas en el header&#10;ej: cambiá el color del botón principal a verde&#10;ej: agregá un campo de prioridad (alta/media/baja) a las tareas"
                rows={5}
                autoFocus
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 14, padding: '12px 14px', borderRadius: 8, outline: 'none', resize: 'vertical', lineHeight: 1.6, transition: 'border-color 0.15s', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitSelfTask(e as unknown as React.FormEvent) }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Cmd+Enter para enviar</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowSelfTask(false); setSelfTaskPrompt('') }}
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', padding: '9px 18px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSelf || !selfTaskPrompt.trim()}
                    style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: submittingSelf || !selfTaskPrompt.trim() ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', padding: '9px 22px', borderRadius: 8, cursor: submittingSelf || !selfTaskPrompt.trim() ? 'default' : 'pointer' }}
                  >
                    {submittingSelf ? 'Enviando…' : '✦ Enviar mejora'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal nuevo proyecto ── */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="fade-in" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 460 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nuevo proyecto</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
              Cada proyecto tiene su propia cola de tareas para Claude.
            </p>

            <form onSubmit={createProject} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Nombre *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej: Ruben Skates sitio web"
                  autoFocus
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 14, padding: '10px 12px', borderRadius: 8, outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="¿Para qué es este proyecto?"
                  rows={2}
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 14, padding: '10px 12px', borderRadius: 8, outline: 'none', resize: 'vertical', transition: 'border-color 0.15s', lineHeight: 1.5 }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  Carpeta del proyecto <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(opcional)</span>
                </label>
                <input
                  value={form.folder_path}
                  onChange={e => setForm(f => ({ ...f, folder_path: e.target.value }))}
                  placeholder="/Users/c3x/Desktop/proyectos informáticos/mi-app"
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, padding: '10px 12px', borderRadius: 8, outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                />
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                  El worker ejecutará Claude desde esta carpeta
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', padding: '9px 18px', borderRadius: 8, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: saving ? '#3730a3' : 'var(--indigo)', border: 'none', padding: '9px 22px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', transition: 'background 0.15s' }}
                >
                  {saving ? 'Creando…' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
