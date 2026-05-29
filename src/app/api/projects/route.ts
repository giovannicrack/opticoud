import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!projects?.length) return Response.json([])

  // Get task counts for each project
  const { data: taskCounts } = await supabase
    .from('tasks')
    .select('project_id, status')
    .in('project_id', projects.map(p => p.id))

  const countMap: Record<string, { task_count: number; running: number }> = {}
  for (const task of taskCounts || []) {
    if (!countMap[task.project_id]) countMap[task.project_id] = { task_count: 0, running: 0 }
    countMap[task.project_id].task_count++
    if (task.status === 'running') countMap[task.project_id].running++
  }

  const enriched = projects.map(p => ({
    ...p,
    task_count: countMap[p.id]?.task_count ?? 0,
    running: countMap[p.id]?.running ?? 0,
  }))

  return Response.json(enriched)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, description, folder_path } = body

  if (!name) return Response.json({ error: 'name requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, folder_path })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
