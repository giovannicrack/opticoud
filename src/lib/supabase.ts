import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Project = {
  id: string
  name: string
  description: string
  folder_path: string
  created_at: string
}

export type Task = {
  id: string
  project_id: string
  prompt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result: string | null
  created_at: string
  updated_at: string
}
