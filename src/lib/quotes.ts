import { supabase } from './supabase'
import type {
  Moneda,
  PublicQuote,
  Quote,
  QuoteItem,
  QuoteStatus,
  QuoteSummary,
  Respuesta,
} from '@/types'

/** Postgres devuelve `numeric` como número, pero si algún día llega como texto no queremos NaN en pantalla. */
function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => ({
    descripcion: String(item?.descripcion ?? ''),
    cantidad: toNumber(item?.cantidad),
    precio: toNumber(item?.precio),
  }))
}

/**
 * Las columnas de la vista que necesita cualquier pantalla de la lista.
 *
 * Va en UN literal y no concatenado: supabase-js lee esta cadena en tiempo de
 * tipos para saber qué devuelve el select, y con una concatenación el tipo pasa
 * a ser `string` y las filas vuelven como GenericStringError.
 */
const COLUMNAS_RESUMEN =
  'id, numero, cliente, cliente_id, cliente_email, titulo, estado, slug, created_at, moneda, descuento, iva, valido_hasta, respondido_at, respondido_por, comentario_cliente, ultima_vista, veces_vista, subtotal, descuento_monto, neto, iva_monto, total'

interface FilaResumen {
  id: string
  numero: number
  cliente: string
  cliente_id: string | null
  cliente_email: string | null
  titulo: string
  estado: string
  slug: string
  created_at: string
  moneda: string
  descuento: unknown
  iva: unknown
  valido_hasta: string | null
  respondido_at: string | null
  respondido_por: string | null
  comentario_cliente: string | null
  ultima_vista: string | null
  veces_vista: unknown
  subtotal: unknown
  descuento_monto: unknown
  neto: unknown
  iva_monto: unknown
  total: unknown
}

function mapResumen(row: FilaResumen): QuoteSummary {
  return {
    id: row.id,
    numero: row.numero,
    cliente: row.cliente,
    cliente_id: row.cliente_id,
    cliente_email: row.cliente_email,
    titulo: row.titulo,
    estado: row.estado as QuoteStatus,
    slug: row.slug,
    created_at: row.created_at,
    moneda: row.moneda as Moneda,
    descuento: toNumber(row.descuento),
    iva: toNumber(row.iva),
    valido_hasta: row.valido_hasta,
    respondido_at: row.respondido_at,
    respondido_por: row.respondido_por,
    comentario_cliente: row.comentario_cliente,
    ultima_vista: row.ultima_vista,
    veces_vista: toNumber(row.veces_vista),
    subtotal: toNumber(row.subtotal),
    descuento_monto: toNumber(row.descuento_monto),
    neto: toNumber(row.neto),
    iva_monto: toNumber(row.iva_monto),
    total: toNumber(row.total),
  }
}

export async function listQuotes(): Promise<QuoteSummary[]> {
  const { data, error } = await supabase
    .from('cotizaciones_con_total')
    .select(COLUMNAS_RESUMEN)
    .order('created_at', { ascending: false })

  if (error) throw new Error('No pudimos cargar tus cotizaciones. Revisá tu conexión e intentá de nuevo.')

  return (data ?? []).map(mapResumen)
}

export async function getQuote(id: string): Promise<Quote> {
  const { data, error } = await supabase
    .from('cotizaciones_con_total')
    .select(`${COLUMNAS_RESUMEN}, notas, condiciones, items(descripcion, cantidad, precio, posicion)`)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('No pudimos cargar la cotización.')
  if (!data) throw new Error('Esa cotización no existe o no es tuya.')

  const items = [...(data.items ?? [])]
    .sort((a, b) => a.posicion - b.posicion)
    .map((item) => ({
      descripcion: item.descripcion,
      cantidad: toNumber(item.cantidad),
      precio: toNumber(item.precio),
    }))

  return {
    ...mapResumen(data),
    notas: data.notas,
    condiciones: data.condiciones,
    items,
  }
}

interface SaveQuoteInput {
  id?: string | null
  cliente: string
  cliente_email: string | null
  titulo: string
  estado: QuoteStatus
  moneda: Moneda
  descuento: number
  iva: number
  valido_hasta: string | null
  notas: string | null
  condiciones: string | null
  items: QuoteItem[]
}

