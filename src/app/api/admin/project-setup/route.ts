import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getActiveCredSet(provider: string) {
  const { data } = await supabase
    .from('credential_sets')
    .select('*')
    .eq('provider', provider)
    .eq('status', 'active')
    .order('priority')
    .order('last_used_at', { nullsFirst: true })
    .limit(1)
    .single()
  return data
}

async function markExhausted(id: string) {
  await supabase.from('credential_sets').update({ status: 'exhausted' }).eq('id', id)
}

async function markUsed(id: string) {
  await supabase.from('credential_sets').update({ last_used_at: new Date().toISOString() }).eq('id', id)
}

async function waitForSupabaseProject(ref: string, token: string): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < 5 * 60 * 1000) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return false
    if ((await res.json()).status === 'ACTIVE_HEALTHY') return true
    await new Promise(r => setTimeout(r, 8000))
  }
  return false
}

export async function POST(req: Request) {
  const { project_id, mode, existing_creds } = await req.json()
  if (!project_id) return Response.json({ error: 'project_id requerido' }, { status: 400 })

  const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
  if (!project) return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  let supabaseUrl = '', supabaseAnonKey = '', supabaseServiceRole = '', supabaseDbPassword = ''
  let vercelProjectId = '', vercelDeployUrl = ''

  // ── Existing credentials ──────────────────────────────────────────────────
  if (mode === 'existing') {
    supabaseUrl         = existing_creds?.supabase_url || ''
    supabaseAnonKey     = existing_creds?.supabase_anon_key || ''
    supabaseServiceRole = existing_creds?.supabase_service_role_key || ''
    supabaseDbPassword  = existing_creds?.supabase_db_password || ''
  }

  // ── Create new Supabase project (with auto-switch) ────────────────────────
  if (mode === 'new_supabase') {
    let created = false
    let attempts = 0

    while (!created && attempts < 5) {
      const credSet = await getActiveCredSet('supabase')
      if (!credSet) return Response.json({ error: 'Sin cuentas de Supabase activas. Agregá una en /admin.' }, { status: 400 })

      const { management_token: token, org_id: orgId, region = 'us-east-1' } = credSet.credentials
      supabaseDbPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!9'
      const name = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 20)

      const res = await fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, organization_id: orgId, db_pass: supabaseDbPassword, region, plan: 'free' }),
      })

      if (res.ok) {
        const sbProject = await res.json()
        await markUsed(credSet.id)
        const ready = await waitForSupabaseProject(sbProject.id, token)
        if (!ready) return Response.json({ error: 'Supabase project no se activó en 5 min' }, { status: 504 })

        const keysRes = await fetch(`https://api.supabase.com/v1/projects/${sbProject.id}/api-keys`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const keys: { name: string; api_key: string }[] = await keysRes.json()
        supabaseUrl         = `https://${sbProject.id}.supabase.co`
        supabaseAnonKey     = keys.find(k => k.name === 'anon')?.api_key || ''
        supabaseServiceRole = keys.find(k => k.name === 'service_role')?.api_key || ''
        created = true
      } else {
        const err = await res.text()
        // Plan limit → exhaust and try next account
        if (res.status === 402 || err.includes('limit') || err.includes('maximum')) {
          await markExhausted(credSet.id)
          attempts++
        } else {
          return Response.json({ error: `Error Supabase: ${err}` }, { status: 500 })
        }
      }
    }

    if (!created) return Response.json({ error: 'Todas las cuentas de Supabase están agotadas' }, { status: 400 })
  }

  // ── Create Vercel project (with auto-switch) ──────────────────────────────
  const vercelSet = await getActiveCredSet('vercel')
  if (vercelSet) {
    const { token, team_id } = vercelSet.credentials
    const qs = team_id ? `?teamId=${team_id}` : ''
    const vRes = await fetch(`https://api.vercel.com/v9/projects${qs}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 52),
        framework: 'nextjs',
      }),
    })
    if (vRes.ok) {
      const vp = await vRes.json()
      vercelProjectId = vp.id
      vercelDeployUrl = `https://${vp.name}.vercel.app`
      await markUsed(vercelSet.id)
    }
  }

  // ── Save to projects table ────────────────────────────────────────────────
  const updateData: Record<string, unknown> = {
    supabase_url: supabaseUrl,
    supabase_anon_key: supabaseAnonKey,
    supabase_service_role_key: supabaseServiceRole,
    supabase_db_password: supabaseDbPassword,
    vercel_project_id: vercelProjectId,
    vercel_deploy_url: vercelDeployUrl,
    auto_deploy: true,
  }

  // Add to preview_urls if we have a deploy URL
  if (vercelDeployUrl) {
    const current: { label: string; url: string }[] = project.preview_urls || []
    if (!current.find(p => p.url === vercelDeployUrl)) {
      updateData.preview_urls = [...current, { label: 'Deploy', url: vercelDeployUrl }]
    }
    // Also log initial deploy to history
    const history: { url: string; saved_at: string; label?: string }[] = project.deploy_history || []
    if (!history.find(h => h.url === vercelDeployUrl)) {
      updateData.deploy_history = [...history, { url: vercelDeployUrl, saved_at: new Date().toISOString(), label: 'Setup inicial' }]
    }
  }

  await supabase.from('projects').update(updateData).eq('id', project_id)

  // ── Write .env.local locally if folder exists ─────────────────────────────
  if (project.folder_path && existsSync(project.folder_path)) {
    const { data: settings } = await supabase.from('settings').select('key, value')
    const s = Object.fromEntries((settings || []).map(r => [r.key, r.value || '']))

    const lines = [
      supabaseUrl         && `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
      supabaseAnonKey     && `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}`,
      supabaseServiceRole && `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceRole}`,
      supabaseDbPassword  && `DATABASE_PASSWORD=${supabaseDbPassword}`,
      s.vercel_token      && `VERCEL_TOKEN=${s.vercel_token}`,
      s.vercel_team_id    && `VERCEL_TEAM_ID=${s.vercel_team_id}`,
    ].filter(Boolean)

    if (lines.length) writeFileSync(join(project.folder_path, '.env.local'), lines.join('\n') + '\n')

    if (vercelProjectId && vercelSet) {
      const dir = join(project.folder_path, '.vercel')
      if (!existsSync(dir)) mkdirSync(dir)
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ projectId: vercelProjectId, orgId: vercelSet.credentials.team_id || '' }, null, 2))
    }
  }

  return Response.json({ ok: true, supabase_url: supabaseUrl, vercel_deploy_url: vercelDeployUrl })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const project_id = url.searchParams.get('project_id')
  if (!project_id) return Response.json({})
  const { data } = await supabase.from('projects').select(
    'supabase_url, supabase_anon_key, supabase_service_role_key, supabase_db_password, vercel_project_id, vercel_deploy_url, auto_deploy, preview_urls, deploy_history'
  ).eq('id', project_id).single()
  return Response.json(data || {})
}
