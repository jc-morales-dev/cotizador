import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useBlocker, useNavigate, useParams, type BlockerFunction } from 'react-router-dom'
import { deleteQuote, getQuote, saveQuote } from '@/lib/quotes'
import { listClientes, type Cliente } from '@/lib/clientes'
import { MONEDA_POR_DEFECTO, parseAmount, parsePercent } from '@/lib/money'
import { ItemsEditor } from '@/components/ItemsEditor'
import { createDraftItem, toDraftItems } from '@/lib/drafts'
import { ErrorBanner, Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { ShareLink } from '@/components/ShareLink'
import {
  MONEDAS,
  MONEDA_LABELS,
  STATUS_LABELS,
  estadosDisponibles,
  type DraftItem,
  type Moneda,
  type QuoteStatus,
} from '@/types'

/** Todo lo que el formulario mantiene como texto mientras se escribe. */
interface Formulario {
  cliente: string
  clienteEmail: string
  titulo: string
  estado: QuoteStatus
  moneda: Moneda
  descuento: string
  iva: string
  validoHasta: string
  notas: string
  condiciones: string
  items: DraftItem[]
}

const FORMULARIO_VACIO: Formulario = {
  cliente: '',
  clienteEmail: '',
  titulo: '',
  estado: 'borrador',
  moneda: MONEDA_POR_DEFECTO,
  descuento: '0',
  iva: '0',
  validoHasta: '',
  notas: '',
  condiciones: '',
  items: [],
}

/**
 * Huella de lo que se guardaría ahora mismo, para saber si hay cambios pendientes.
 *
 * Compara lo que `handleSubmit` manda, no lo que hay en pantalla: una fila vacía
 * recién agregada, o escribir `5,00` donde decía `5`, no cambian nada de lo que
 * termina en la base y no deberían disparar el aviso de "cambios sin guardar".
 */
function firmaDelFormulario(form: Formulario): string {
  return JSON.stringify({
    cliente: form.cliente.trim(),
    clienteEmail: form.clienteEmail.trim(),
    titulo: form.titulo.trim(),
    estado: form.estado,
    moneda: form.moneda,
    descuento: parsePercent(form.descuento),
    iva: parsePercent(form.iva),
    validoHasta: form.validoHasta,
    notas: form.notas.trim(),
    condiciones: form.condiciones.trim(),
    items: form.items
      .filter((item) => item.descripcion.trim() !== '')
      .map((item) => [
        item.descripcion.trim(),
        parseAmount(item.cantidad),
        parseAmount(item.precio),
      ]),
  })
}

/** Los porcentajes vuelven a pantalla sin decimales de relleno: 22, no 22.00. */
function porcentajeEditable(value: number): string {
  return String(Number(value))
}

export function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()

  const clienteId = useId()
  const clienteEmailId = useId()
  const clientesListId = useId()
  const tituloId = useId()
  const estadoId = useId()
  const monedaId = useId()
  const descuentoId = useId()
  const ivaId = useId()
  const validoHastaId = useId()
  const notasId = useId()
  const condicionesId = useId()

  const [form, setForm] = useState<Formulario>(() => ({
    ...FORMULARIO_VACIO,
    items: [createDraftItem()],
  }))
  const [numero, setNumero] = useState<number | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  // Si el cliente ya respondió por el link, el estado deja de ser libre.
  const [respondido, setRespondido] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [loading, setLoading] = useState(Boolean(id))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // La huella de la última versión guardada. En una cotización nueva es la del
  // formulario vacío, así que abrir "Nueva" y salir sin tocar nada no molesta.
  const [firmaGuardada, setFirmaGuardada] = useState(() => firmaDelFormulario(FORMULARIO_VACIO))
  // Guardar y borrar navegan a propósito: el ref los deja pasar sin preguntar.
  // Va en un ref y no en un estado porque `navigate` corre en la misma vuelta y
  // no puede esperar a que React vuelva a renderizar.
  const salidaIntencional = useRef(false)

  /** Un solo setter para no repetir el spread en cada input. */
  function campo<K extends keyof Formulario>(key: K) {
    return (value: Formulario[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  }

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const quote = await getQuote(id)
      const cargado: Formulario = {
        cliente: quote.cliente,
        clienteEmail: quote.cliente_email ?? '',
        titulo: quote.titulo,
        estado: quote.estado,
        moneda: quote.moneda,
        descuento: porcentajeEditable(quote.descuento),
        iva: porcentajeEditable(quote.iva),
        validoHasta: quote.valido_hasta ?? '',
        notas: quote.notas ?? '',
        condiciones: quote.condiciones ?? '',
        items: toDraftItems(quote.items),
      }
      setForm(cargado)
      setNumero(quote.numero)
      setSlug(quote.slug)
      setRespondido(quote.respondido_at !== null)
      setFirmaGuardada(firmaDelFormulario(cargado))
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // El autocompletado es un extra: si no llega, se escribe el nombre a mano.
  useEffect(() => {
    listClientes().then(setClientes)
  }, [])

  const hayCambiosSinGuardar = useMemo(
    () => firmaDelFormulario(form) !== firmaGuardada,
    [form, firmaGuardada],
  )

  // Navegación dentro de la app (Volver, Cancelar, el logo del header).
  //
  // `session` entra en la condición por el botón de cerrar sesión: al desaparecer
  // la sesión, ProtectedRoute redirige a /login, y bloquear ESA navegación deja al
  // usuario sin sesión y sin poder salir del editor. Cerrar sesión es explícito;
  // se lleva los cambios y no pregunta.
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        !salidaIntencional.current &&
        Boolean(session) &&
        hayCambiosSinGuardar &&
        currentLocation.pathname !== nextLocation.pathname,
      [hayCambiosSinGuardar, session],
    ),
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Tenés cambios sin guardar. ¿Salir igual y perderlos?')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  // Cerrar la pestaña o recargar no pasa por el router, así que necesita su propio aviso.
  useEffect(() => {
    if (!hayCambiosSinGuardar) return

    function avisar(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambiosSinGuardar])

  /**
   * Elegir un cliente ya usado trae su email.
   *
   * Solo cuando el nombre coincide exacto —lo que pasa al elegir del datalist— y
   * solo si el campo está vacío: no vamos a pisar un email que la persona acaba
   * de escribir porque el nombre coincidió a mitad de camino.
   */
  function cambiarCliente(nombre: string) {
    setForm((actual) => {
      const conocido = clientes.find((cliente) => cliente.nombre === nombre.trim())
      const email =
        conocido?.email && actual.clienteEmail.trim() === '' ? conocido.email : actual.clienteEmail

      return { ...actual, cliente: nombre, clienteEmail: email }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)

    // Las filas sin descripción se descartan: son las que quedaron vacías al agregar de más.
    const payload = form.items
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
      await saveQuote({
        id: id ?? null,
        cliente: form.cliente,
        cliente_email: form.clienteEmail.trim() || null,
        titulo: form.titulo,
        estado: form.estado,
        moneda: form.moneda,
        descuento: parsePercent(form.descuento),
        iva: parsePercent(form.iva),
        // Un campo de fecha vacío es "sin vencimiento", no una fecha inválida.
        valido_hasta: form.validoHasta || null,
        notas: form.notas.trim() || null,
        condiciones: form.condiciones.trim() || null,
        items: payload,
      })
      salidaIntencional.current = true
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
      salidaIntencional.current = true
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

  const campoTexto =
    'w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600'
  const etiqueta = 'mb-1.5 block text-sm text-slate-300'
  const estados = estadosDisponibles(form.estado, respondido)

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <Link to="/" className="text-sm text-slate-400 transition hover:text-brand">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {id ? 'Editar cotización' : 'Nueva cotización'}
          {numero !== null && <span className="ml-2 text-slate-500">#{numero}</span>}
        </h1>
      </div>

      <div className="space-y-6 rounded-xl border border-line bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={clienteId} className={etiqueta}>
              Cliente
            </label>
            {/* list + datalist: autocompleta los ya usados y acepta uno nuevo sin más trámite. */}
            <input
              id={clienteId}
              type="text"
              required
              maxLength={120}
              list={clientesListId}
              value={form.cliente}
              onChange={(event) => cambiarCliente(event.target.value)}
              placeholder="Estudio Marlow"
              className={campoTexto}
            />
            <datalist id={clientesListId}>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.nombre} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor={clienteEmailId} className={etiqueta}>
              Email del cliente <span className="text-slate-500">(opcional)</span>
            </label>
            <input
              id={clienteEmailId}
              type="email"
              maxLength={160}
              value={form.clienteEmail}
              onChange={(event) => campo('clienteEmail')(event.target.value)}
              placeholder="hola@estudiomarlow.com"
              className={campoTexto}
            />
            <p className="mt-1.5 text-xs text-slate-500">Queda guardado en la ficha del cliente.</p>
          </div>
        </div>

        <div>
          <label htmlFor={tituloId} className={etiqueta}>
            Título
          </label>
          <input
            id={tituloId}
            type="text"
            required
            maxLength={160}
            value={form.titulo}
            onChange={(event) => campo('titulo')(event.target.value)}
            placeholder="Landing page + panel de administración"
            className={campoTexto}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor={estadoId} className={etiqueta}>
              Estado
            </label>
            <select
              id={estadoId}
              value={form.estado}
              onChange={(event) => campo('estado')(event.target.value as QuoteStatus)}
              className={campoTexto}
            >
              {estados.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {respondido
                ? 'El cliente ya respondió por el link, así que el estado no se puede contradecir desde acá.'
                : 'En borrador el link público no muestra nada. Pasala a “Enviada” para compartirla.'}
            </p>
          </div>

          <div>
            <label htmlFor={monedaId} className={etiqueta}>
              Moneda
            </label>
            <select
              id={monedaId}
              value={form.moneda}
              onChange={(event) => campo('moneda')(event.target.value as Moneda)}
              className={campoTexto}
            >
              {MONEDAS.map((value) => (
                <option key={value} value={value}>
                  {MONEDA_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={validoHastaId} className={etiqueta}>
              Válido hasta
            </label>
            <input
              id={validoHastaId}
              type="date"
              value={form.validoHasta}
              onChange={(event) => campo('validoHasta')(event.target.value)}
              className={campoTexto}
            />
            <p className="mt-1.5 text-xs text-slate-500">Opcional. Vacío es sin vencimiento.</p>
          </div>

          <div>
            <label htmlFor={descuentoId} className={etiqueta}>
              Descuento (%)
            </label>
            <input
              id={descuentoId}
              type="text"
              inputMode="decimal"
              value={form.descuento}
              onChange={(event) => campo('descuento')(event.target.value)}
              className={`${campoTexto} text-right tabular-nums`}
            />
          </div>

          <div>
            <label htmlFor={ivaId} className={etiqueta}>
              IVA (%)
            </label>
            <input
              id={ivaId}
              type="text"
              inputMode="decimal"
              value={form.iva}
              onChange={(event) => campo('iva')(event.target.value)}
              className={`${campoTexto} text-right tabular-nums`}
            />
            <p className="mt-1.5 text-xs text-slate-500">Se aplica después del descuento.</p>
          </div>
        </div>

        <div className="border-t border-line pt-6">
          <ItemsEditor
            items={form.items}
            onChange={campo('items')}
            moneda={form.moneda}
            descuento={parsePercent(form.descuento)}
            iva={parsePercent(form.iva)}
          />
        </div>

        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <label htmlFor={notasId} className={etiqueta}>
              Notas
            </label>
            <textarea
              id={notasId}
              rows={3}
              maxLength={2000}
              value={form.notas}
              onChange={(event) => campo('notas')(event.target.value)}
              placeholder="Incluye dos rondas de revisión."
              className={`${campoTexto} resize-y`}
            />
          </div>

          <div>
            <label htmlFor={condicionesId} className={etiqueta}>
              Condiciones
            </label>
            <textarea
              id={condicionesId}
              rows={3}
              maxLength={2000}
              value={form.condiciones}
              onChange={(event) => campo('condiciones')(event.target.value)}
              placeholder="50 % por adelantado, saldo contra entrega."
              className={`${campoTexto} resize-y`}
            />
          </div>
        </div>
      </div>

      {slug && form.estado !== 'borrador' && (
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
