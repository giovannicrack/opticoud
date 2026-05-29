import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { project_id, prompt } = body

  if (!prompt) return Response.json({ error: 'prompt requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id, prompt, status: 'pending' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
