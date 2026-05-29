import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  authToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const { project_id, idea } = await req.json()
  if (!project_id || !idea?.trim()) {
    return Response.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Fetch project info
  const { data: project } = await supabase
    .from('projects')
    .select('name, description, folder_path')
    .eq('id', project_id)
    .single()

  if (!project) return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Fetch completed task history for context
  const { data: history } = await supabase
    .from('tasks')
    .select('prompt, result')
    .eq('project_id', project_id)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(15)

  const historyBlock = history?.length
    ? [
        'LO QUE YA SE CONSTRUYÓ EN ESTE PROYECTO (contexto):',
        ...history.map((t, i) => `  ${i + 1}. ${t.prompt.slice(0, 200)}`),
        '',
      ].join('\n')
    : ''

  const systemPrompt = `Sos un product owner técnico y arquitecto de software senior. Tu trabajo es descomponer ideas de apps en tareas concretas y ordenadas que Claude Code puede ejecutar directamente en una terminal.

Reglas para las tareas:
- Cada tarea debe ser ejecutable de forma independiente por Claude Code
- Incluir detalles técnicos: nombres de tablas, componentes, endpoints, etc.
- Orden lógico: schema/setup → lógica de negocio → UI → deploy
- Duración estimada por tarea: 5 a 20 minutos de ejecución de Claude
- Si hay historial, NO repetir lo que ya está hecho — construir encima
- La última tarea siempre debe ser "deployar a Vercel y devolver la URL"

Devolvé ÚNICAMENTE un JSON array de strings, sin texto adicional, sin markdown, sin explicaciones.
Ejemplo: ["Crear tabla X en Supabase con columnas Y y Z y habilitar RLS", "Construir componente React para listar X con filtros por Y", ...]`

  const userMessage = [
    `PROYECTO: ${project.name}`,
    project.description ? `DESCRIPCIÓN: ${project.description}` : '',
    project.folder_path ? `CARPETA: ${project.folder_path}` : '',
    'STACK: Next.js App Router + Supabase + Tailwind CSS',
    '',
    historyBlock,
    'IDEA / FEATURE A IMPLEMENTAR:',
    idea.trim(),
    '',
    'Genera entre 6 y 14 tareas de desarrollo ordenadas lógicamente.',
  ].filter(Boolean).join('\n')

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = (message.content[0] as { text: string }).text.trim()

    // Extract JSON array from response (handles markdown code blocks too)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return Response.json({ error: 'No se pudo parsear la respuesta de la IA' }, { status: 500 })

    const tasks: string[] = JSON.parse(jsonMatch[0])
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return Response.json({ error: 'La IA devolvió una lista vacía' }, { status: 500 })
    }

    return Response.json({ tasks })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: message }, { status: 500 })
  }
}
