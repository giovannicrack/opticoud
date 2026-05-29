import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: returns the self-project if it exists
// POST: creates it if it doesn't, returns it either way
export async function GET() {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('is_self', true)
    .limit(1)
    .single()
  if (!data) return Response.json(null)
  return Response.json(data)
}

export async function POST() {
  // Check if already exists
  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .eq('is_self', true)
    .limit(1)
    .single()

  if (existing) return Response.json(existing)

  // process.cwd() in Next.js = project root
  const folder_path = process.cwd()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: 'OptiCoud',
      description: 'El sistema mismo. Las tareas aquí mejoran la plataforma OptiCoud.',
      folder_path,
      is_self: true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
