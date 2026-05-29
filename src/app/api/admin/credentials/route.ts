import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const map: Record<string, string> = {}
  for (const row of data || []) map[row.key] = row.value || ''

  const masked: Record<string, string> = {}
  const hasValues: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(map)) {
    hasValues[k] = !!v
    masked[k] = v.length > 8 ? '•'.repeat(v.length - 4) + v.slice(-4) : v ? '••••' : ''
  }

  return Response.json({ credentials: masked, hasValues })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { type, ...data } = body

  if (type === 'credentials') {
    for (const [key, value] of Object.entries(data)) {
      if (value !== '' && value !== null && value !== undefined) {
        await supabase.from('settings').upsert(
          { key, value: String(value), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      }
    }
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'type inválido' }, { status: 400 })
}

export async function DELETE(req: Request) {
  const { key } = await req.json()
  if (!key) return Response.json({ error: 'key requerida' }, { status: 400 })
  await supabase.from('settings').upsert({ key, value: '', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return Response.json({ ok: true })
}
