import { centsToAmount, formatMoney, lineTotalCents, parseAmount } from '@/lib/money'
import { createDraftItem } from '@/lib/drafts'
import type { DraftItem } from '@/types'

interface Props {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
}

export function ItemsEditor({ items, onChange }: Props) {
  function update(key: string, field: keyof Omit<DraftItem, 'key'>, value: string) {
    onChange(items.map((item) => (item.key === key ? { ...item, [field]: value } : item)))
  }

  function remove(key: string) {
    onChange(items.filter((item) => item.key !== key))
  }

  const totalCents = items.reduce(
    (sum, item) => sum + lineTotalCents(parseAmount(item.cantidad), parseAmount(item.precio)),
    0,
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ítems</h2>
        <button
          type="button"
          onClick={() => onChange([...items, createDraftItem()])}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand/60 hover:text-brand"
        >
          Agregar ítem
        </button>
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-slate-500">
          Agregá al menos un ítem para poder guardar.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item, index) => {
          const lineTotal = centsToAmount(
            lineTotalCents(parseAmount(item.cantidad), parseAmount(item.precio)),
          )

          return (
            <li key={item.key} className="rounded-lg border border-line bg-ink p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end">
                <div>
                  <label
                    htmlFor={`descripcion-${item.key}`}
                    className="mb-1.5 block text-xs text-slate-400"
                  >
                    Descripción
                  </label>
                  <input
                    id={`descripcion-${item.key}`}
                    type="text"
                    value={item.descripcion}
                    onChange={(event) => update(item.key, 'descripcion', event.target.value)}
                    placeholder={`Ítem ${index + 1}`}
                    className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`cantidad-${item.key}`}
                    className="mb-1.5 block text-xs text-slate-400"
                  >
                    Cantidad
                  </label>
                  <input
                    id={`cantidad-${item.key}`}
                    type="text"
                    inputMode="decimal"
                    value={item.cantidad}
                    onChange={(event) => update(item.key, 'cantidad', event.target.value)}
                    className="w-full rounded-md border border-line bg-surface px-3 py-2 text-right text-sm tabular-nums text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`precio-${item.key}`}
                    className="mb-1.5 block text-xs text-slate-400"
                  >
                    Precio
                  </label>
                  <input
                    id={`precio-${item.key}`}
                    type="text"
                    inputMode="decimal"
                    value={item.precio}
                    onChange={(event) => update(item.key, 'precio', event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-md border border-line bg-surface px-3 py-2 text-right text-sm tabular-nums text-slate-100 placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  aria-label={`Borrar ítem ${index + 1}`}
                  className="justify-self-start rounded-md border border-line px-3 py-2 text-xs text-slate-400 transition hover:border-red-500/50 hover:text-red-300 sm:justify-self-auto"
                >
                  Borrar
                </button>
              </div>

              <p className="mt-2 text-right text-xs text-slate-500">
                Subtotal: <span className="tabular-nums text-slate-300">{formatMoney(lineTotal)}</span>
              </p>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm font-medium text-slate-400">Total</span>
        <span className="text-2xl font-semibold tabular-nums text-brand">
          {formatMoney(centsToAmount(totalCents))}
        </span>
      </div>
    </div>
  )
}
