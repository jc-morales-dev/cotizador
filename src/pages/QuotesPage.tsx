import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listQuotes } from '@/lib/quotes'
import { formatDate, formatMoney } from '@/lib/money'
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from '@/components/ui'
import { ShareLink } from '@/components/ShareLink'
import type { QuoteSummary } from '@/types'

export function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setQuotes(await listQuotes())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="mt-1 text-sm text-slate-400">
            {quotes.length > 0
              ? `${quotes.length} ${quotes.length === 1 ? 'cotización' : 'cotizaciones'}`
              : 'Tus presupuestos aparecen acá.'}
          </p>
        </div>

        <Link
          to="/nueva"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
        >
          Nueva cotización
        </Link>
      </div>

      {loading && <Spinner label="Cargando cotizaciones…" />}

      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && quotes.length === 0 && (
        <EmptyState
          title="Todavía no tenés cotizaciones"
          description="Creá la primera con los ítems, el precio de cada uno y el total. Después compartís el link con tu cliente."
          action={
            <Link
              to="/nueva"
              className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
            >
              Crear la primera
            </Link>
          }
        />
      )}

      {!loading && !error && quotes.length > 0 && (
        <ul className="space-y-3">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="rounded-xl border border-line bg-surface p-5 transition hover:border-brand/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to={`/cotizacion/${quote.id}`}
                    className="text-base font-medium text-slate-100 hover:text-brand"
                  >
                    {quote.titulo}
                  </Link>
                  <p className="mt-1 text-sm text-slate-400">
                    {quote.cliente} · {formatDate(quote.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-lg font-semibold tabular-nums text-slate-100">
                    {formatMoney(quote.total)}
                  </span>
                  <StatusBadge status={quote.estado} />
                </div>
              </div>

              {quote.estado !== 'borrador' && (
                <div className="mt-4 border-t border-line pt-4">
                  <ShareLink slug={quote.slug} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
