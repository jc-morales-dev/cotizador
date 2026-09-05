import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteQuote, getQuote, saveQuote } from '@/lib/quotes'
import { parseAmount } from '@/lib/money'
import { ItemsEditor } from '@/components/ItemsEditor'
import { createDraftItem, toDraftItems } from '@/lib/drafts'
import { ErrorBanner, Spinner } from '@/components/ui'
import { ShareLink } from '@/components/ShareLink'
import { QUOTE_STATUSES, STATUS_LABELS, type DraftItem, type QuoteStatus } from '@/types'

export function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clienteId = useId()
  const tituloId = useId()
  const estadoId = useId()

  const [cliente, setCliente] = useState('')
  const [titulo, setTitulo] = useState('')
  const [estado, setEstado] = useState<QuoteStatus>('borrador')
  const [items, setItems] = useState<DraftItem[]>([createDraftItem()])
  const [slug, setSlug] = useState<string | null>(null)

  const [loading, setLoading] = useState(Boolean(id))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const quote = await getQuote(id)
      setCliente(quote.cliente)
      setTitulo(quote.titulo)
      setEstado(quote.estado)
      setSlug(quote.slug)
      setItems(toDraftItems(quote.items))
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)

    // Las filas sin descripción se descartan: son las que quedaron vacías al agregar de más.
    const payload = items
      .filter((item) => item.descripcion.trim() !== '')
      .map((item) => ({
        descripcion: item.descripcion.trim(),
        cantidad: parseAmount(item.cantidad),
        precio: parseAmount(item.precio),
      }))

    if (payload.length === 0) {
      setSaveError('Agregá al menos un ítem con descripción.')
      return
    }

    setSaving(true)
    try {
      await saveQuote({ id: id ?? null, cliente, titulo, estado, items: payload })
      navigate('/')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Algo salió mal.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('¿Borrar esta cotización? No se puede deshacer.')) return
    try {
      await deleteQuote(id)
      navigate('/')
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Algo salió mal.')
    }
  }

  if (loading) return <Spinner label="Cargando la cotización…" />

  if (loadError) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} onRetry={load} />
        <Link to="/" className="inline-block text-sm text-slate-400 hover:text-brand">
          ← Volver a las cotizaciones
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <Link to="/" className="text-sm text-slate-400 transition hover:text-brand">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {id ? 'Editar cotización' : 'Nueva cotización'}
        </h1>
      </div>

      <div className="space-y-6 rounded-xl border border-line bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={clienteId} className="mb-1.5 block text-sm text-slate-300">
              Cliente
            </label>
            <input
              id={clienteId}
              type="text"
              required
              maxLength={120}
              value={cliente}
              onChange={(event) => setCliente(event.target.value)}
              placeholder="Estudio Marlow"
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label htmlFor={tituloId} className="mb-1.5 block text-sm text-slate-300">
              Título
            </label>
            <input
              id={tituloId}
              type="text"
              required
              maxLength={160}
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Landing page + panel de administración"
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="sm:max-w-xs">
          <label htmlFor={estadoId} className="mb-1.5 block text-sm text-slate-300">
            Estado
          </label>
          <select
            id={estadoId}
            value={estado}
            onChange={(event) => setEstado(event.target.value as QuoteStatus)}
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100"
          >
            {QUOTE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            En borrador el link público no muestra nada. Pasala a “Enviada” para compartirla.
          </p>
        </div>

        <div className="border-t border-line pt-6">
          <ItemsEditor items={items} onChange={setItems} />
        </div>
      </div>

      {slug && estado !== 'borrador' && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Link para el cliente
          </h2>
          <ShareLink slug={slug} />
        </div>
      )}

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>

        <Link
          to="/"
          className="rounded-md border border-line px-4 py-2.5 text-sm text-slate-300 transition hover:text-slate-100"
        >
          Cancelar
        </Link>

        {id && (
          <button
            type="button"
            onClick={handleDelete}
            className="ml-auto rounded-md border border-line px-4 py-2.5 text-sm text-slate-400 transition hover:border-red-500/50 hover:text-red-300"
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
