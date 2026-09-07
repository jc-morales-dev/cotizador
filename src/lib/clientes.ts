import { supabase } from './supabase'

export interface Cliente {
  id: string
  nombre: string
  email: string | null
}

/**
 * Los clientes ya usados, para autocompletar en el editor.
 *
 * No hay pantalla de alta a propósito: escribís un nombre nuevo en el campo de
 * siempre y `guardar_cotizacion` crea la ficha sola. Esto es solo para no
 * retipear los que ya existen.
 */
export async function listClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, email')
    .order('nombre')

  // Que falle el autocompletado no es motivo para romper el editor: se puede
  // escribir el nombre a mano igual.
  if (error) return []

  return data ?? []
}
