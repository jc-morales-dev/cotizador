import { useCallback, useEffect, useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicQuote, registrarVista, responderCotizacion } from '@/lib/quotes'
import { centsToAmount, formatMoney, lineTotalCents } from '@/lib/money'
import { estaVencido, formatDate, formatDateOnly } from '@/lib/fechas'
import { STATUS_LABELS, type PublicQuote, type Respuesta } from '@/types'

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

  // Deja constancia de que el link se abrió. Va aparte de la carga y sin await:
  // si esto falla, el cliente igual tiene que poder leer su presupuesto.
  // La base ignora sola las recargas seguidas y las visitas del propio dueño.
  useEffect(() => {
    if (!slug) return
    registrarVista(slug).catch(() => {})
  }, [slug])

  useEffect(() => {
    if (quote) document.title = `Presupuesto #${quote.numero} — ${quote.cliente}`
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

  // Con descuento e IVA en cero, el desglose son tres renglones que repiten el total.
  const hayDesglose = quote.descuento > 0 || quote.iva > 0
  const vencido = estaVencido(quote.valido_hasta)

  return (
    <Shell>
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Presupuesto #{quote.numero}
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {STATUS_LABELS[quote.estado]}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">
          {quote.titulo}
        </h1>

        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          {quote.emisor && (
            <div>
              <dt className="text-slate-400">De</dt>
              <dd className="font-medium text-slate-800">{quote.emisor.nombre}</dd>
              {quote.emisor.email_contacto && (
                <dd className="mt-0.5 text-slate-500">
                  <a
                    href={`mailto:${quote.emisor.email_contacto}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {quote.emisor.email_contacto}
                  </a>
                </dd>
              )}
              {quote.emisor.telefono && (
                <dd className="mt-0.5 text-slate-500">{quote.emisor.telefono}</dd>
              )}
            </div>
          )}
          <div>
            <dt className="text-slate-400">Para</dt>
            <dd className="font-medium text-slate-800">{quote.cliente}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Fecha</dt>
            <dd className="font-medium text-slate-800">{formatDate(quote.created_at)}</dd>
          </div>
          {quote.valido_hasta && (
            <div>
              <dt className="text-slate-400">Válido hasta</dt>
              <dd className={`font-medium ${vencido ? 'text-amber-700' : 'text-slate-800'}`}>
                {formatDateOnly(quote.valido_hasta)}
              </dd>
            </div>
          )}
        </dl>
      </header>

      {/* Vencido no lo esconde: el cliente tiene que poder leerlo igual, con el aviso. */}
      {vencido && !quote.respondido_at && (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este presupuesto venció. Consultá con quien te lo envió si los precios siguen vigentes.
        </p>
      )}

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
                  {formatMoney(item.precio, quote.moneda)} c/u
                </span>
              </td>
              <td className="py-3 pl-4 text-right tabular-nums text-slate-600">{item.cantidad}</td>
              <td className="hidden py-3 pl-6 text-right tabular-nums text-slate-600 sm:table-cell">
                {formatMoney(item.precio, quote.moneda)}
              </td>
              <td className="py-3 pl-4 text-right tabular-nums font-medium text-slate-900">
                {formatMoney(centsToAmount(lineTotalCents(item.cantidad, item.precio)), quote.moneda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Los importes vienen calculados de la base; acá no se recalcula nada. */}
      {hayDesglose && (
        <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex items-center justify-between gap-8">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="tabular-nums text-slate-800">
              {formatMoney(quote.subtotal, quote.moneda)}
            </dd>
          </div>

          {quote.descuento > 0 && (
            <div className="flex items-center justify-between gap-8">
              <dt className="text-slate-500">Descuento ({quote.descuento} %)</dt>
              <dd className="tabular-nums text-slate-800">
                −{formatMoney(quote.descuento_monto, quote.moneda)}
              </dd>
            </div>
          )}

          {quote.iva > 0 && (
            <div className="flex items-center justify-between gap-8">
              <dt className="text-slate-500">IVA ({quote.iva} %)</dt>
              <dd className="tabular-nums text-slate-800">
                {formatMoney(quote.iva_monto, quote.moneda)}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-6 flex items-baseline justify-between border-t-2 border-slate-900 pt-4">
        <span className="text-sm font-medium uppercase tracking-wide text-slate-500">Total</span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl" data-testid="total-publico">
          {formatMoney(quote.total, quote.moneda)}
        </span>
      </div>

      {quote.respondido_at ? (
        <Sello quote={quote} />
      ) : (
        quote.estado === 'enviada' && <BloqueRespuesta slug={quote.slug} onRespondido={load} />
      )}

      {(quote.notas || quote.condiciones) && (
        <div className="mt-8 space-y-5 border-t border-slate-200 pt-6">
          {quote.notas && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">Notas</h2>
              {/* whitespace-pre-line: los saltos de línea que escribió el emisor son parte del texto. */}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {quote.notas}
              </p>
            </div>
          )}

          {quote.condiciones && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Condiciones
              </h2>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                {quote.condiciones}
              </p>
            </div>
          )}
        </div>
      )}

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

/**
 * La constancia de lo que se respondió. Sí se imprime: es la parte del documento
 * que dice quién aceptó y cuándo.
 */
function Sello({ quote }: { quote: PublicQuote }) {
  const aprobada = quote.estado === 'aprobada' || quote.estado === 'cobrada'

  return (
    <div
      className={`mt-8 rounded-lg border px-5 py-4 ${
        aprobada ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
      }`}
    >
      <p className={`text-sm font-medium ${aprobada ? 'text-emerald-900' : 'text-rose-900'}`}>
        {aprobada ? 'Presupuesto aprobado' : 'Presupuesto rechazado'} por {quote.respondido_por}
      </p>
      <p className={`mt-1 text-xs ${aprobada ? 'text-emerald-700' : 'text-rose-700'}`}>
        {formatDate(quote.respondido_at!)}
      </p>
      {quote.comentario_cliente && (
        <p
          className={`mt-3 whitespace-pre-line border-t pt-3 text-sm ${
            aprobada ? 'border-emerald-200 text-emerald-800' : 'border-rose-200 text-rose-800'
          }`}
        >
          “{quote.comentario_cliente}”
        </p>
      )}
    </div>
  )
}

/**
 * El bloque que convierte el link en algo más que un visor.
 *
 * No se imprime: en el PDF sobra, y lo que importa ahí es el sello de la respuesta.
 */
function BloqueRespuesta({ slug, onRespondido }: { slug: string; onRespondido: () => void }) {
  const nombreId = useId()
  const comentarioId = useId()

  const [nombre, setNombre] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function responder(respuesta: Respuesta) {
    if (nombre.trim() === '') {
      setError('Escribí tu nombre para dejar constancia de quién responde.')
      return
    }

    setError(null)
    setEnviando(respuesta)

    try {
      const resultado = await responderCotizacion(slug, respuesta, nombre, comentario)

      if (!resultado) {
        // Null puede ser "ya lo respondieron", "está en borrador" o "no existe".
        // Un solo mensaje para los tres: desde afuera no se deduce cuál fue.
        setError('No pudimos registrar tu respuesta. Puede que ya se haya respondido antes.')
        setEnviando(null)
        // Recargar muestra el sello si el motivo era que ya estaba respondido.
        onRespondido()
        return
      }

      onRespondido()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Algo salió mal.')
      setEnviando(null)
    }
  }

  const campo =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400'

  return (
    <section className="no-print mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-sm font-semibold text-slate-900">¿Aceptás este presupuesto?</h2>
      <p className="mt-1 text-xs text-slate-500">
        Tu respuesta le llega a quien te lo envió. Queda registrada y no se puede cambiar después.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={nombreId} className="mb-1.5 block text-xs text-slate-600">
            Tu nombre
          </label>
          <input
            id={nombreId}
            type="text"
            maxLength={120}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ana Pérez"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor={comentarioId} className="mb-1.5 block text-xs text-slate-600">
            Comentario <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            id={comentarioId}
            type="text"
            maxLength={1000}
            value={comentario}
            onChange={(event) => setComentario(event.target.value)}
            placeholder="Arrancamos el lunes"
            className={campo}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={enviando !== null}
          onClick={() => responder('aprobada')}
          className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {enviando === 'aprobada' ? 'Registrando…' : 'Aceptar presupuesto'}
        </button>

        <button
          type="button"
          disabled={enviando !== null}
          onClick={() => responder('rechazada')}
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
        >
          {enviando === 'rechazada' ? 'Registrando…' : 'Rechazar'}
        </button>
      </div>
    </section>
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
