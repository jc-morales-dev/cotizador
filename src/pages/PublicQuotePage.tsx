import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicQuote } from '@/lib/quotes'
import { centsToAmount, formatDate, formatMoney, lineTotalCents } from '@/lib/money'
import { STATUS_LABELS, type PublicQuote } from '@/types'

export function PublicQuotePage() {
  const { slug } = useParams<{ slug: string }>()
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')

  const load = useCallback(async () => {
    if (!slug) return
    setStatus('loading')
    try {
      const result = await getPublicQuote(slug)
      if (!result) {
        setStatus('missing')
        return
      }
      setQuote(result)
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (quote) document.title = `${quote.titulo} — ${quote.cliente}`
  }, [quote])

  if (status === 'loading') {
    return (
      <Shell>
        <p className="py-20 text-center text-sm text-slate-500" role="status">
          Cargando el presupuesto…
        </p>
      </Shell>
    )
  }

  // Un borrador y un slug inventado dan exactamente el mismo mensaje:
  // desde fuera no se puede deducir si la cotización existe.
  if (status === 'missing') {
    return (
      <Shell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Este presupuesto no está disponible</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">
            El link puede haber cambiado o el presupuesto todavía no fue compartido. Consultá con quien
            te lo envió.
          </p>
        </div>
      </Shell>
    )
  }

  if (status === 'error' || !quote) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold text-slate-900">No pudimos cargar el presupuesto</h1>
          <p className="mt-3 text-sm text-slate-500">Revisá tu conexión e intentá de nuevo.</p>
          <button
            type="button"
            onClick={load}
            className="no-print mt-6 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reintentar
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Presupuesto</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {STATUS_LABELS[quote.estado]}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">
          {quote.titulo}
        </h1>

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-400">Para</dt>
            <dd className="font-medium text-slate-800">{quote.cliente}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Fecha</dt>
            <dd className="font-medium text-slate-800">{formatDate(quote.created_at)}</dd>
          </div>
        </dl>
      </header>

      <table className="mt-8 w-full text-sm">
        <caption className="sr-only">Detalle de ítems del presupuesto</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th scope="col" className="pb-3 font-medium">
              Detalle
            </th>
            <th scope="col" className="pb-3 pl-4 text-right font-medium">
              Cant.
            </th>
            <th scope="col" className="hidden pb-3 pl-6 text-right font-medium sm:table-cell">
              Precio
            </th>
            <th scope="col" className="pb-3 text-right font-medium">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, index) => (
            <tr key={index} className="border-b border-slate-100 align-top">
              <td className="py-3 pr-4 text-slate-800">
                {item.descripcion}
                <span className="mt-0.5 block text-xs text-slate-400 sm:hidden">
                  {formatMoney(item.precio)} c/u
                </span>
              </td>
              <td className="py-3 pl-4 text-right tabular-nums text-slate-600">{item.cantidad}</td>
              <td className="hidden py-3 pl-6 text-right tabular-nums text-slate-600 sm:table-cell">
                {formatMoney(item.precio)}
              </td>
              <td className="py-3 pl-4 text-right tabular-nums font-medium text-slate-900">
                {formatMoney(centsToAmount(lineTotalCents(item.cantidad, item.precio)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-baseline justify-between border-t-2 border-slate-900 pt-4">
        <span className="text-sm font-medium uppercase tracking-wide text-slate-500">Total</span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
          {formatMoney(quote.total)}
        </span>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <p className="text-xs text-slate-400">
          Presupuesto generado con <span className="font-medium text-slate-500">Coti</span>
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Imprimir o guardar en PDF
        </button>
      </footer>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-8 sm:py-16">
      <div className="documento mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        {children}
      </div>
    </div>
  )
}
