import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, saveProfile } from '@/lib/profile'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner, Spinner } from '@/components/ui'

export function ProfilePage() {
  const { session } = useAuth()
  const nombreId = useId()
  const emailId = useId()
  const telefonoId = useId()

  const [nombre, setNombre] = useState('')
  const [emailContacto, setEmailContacto] = useState('')
  const [telefono, setTelefono] = useState('')

  const [loading, setLoading] = useState(true)
  /**
   * Los dos errores van separados a propósito.
   *
   * Si falla la LECTURA no se puede mostrar el formulario: los campos saldrían
   * vacíos y darle a "Guardar" sobrescribiría el perfil real —nombre, email y
   * teléfono, o sea lo que el cliente ve en el presupuesto— con blancos. Antes
   * pasaba exactamente eso, y encima el error aparecía debajo de los inputs.
   *
   * Si falla el GUARDADO, en cambio, los datos en pantalla son buenos y hay que
   * dejar reintentar sin perder lo escrito.
   */
  const [errorAlCargar, setErrorAlCargar] = useState<string | null>(null)
  const [errorAlGuardar, setErrorAlGuardar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!userId) {
      // Sin esto el spinner quedaba para siempre. Hoy no puede pasar porque la
      // ruta está dentro de ProtectedRoute, pero el componente no tiene por qué
      // depender de un invariante que se sostiene desde otro archivo.
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorAlCargar(null)
    try {
      const profile = await getProfile(userId)
      if (profile) {
        setNombre(profile.nombre)
        setEmailContacto(profile.email_contacto ?? '')
        setTelefono(profile.telefono ?? '')
      } else {
        // Sin perfil todavía: el email de la cuenta es el punto de partida más útil.
        setEmailContacto(session?.user.email ?? '')
      }
    } catch (caught) {
      setErrorAlCargar(caught instanceof Error ? caught.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }, [userId, session?.user.email])

  useEffect(() => {
    load()
  }, [load])

  /** Tocar cualquier campo invalida el "Datos guardados." de la vez anterior. */
  function editar(setter: (valor: string) => void) {
    return (valor: string) => {
      setSaved(false)
      setter(valor)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!userId) return

    setSaving(true)
    setErrorAlGuardar(null)
    setSaved(false)
    try {
      await saveProfile(userId, {
        nombre,
        email_contacto: emailContacto,
        telefono,
      })
      setSaved(true)
    } catch (caught) {
      setErrorAlGuardar(caught instanceof Error ? caught.message : 'Algo salió mal.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Cargando tus datos…" />

  // No mostrar el formulario es el punto: con los campos vacíos, guardar borra
  // el perfil de verdad.
  if (errorAlCargar) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tus datos</h1>
        <ErrorBanner message={errorAlCargar} onRetry={load} />
        <Link to="/" className="inline-block text-sm text-slate-400 hover:text-brand">
          ← Volver a las cotizaciones
        </Link>
      </div>
    )
  }

  const campo =
    'w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600'

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="mb-6">
        <Link to="/" className="text-sm text-slate-400 transition hover:text-brand">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tus datos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Es lo que ve tu cliente en el presupuesto, para saber quién se lo envía.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <label htmlFor={nombreId} className="mb-1.5 block text-sm text-slate-300">
            Nombre o negocio
          </label>
          <input
            id={nombreId}
            type="text"
            required
            maxLength={120}
            value={nombre}
            onChange={(event) => editar(setNombre)(event.target.value)}
            placeholder="Julio César Morales"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm text-slate-300">
            Email de contacto
          </label>
          <input
            id={emailId}
            type="email"
            maxLength={160}
            value={emailContacto}
            onChange={(event) => editar(setEmailContacto)(event.target.value)}
            placeholder="hola@tudominio.com"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor={telefonoId} className="mb-1.5 block text-sm text-slate-300">
            Teléfono <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            id={telefonoId}
            type="tel"
            maxLength={40}
            value={telefono}
            onChange={(event) => editar(setTelefono)(event.target.value)}
            placeholder="+598 99 123 456"
            className={campo}
          />
        </div>
      </div>

      {errorAlGuardar && (
        <div className="mt-6">
          <ErrorBanner message={errorAlGuardar} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>

        {saved && (
          <span role="status" className="text-sm text-emerald-300">
            Datos guardados.
          </span>
        )}
      </div>
    </form>
  )
}
