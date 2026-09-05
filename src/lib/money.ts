export const CURRENCY = 'USD'
export const LOCALE = 'es-UY'

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number): string {
  return formatter.format(Number.isFinite(amount) ? amount : 0)
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

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
