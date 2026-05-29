import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: Request, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const body = await req.json()
  const { data, error } = await supabase.from('projects').update(body).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
