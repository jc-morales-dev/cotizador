import type { DraftItem, QuoteItem } from '@/types'

export function createDraftItem(): DraftItem {
  return { key: crypto.randomUUID(), descripcion: '', cantidad: '1', precio: '' }
}

/**
 * Al reabrir una cotización los importes se muestran como se escribieron: con coma
 * y dos decimales. Sin esto, 240,50 volvería a pantalla como "240.5".
 */
function toEditableAmount(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function toEditableQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : toEditableAmount(value)
}

export function toDraftItems(items: QuoteItem[]): DraftItem[] {
  if (items.length === 0) return [createDraftItem()]
  return items.map((item) => ({
    key: crypto.randomUUID(),
    descripcion: item.descripcion,
    cantidad: toEditableQuantity(item.cantidad),
    precio: toEditableAmount(item.precio),
  }))
}
