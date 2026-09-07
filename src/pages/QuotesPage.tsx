import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { duplicarCotizacion, listQuotes, updateStatus } from '@/lib/quotes'
import { formatMoney } from '@/lib/money'
import { formatDate, formatRelative } from '@/lib/fechas'
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from '@/components/ui'
import { ShareLink } from '@/components/ShareLink'
import {
  QUOTE_STATUSES,
  STATUS_LABELS,
  estadosDisponibles,
  type QuoteStatus,
  type QuoteSummary,
} from '@/types'

/** El valor de `?estado=` cuando no hay filtro. */
const TODAS = 'todas'

export function QuotesPage() {
  const navigate = useNavigate()
  // El filtro vive en la URL y no en el estado: así sobrevive al refresh, al
  // "volver" del navegador y se puede compartir o dejar en favoritos.
  const [searchParams, setSearchParams] = useSearchParams()

  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)

  const filtroCrudo = searchParams.get('estado')
  const filtro: QuoteStatus | typeof TODAS = QUOTE_STATUSES.includes(filtroCrudo as QuoteStatus)
    ? (filtroCrudo as QuoteStatus)
    : TODAS

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

  function filtrar(valor: QuoteStatus | typeof TODAS) {
    // replace: filtrar no es navegar, no tiene que llenar el historial de atrás.
    setSearchParams(valor === TODAS ? {} : { estado: valor }, { replace: true })
  }

  async function cambiarEstado(quote: QuoteSummary, estado: QuoteStatus) {
    setAccionError(null)
    // El total no depende del estado, así que alcanza con tocar esta fila:
    // recargar la lista entera haría parpadear todo por cambiar una etiqueta.
    setQuotes((actuales) => actuales.map((q) => (q.id === quote.id ? { ...q, estado } : q)))

    try {
      await updateStatus(quote.id, estado)
    } catch (caught) {
      setAccionError(caught instanceof Error ? caught.message : 'Algo salió mal.')
      setQuotes((actuales) =>
        actuales.map((q) => (q.id === quote.id ? { ...q, estado: quote.estado } : q)),
      )
    }
  }

  async function duplicar(id: string) {
    setAccionError(null)
    try {
      navigate(`/cotizacion/${await duplicarCotizacion(id)}`)
    } catch (caught) {
      setAccionError(caught instanceof Error ? caught.message : 'Algo salió mal.')
    }
  }

  const visibles = filtro === TODAS ? quotes : quotes.filter((quote) => quote.estado === filtro)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
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

      {!loading && !error && quotes.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <Filtro etiqueta="Todas" activo={filtro === TODAS} cantidad={quotes.length} onClick={() => filtrar(TODAS)} />
          {QUOTE_STATUSES.map((estado) => {
            const cantidad = quotes.filter((quote) => quote.estado === estado).length
            // Un filtro que da cero no ayuda a nadie, salvo que sea el que está puesto.
            if (cantidad === 0 && filtro !== estado) return null

            return (
              <Filtro
                key={estado}
                etiqueta={STATUS_LABELS[estado]}
                activo={filtro === estado}
                cantidad={cantidad}
                onClick={() => filtrar(estado)}
              />
            )
          })}
        </div>
      )}

      {accionError && (
        <div className="mb-4">
          <ErrorBanner message={accionError} />
        </div>
      )}

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

      {!loading && !error && quotes.length > 0 && visibles.length === 0 && (
        <EmptyState
          title="Ninguna con ese estado"
          description="Probá con otro filtro o mirá todas."
          action={
            <button
              type="button"
              onClick={() => filtrar(TODAS)}
              className="rounded-md border border-line px-4 py-2 text-sm text-slate-300 transition hover:text-slate-100"
            >
              Ver todas
            </button>
          }
        />
      )}

      {visibles.length > 0 && (
        <ul className="space-y-3">
          {visibles.map((quote) => (
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
                    #{quote.numero} · {quote.cliente} · {formatDate(quote.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-lg font-semibold tabular-nums text-slate-100">
                    {formatMoney(quote.total, quote.moneda)}
                  </span>
                  <StatusBadge status={quote.estado} />
                </div>
              </div>

              <Seguimiento quote={quote} />

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <SelectorDeEstado quote={quote} onCambiar={cambiarEstado} />

                <button
                  type="button"
                  onClick={() => duplicar(quote.id)}
                  className="rounded-md border border-line px-3 py-1.5 text-xs text-slate-400 transition hover:border-brand/60 hover:text-brand"
                >
                  Duplicar
                </button>

                {quote.estado !== 'borrador' && (
                  <div className="w-full sm:ml-auto sm:w-auto">
                    <ShareLink slug={quote.slug} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Filtro({
  etiqueta,
  activo,
  cantidad,
  onClick,
}: {
  etiqueta: string
  activo: boolean
  cantidad: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        activo
          ? 'border-brand/60 bg-brand/15 text-brand'
          : 'border-line text-slate-400 hover:text-slate-100'
      }`}
    >
      {etiqueta} <span className="tabular-nums opacity-60">{cantidad}</span>
    </button>
  )
}

/**
 * Cambiar el estado sin abrir el editor, que era el motivo por el que se abría
 * el editor casi siempre.
 *
 * Las opciones salen de `estadosDisponibles`: si el cliente ya respondió por el
 * link, acá no se puede contradecir. Cuando queda una sola opción el selector se
 * deshabilita, para que se vea que está trabado y no parezca que no anda.
 */
function SelectorDeEstado({
  quote,
  onCambiar,
}: {
  quote: QuoteSummary
  onCambiar: (quote: QuoteSummary, estado: QuoteStatus) => void
}) {
  const opciones = estadosDisponibles(quote.estado, quote.respondido_at !== null)

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="sr-only sm:not-sr-only">Estado</span>
      <select
        value={quote.estado}
        disabled={opciones.length < 2}
        onChange={(event) => onCambiar(quote, event.target.value as QuoteStatus)}
        aria-label={`Estado de ${quote.titulo}`}
        className="rounded-md border border-line bg-ink px-2.5 py-1.5 text-xs text-slate-200 disabled:opacity-50"
      >
        {opciones.map((estado) => (
          <option key={estado} value={estado}>
            {STATUS_LABELS[estado]}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Lo que uno vino a mirar al panel: si el cliente lo abrió y qué contestó.
 *
 * Una respuesta tapa a las visitas porque ya las hace irrelevantes: si te dijeron
 * que sí, cuántas veces lo miraron antes deja de importar.
 */
function Seguimiento({ quote }: { quote: QuoteSummary }) {
  if (quote.respondido_at) {
    const aprobada = quote.estado === 'aprobada' || quote.estado === 'cobrada'

    return (
      <div className="mt-3 text-sm">
        <p className={aprobada ? 'text-emerald-300' : 'text-rose-300'}>
          {aprobada ? 'Aprobada' : 'Rechazada'} por {quote.respondido_por} ·{' '}
          {formatRelative(quote.respondido_at)}
        </p>
        {quote.comentario_cliente && (
          <p className="mt-1 text-slate-400">“{quote.comentario_cliente}”</p>
        )}
      </div>
    )
  }

  // En borrador el link no muestra nada, así que "sin abrir" sería ruido.
  if (quote.estado === 'borrador') return null

  if (!quote.ultima_vista) {
    return <p className="mt-3 text-sm text-slate-500">El cliente todavía no lo abrió.</p>
  }

  return (
    <p className="mt-3 text-sm text-slate-400">
      Visto {formatRelative(quote.ultima_vista)}
      {quote.veces_vista > 1 && (
        <span className="text-slate-500"> · {quote.veces_vista} veces</span>
      )}
    </p>
  )
}
