import { supabase } from './supabase'
import type { PublicQuote, Quote, QuoteItem, QuoteStatus, QuoteSummary } from '@/types'

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

export async function listQuotes(): Promise<QuoteSummary[]> {
  const { data, error } = await supabase
    .from('cotizaciones_con_total')
    .select('id, cliente, titulo, estado, slug, created_at, total')
    .order('created_at', { ascending: false })

  if (error) throw new Error('No pudimos cargar tus cotizaciones. Revisá tu conexión e intentá de nuevo.')

  return (data ?? []).map((row) => ({
    id: row.id,
    cliente: row.cliente,
    titulo: row.titulo,
    estado: row.estado as QuoteStatus,
    slug: row.slug,
    created_at: row.created_at,
    total: toNumber(row.total),
  }))
}

export async function getQuote(id: string): Promise<Quote> {
  const { data, error } = await supabase
    .from('cotizaciones_con_total')
    .select('id, cliente, titulo, estado, slug, created_at, total, items(descripcion, cantidad, precio, posicion)')
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
    id: data.id,
    cliente: data.cliente,
    titulo: data.titulo,
    estado: data.estado as QuoteStatus,
    slug: data.slug,
    created_at: data.created_at,
    total: toNumber(data.total),
    items,
  }
}

interface SaveQuoteInput {
  id?: string | null
  cliente: string
  titulo: string
  estado: QuoteStatus
  items: QuoteItem[]
}

/** Una sola RPC transaccional: o se guardan la cabecera y todas las líneas, o no se guarda nada. */
export async function saveQuote(input: SaveQuoteInput): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_cotizacion', {
    p_id: input.id ?? null,
    p_cliente: input.cliente.trim(),
    p_titulo: input.titulo.trim(),
    p_estado: input.estado,
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
 * Única puerta de entrada para visitantes sin cuenta.
 * Devuelve null tanto si el slug no existe como si la cotización sigue en borrador:
 * el visitante no debe poder distinguir un caso del otro.
 */
export async function getPublicQuote(slug: string): Promise<PublicQuote | null> {
  const { data, error } = await supabase.rpc('cotizacion_publica', { p_slug: slug })

  if (error) throw new Error('No pudimos cargar el presupuesto.')
  if (!data) return null

  return {
    cliente: data.cliente,
    titulo: data.titulo,
    estado: data.estado as QuoteStatus,
    slug: data.slug,
    created_at: data.created_at,
    items: mapItems(data.items),
    total: toNumber(data.total),
  }
}
