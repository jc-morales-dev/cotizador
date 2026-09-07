import type { Moneda, QuoteTotals } from '@/types'

export const LOCALE = 'es-UY'

/** La que se propone al crear un presupuesto nuevo. */
export const MONEDA_POR_DEFECTO: Moneda = 'UYU'

/**
 * Un Intl.NumberFormat por moneda, creado una sola vez.
 *
 * Construirlo en cada llamada cuesta caro y `formatMoney` corre por cada línea en
 * cada tecla que se escribe en el editor.
 */
const formatters = new Map<Moneda, Intl.NumberFormat>()

function formatterFor(moneda: Moneda): Intl.NumberFormat {
  let formatter = formatters.get(moneda)

  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    formatters.set(moneda, formatter)
  }

  return formatter
}

export function formatMoney(amount: number, moneda: Moneda): string {
  return formatterFor(moneda).format(Number.isFinite(amount) ? amount : 0)
}

/**
 * Los importes se suman en centavos enteros y no en decimales.
 * En coma flotante 0.1 + 0.2 da 0.30000000000000004, y un presupuesto
 * que descuadra un centavo respecto al que ve el cliente no es aceptable.
 */
export function lineTotalCents(cantidad: number, precio: number): number {
  return Math.round(cantidad * precio * 100)
}

export function centsToAmount(cents: number): number {
  return cents / 100
}

/** Acepta coma o punto como separador decimal; un campo vacío vale 0. */
export function parseAmount(input: string): number {
  const normalized = input.trim().replace(',', '.')
  if (normalized === '') return 0
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function totalFromItems(items: { cantidad: number; precio: number }[]): number {
  const cents = items.reduce((sum, item) => sum + lineTotalCents(item.cantidad, item.precio), 0)
  return centsToAmount(cents)
}

/**
 * El desglose completo del presupuesto.
 *
 * Es el gemelo exacto de `totales_cotizacion` en la migración 0005: mismo orden,
 * mismo redondeo. Si los dos no dan idéntico, el editor y el documento que abre
 * el cliente muestran totales distintos, que es el peor error posible acá.
 *
 * El orden no es negociable:
 *   1. subtotal = suma de las líneas YA redondeadas al centavo
 *   2. descuento sobre el subtotal
 *   3. IVA sobre el neto, o sea después del descuento
 *
 * `descuento` e `iva` son porcentajes (22 = 22 %), no importes.
 */
export function computeTotals(
  items: { cantidad: number; precio: number }[],
  { descuento, iva }: { descuento: number; iva: number },
): QuoteTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + lineTotalCents(item.cantidad, item.precio),
    0,
  )
  const descuentoCents = Math.round((subtotalCents * descuento) / 100)
  const netoCents = subtotalCents - descuentoCents
  const ivaCents = Math.round((netoCents * iva) / 100)

  return {
    subtotal: centsToAmount(subtotalCents),
    descuento_monto: centsToAmount(descuentoCents),
    neto: centsToAmount(netoCents),
    iva_monto: centsToAmount(ivaCents),
    total: centsToAmount(netoCents + ivaCents),
  }
}

/** Igual que parseAmount pero acotado a 0-100, como exige el check de la base. */
export function parsePercent(input: string): number {
  return Math.min(100, parseAmount(input))
}
