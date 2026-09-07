export type QuoteStatus = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'cobrada'

/**
 * El orden importa: es el ciclo de vida que se muestra en el selector.
 * `rechazada` va al final porque es la salida, no un paso del camino.
 */
export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'borrador',
  'enviada',
  'aprobada',
  'cobrada',
  'rechazada',
]

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cobrada: 'Cobrada',
}

/** Las mismas cuatro que acepta el check de `moneda` en la migración 0005. */
export const MONEDAS = ['UYU', 'USD', 'ARS', 'EUR'] as const

export type Moneda = (typeof MONEDAS)[number]

export const MONEDA_LABELS: Record<Moneda, string> = {
  UYU: 'Pesos uruguayos',
  USD: 'Dólares',
  ARS: 'Pesos argentinos',
  EUR: 'Euros',
}

export interface QuoteItem {
  descripcion: string
  cantidad: number
  precio: number
}

/**
 * El desglose del presupuesto, en el orden en que se lee:
 * subtotal → descuento → neto → IVA → total.
 *
 * Lo calculan `computeTotals` en el navegador y `totales_cotizacion` en Postgres,
 * con la misma fórmula y el mismo redondeo. Si divergen, el editor y el documento
 * que ve el cliente muestran números distintos.
 */
export interface QuoteTotals {
  subtotal: number
  descuento_monto: number
  neto: number
  iva_monto: number
  total: number
}

/** Lo que el cliente contestó desde el link público. Null mientras no contestó. */
export interface QuoteResponse {
  respondido_at: string | null
  respondido_por: string | null
  comentario_cliente: string | null
}

/** Fila de la lista. Los importes y las visitas los calcula cotizaciones_con_total. */
export interface QuoteSummary extends QuoteTotals, QuoteResponse {
  id: string
  numero: number
  cliente: string
  /** Null si la ficha del cliente se borró; el nombre de arriba igual queda. */
  cliente_id: string | null
  /** El email ACTUAL de la ficha, no el de cuando se emitió. */
  cliente_email: string | null
  titulo: string
  estado: QuoteStatus
  slug: string
  created_at: string
  moneda: Moneda
  /** Porcentajes, no importes. */
  descuento: number
  iva: number
  valido_hasta: string | null
  /** Null si nadie abrió el link todavía. */
  ultima_vista: string | null
  veces_vista: number
}

export interface Quote extends QuoteSummary {
  notas: string | null
  condiciones: string | null
  items: QuoteItem[]
}

/** Datos de quien emite el presupuesto, tal como los ve el cliente. */
export interface Profile {
  nombre: string
  email_contacto: string | null
  telefono: string | null
}

/** Lo que devuelve la RPC pública: sin id ni user_id, el cliente no necesita identificadores internos. */
export interface PublicQuote extends QuoteTotals, QuoteResponse {
  numero: number
  cliente: string
  titulo: string
  estado: QuoteStatus
  slug: string
  created_at: string
  moneda: Moneda
  descuento: number
  iva: number
  valido_hasta: string | null
  notas: string | null
  condiciones: string | null
  /** Null mientras el dueño no haya completado su perfil. */
  emisor: Profile | null
  items: QuoteItem[]
}

/** Lo único que el cliente puede contestar. */
export type Respuesta = Extract<QuoteStatus, 'aprobada' | 'rechazada'>

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

/**
 * Los estados que el dueño puede elegir a mano desde el panel o el editor.
 *
 * Mientras el cliente no haya respondido, todos: un "no" por teléfono también
 * cuenta. Una vez que respondió por el link, el panel no puede contradecirlo —
 * devolver a borrador algo ya aceptado reabriría un link que la persona contestó,
 * y dar vuelta un rechazo convierte la constancia en un adorno.
 *
 * Aprobada → cobrada sí queda habilitado: es el paso siguiente normal.
 *
 * Esto es la mitad visible de la regla. La que manda es el trigger
 * `cotizaciones_respuesta_inmutable` de la migración 0007: acá se esconden las
 * opciones para que no haya que explicar un error, allá se garantiza.
 */
export function estadosDisponibles(
  estado: QuoteStatus,
  respondido: boolean,
): readonly QuoteStatus[] {
  if (!respondido) return QUOTE_STATUSES
  if (estado === 'rechazada') return ['rechazada']
  return ['aprobada', 'cobrada']
}