/** Una sola RPC transaccional: o se guardan la cabecera y todas las líneas, o no se guarda nada. */
export async function saveQuote(input: SaveQuoteInput): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_cotizacion', {
    p_id: input.id ?? null,
    p_cliente: input.cliente.trim(),
    p_cliente_email: input.cliente_email,
    p_titulo: input.titulo.trim(),
    p_estado: input.estado,
    p_moneda: input.moneda,
    p_descuento: input.descuento,
    p_iva: input.iva,
    p_valido_hasta: input.valido_hasta,
    p_notas: input.notas,
    p_condiciones: input.condiciones,
    p_items: input.items,
  })

  if (error) throw new Error('No pudimos guardar la cotización. Revisá los datos e intentá de nuevo.')
  return data as string
}

export async function updateStatus(id: string, estado: QuoteStatus): Promise<void> {
  const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', id)
  if (error) throw new Error('No pudimos cambiar el estado.')
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) throw new Error('No pudimos borrar la cotización.')
}

/**
 * Única puerta de LECTURA para visitantes sin cuenta.
 * Devuelve null tanto si el slug no existe como si la cotización sigue en borrador:
 * el visitante no debe poder distinguir un caso del otro.
 */
export async function getPublicQuote(slug: string): Promise<PublicQuote | null> {
  const { data, error } = await supabase.rpc('cotizacion_publica', { p_slug: slug })

  if (error) throw new Error('No pudimos cargar el presupuesto.')
  if (!data) return null

  return {
    numero: data.numero,
    cliente: data.cliente,
    titulo: data.titulo,
    estado: data.estado as QuoteStatus,
    slug: data.slug,
    created_at: data.created_at,
    moneda: data.moneda as Moneda,
    descuento: toNumber(data.descuento),
    iva: toNumber(data.iva),
    valido_hasta: data.valido_hasta ?? null,
    notas: data.notas ?? null,
    condiciones: data.condiciones ?? null,
    respondido_at: data.respondido_at ?? null,
    respondido_por: data.respondido_por ?? null,
    comentario_cliente: data.comentario_cliente ?? null,
    emisor: data.emisor
      ? {
          nombre: String(data.emisor.nombre ?? ''),
          email_contacto: data.emisor.email_contacto ?? null,
          telefono: data.emisor.telefono ?? null,
        }
      : null,
    items: mapItems(data.items),
    subtotal: toNumber(data.subtotal),
    descuento_monto: toNumber(data.descuento_monto),
    neto: toNumber(data.neto),
    iva_monto: toNumber(data.iva_monto),
    total: toNumber(data.total),
  }
}

/**
 * Única puerta de ESCRITURA para visitantes sin cuenta.
 *
 * Devuelve el estado nuevo, o null si la respuesta no aplicaba —porque el
 * presupuesto no existe, sigue en borrador o ya fue respondido—. Los tres casos
 * dan null a propósito: desde fuera no se puede deducir cuál fue.
 */
export async function responderCotizacion(
  slug: string,
  respuesta: Respuesta,
  nombre: string,
  comentario: string,
): Promise<QuoteStatus | null> {
  const { data, error } = await supabase.rpc('responder_cotizacion', {
    p_slug: slug,
    p_respuesta: respuesta,
    p_nombre: nombre.trim(),
    p_comentario: comentario.trim() || null,
  })

  if (error) throw new Error('No pudimos registrar tu respuesta. Intentá de nuevo.')
  return (data as QuoteStatus | null) ?? null
}

/**
 * Deja constancia de que alguien abrió el link.
 *
 * No devuelve nada y no debe romper la página: si falla, el cliente igual tiene
 * que poder leer su presupuesto. La base ignora sola las recargas seguidas y las
 * visitas del propio dueño.
 */
export async function registrarVista(slug: string): Promise<void> {
  await supabase.rpc('registrar_vista', { p_slug: slug })
}

/**
 * Copia cabecera e ítems en una cotización nueva: slug y número propios, en
 * borrador y sin la respuesta del cliente anterior. Devuelve el id de la copia
 * para poder abrirla enseguida en el editor.
 */
export async function duplicarCotizacion(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicar_cotizacion', { p_id: id })

  if (error) throw new Error('No pudimos duplicar la cotización.')
  return data as string
}
