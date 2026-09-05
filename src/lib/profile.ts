import { supabase } from './supabase'
import type { Profile } from '@/types'

/** Devuelve null si el usuario todavía no completó su perfil. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, email_contacto, telefono')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('No pudimos cargar tus datos.')
  return data ?? null
}

/** Upsert: la fila se crea la primera vez y se actualiza en las siguientes. */
export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const { error } = await supabase.from('perfiles').upsert({
    user_id: userId,
    nombre: profile.nombre.trim(),
    email_contacto: profile.email_contacto?.trim() || null,
    telefono: profile.telefono?.trim() || null,
    actualizado_at: new Date().toISOString(),
  })

  if (error) throw new Error('No pudimos guardar tus datos.')
}
