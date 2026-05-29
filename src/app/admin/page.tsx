'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Provider = 'supabase' | 'vercel' | 'postgres'
type Status = 'active' | 'exhausted' | 'disabled'

type CredSet = {
  id: string
  provider: Provider
  label: string
  credentials: Record<string, string>
  status: Status
  priority: number
  created_at: string
  last_used_at: string | null
}

// ── Provider config ───────────────────────────────────────────────────────────

const PROVIDERS: {
  id: Provider
  title: string
  icon: string
  color: string
  desc: string
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[]
}[] = [
  {
    id: 'supabase', title: 'Supabase', icon: '⬡', color: '#3ecf8e',
    desc: 'Cuentas para crear proyectos y bases de datos automáticamente',
    fields: [
      { key: 'management_token', label: 'Management Token', placeholder: 'sbp_…', secret: true },
      { key: 'org_id',           label: 'Organization ID',  placeholder: 'abc123def456' },
      { key: 'region',           label: 'Región',           placeholder: 'us-east-1 (sa-east-1 para Sudamérica)' },
    ],
  },
  {
    id: 'vercel', title: 'Vercel', icon: '▲', color: '#ffffff',
    desc: 'Cuentas para deployar proyectos automáticamente',
    fields: [
      { key: 'token',   label: 'API Token', placeholder: 'abc123…', secret: true },
      { key: 'team_id', label: 'Team ID',   placeholder: 'team_xyz (opcional — vacío = cuenta personal)' },
    ],
  },
  {
    id: 'postgres', title: 'PostgreSQL', icon: '🐘', color: '#336791',
    desc: 'Conexiones directas a bases de datos PostgreSQL',
    fields: [
      { key: 'connection_string', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/db', secret: true },
    ],
  },
]

const STATUS_CFG: Record<Status, { label: string; color: string; bg: string }> = {
  active:    { label: 'Activa',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  exhausted: { label: 'Agotada',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  disabled:  { label: 'Desactivada', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

// ── CredSetCard ───────────────────────────────────────────────────────────────

function CredSetCard({ item, color, onDelete, onStatusChange }: {
  item: CredSet; color: string
  onDelete: () => void
  onStatusChange: (status: Status) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUS_CFG[item.status]

  return (
    <div style={{
      border: `1px solid ${item.status === 'active' ? `${color}25` : 'var(--border)'}`,
      borderRadius: 10, overflow: 'hidden',
      background: item.status === 'active' ? `${color}06` : 'rgba(255,255,255,0.02)',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
          {st.label}
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.label}</span>
        {item.priority > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 6 }}>
            prioridad {item.priority}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }} className="fade-in">
          {/* Credentials display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {Object.entries(item.credentials).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text3)', minWidth: 120 }}>{k}</span>
                <span style={{ color: 'var(--text2)', fontFamily: 'monospace' }}>{v || '—'}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {item.status !== 'active' && (
              <button onClick={() => onStatusChange('active')}
                style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>
                ↩ Reactivar
              </button>
            )}
            {item.status === 'active' && (
              <button onClick={() => onStatusChange('exhausted')}
                style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>
                ⚡ Marcar agotada
              </button>
            )}
            {item.status !== 'disabled' && (
              <button onClick={() => onStatusChange('disabled')}
                style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>
                Desactivar
              </button>
            )}
            <button onClick={onDelete}
              style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', marginLeft: 'auto' }}>
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddCredSetForm ────────────────────────────────────────────────────────────

function AddCredSetForm({ provider, onSaved, onCancel }: {
  provider: typeof PROVIDERS[0]
  onSaved: () => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState<Record<string, boolean>>({})
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => { labelRef.current?.focus() }, [])

  async function save() {
    if (!label.trim()) return
    setSaving(true)
    await fetch('/api/admin/credential-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: provider.id, label, credentials: values }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ border: `1px solid ${provider.color}30`, borderRadius: 10, padding: '16px', background: `${provider.color}06` }} className="fade-in">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5 }}>Nombre / Label</label>
          <input ref={labelRef} value={label} onChange={e => setLabel(e.target.value)} placeholder="ej: Cuenta personal, Cuenta trabajo…"
            style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '8px 12px', borderRadius: 7, outline: 'none' }} />
        </div>

        {provider.fields.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5 }}>{f.label}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={f.secret && !show[f.key] ? 'password' : 'text'}
                value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '8px 12px', paddingRight: f.secret ? 36 : 12, borderRadius: 7, outline: 'none', fontFamily: f.secret ? 'monospace' : 'inherit' }}
              />
              {f.secret && (
                <button onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>
                  {show[f.key] ? '🙈' : '👁'}
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} style={{ fontSize: 12, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', padding: '7px 16px', borderRadius: 7, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !label.trim()}
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: saving ? 'rgba(99,102,241,0.4)' : 'var(--indigo)', border: 'none', padding: '7px 20px', borderRadius: 7, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Guardando…' : 'Guardar cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ProviderSection ───────────────────────────────────────────────────────────

function ProviderSection({ provider }: { provider: typeof PROVIDERS[0] }) {
  const [items, setItems] = useState<CredSet[]>([])
  const [adding, setAdding] = useState(false)

  async function load() {
    const res = await fetch(`/api/admin/credential-sets?provider=${provider.id}`)
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function deleteItem(id: string) {
    await fetch(`/api/admin/credential-sets/${id}`, { method: 'DELETE' })
    load()
  }

  async function changeStatus(id: string, status: Status) {
    await fetch(`/api/admin/credential-sets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const activeCount = items.filter(i => i.status === 'active').length

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${provider.color}18`, border: `1px solid ${provider.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: provider.color, fontWeight: 700 }}>
          {provider.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{provider.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{provider.desc}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {items.length > 0 && (
            <span style={{ fontSize: 11, color: activeCount > 0 ? '#4ade80' : '#f59e0b', background: activeCount > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              {activeCount} activa{activeCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setAdding(true)}
            style={{ fontSize: 12, fontWeight: 600, color: provider.color, background: `${provider.color}12`, border: `1px solid ${provider.color}30`, padding: '6px 14px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = `${provider.color}22`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${provider.color}12`)}
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: items.length || adding ? '16px' : '0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && !adding && (
          <div style={{ padding: '20px 24px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Sin cuentas. Agregá una con <strong style={{ color: provider.color }}>+ Agregar</strong>.
          </div>
        )}

        {items.map(item => (
          <CredSetCard
            key={item.id}
            item={item}
            color={provider.color}
            onDelete={() => deleteItem(item.id)}
            onStatusChange={s => changeStatus(item.id, s)}
          />
        ))}

        {adding && (
          <AddCredSetForm
            provider={provider}
            onSaved={() => { setAdding(false); load() }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>

      {/* Auto-switch info */}
      {items.length > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
          ↻ Auto-switch activado — cuando una cuenta se agota, pasa a la siguiente activa automáticamente
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [savingAnthropicKey, setSavingAnthropicKey] = useState(false)
  const [savedAnthropicKey, setSavedAnthropicKey] = useState(false)
  const [deletingAnthropicKey, setDeletingAnthropicKey] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    fetch('/api/admin/credentials').then(r => r.json()).then(d => {
      setHasAnthropicKey(!!d.hasValues?.anthropic_api_key)
    })
  }, [])

  async function saveAnthropicKey() {
    if (!anthropicKey.trim()) return
    setSavingAnthropicKey(true)
    await fetch('/api/admin/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'credentials', anthropic_api_key: anthropicKey }),
    })
    setSavingAnthropicKey(false)
    setSavedAnthropicKey(true)
    setHasAnthropicKey(true)
    setAnthropicKey('')
    setTimeout(() => setSavedAnthropicKey(false), 2000)
  }

  async function deleteAnthropicKey() {
    setDeletingAnthropicKey(true)
    await fetch('/api/admin/credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'anthropic_api_key' }),
    })
    setDeletingAnthropicKey(false)
    setHasAnthropicKey(false)
    setAnthropicKey('')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'rgba(7,7,15,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, var(--indigo) 0%, var(--indigo2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.5, color: 'var(--text)' }}>OptiCoud</span>
        </Link>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Credenciales</span>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>Credenciales de integración</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Agregá tantas cuentas como quieras por proveedor. Cuando una se agota el sistema pasa a la siguiente automáticamente.
          </p>
        </div>

        {/* Anthropic — single key */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#f59e0b', fontWeight: 700 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Anthropic (opcional)</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>API key para el Product Owner IA. Si está vacío, usa las credenciales del Claude Code CLI.</div>
            </div>
            {hasAnthropicKey && <span style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: 10 }}>✓ configurado</span>}
          </div>
          <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={anthropicKey}
                  onChange={e => setAnthropicKey(e.target.value)}
                  placeholder={hasAnthropicKey ? '(guardado — ingresá nueva key para reemplazar)' : 'sk-ant-api03-…'}
                  onKeyDown={e => { if (e.key === 'Enter') saveAnthropicKey() }}
                  style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '9px 12px', paddingRight: 36, borderRadius: 8, outline: 'none', fontFamily: 'monospace' }}
                />
                <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
              <button onClick={saveAnthropicKey} disabled={savingAnthropicKey || !anthropicKey.trim()}
                style={{ background: savedAnthropicKey ? '#16a34a' : 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: savedAnthropicKey ? '#fff' : '#f59e0b', fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {savedAnthropicKey ? '✓ Guardado' : savingAnthropicKey ? '…' : 'Guardar'}
              </button>
              {hasAnthropicKey && (
                <button onClick={deleteAnthropicKey} disabled={deletingAnthropicKey}
                  style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {deletingAnthropicKey ? '…' : 'Borrar'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Multi-account providers */}
        {PROVIDERS.map(p => <ProviderSection key={p.id} provider={p} />)}

        {/* Info */}
        <div style={{ padding: '16px 20px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--indigo2)', marginBottom: 10 }}>Auto-switch</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            Cuando un proyecto Supabase llega al límite del plan gratuito (2 proyectos activos), el sistema marca esa cuenta como <strong style={{ color: '#f59e0b' }}>agotada</strong> y usa la siguiente cuenta activa. Lo mismo para Vercel. Podés marcar cuentas manualmente o dejar que el sistema lo haga solo.
          </div>
        </div>
      </main>
    </div>
  )
}
