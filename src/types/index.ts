export type QuoteStatus = 'borrador' | 'enviada' | 'aprobada' | 'cobrada'

/** El orden importa: es el ciclo de vida que se muestra en la lista y en el selector. */
export const QUOTE_STATUSES: readonly QuoteStatus[] = ['borrador', 'enviada', 'aprobada', 'cobrada']

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  cobrada: 'Cobrada',
}

export interface QuoteItem {
  descripcion: string
  cantidad: number
  precio: number
}

/** Fila de la lista. `total` lo calcula la vista cotizaciones_con_total en Postgres. */
export interface QuoteSummary {
  id: string
  cliente: string
  titulo: string
  estado: QuoteStatus
  slug: string
  created_at: string
  total: number
}

export interface Quote extends QuoteSummary {
  items: QuoteItem[]
}

/** Datos de quien emite el presupuesto, tal como los ve el cliente. */
export interface Profile {
  nombre: string
  email_contacto: string | null
  telefono: string | null
}

/** Lo que devuelve la RPC pública: sin id ni user_id, el cliente no necesita identificadores internos. */
export interface PublicQuote {
  cliente: string
  titulo: string
  estado: QuoteStatus
  slug: string
  created_at: string
  /** Null mientras el dueño no haya completado su perfil. */
  emisor: Profile | null
  items: QuoteItem[]
  total: number
}

/**
 * Los inputs del editor guardan texto, no números: si convirtiéramos en cada tecla,
 * borrar el contenido de un campo lo dejaría en NaN o saltaría a 0 mientras se escribe.
 */
export interface DraftItem {
  key: string
  descripcion: string
  cantidad: string
  precio: string
}
