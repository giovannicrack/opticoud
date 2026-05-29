import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function maskCreds(credentials: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(credentials)) {
    out[k] = v.length > 8 ? '•'.repeat(v.length - 4) + v.slice(-4) : v ? '••••' : ''
  }
  return out
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const provider = url.searchParams.get('provider')
  let query = supabase.from('credential_sets').select('*').order('priority').order('created_at')
  if (provider) query = query.eq('provider', provider)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // Mask secrets for display
  const masked = (data || []).map(row => ({
    ...row,
    credentials: maskCreds(row.credentials),
  }))
  return Response.json(masked)
}

export async function POST(req: Request) {
  const { provider, label, credentials, priority } = await req.json()
  if (!provider || !label) return Response.json({ error: 'provider y label requeridos' }, { status: 400 })
  const { data, error } = await supabase
    .from('credential_sets')
    .insert({ provider, label, credentials: credentials || {}, priority: priority ?? 0 })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
