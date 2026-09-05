import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fallar aquí y no en la primera consulta: si faltan las variables, el error
// aparece al abrir la app y no como un "no se pudo cargar" difuso más tarde.
if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completalas.',
  )
}

export const supabase = createClient(url, anonKey)
