import { useId, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui'

const DEMO_EMAIL = 'demo@coti.app'
const DEMO_PASSWORD = 'demo1234'

type Mode = 'login' | 'signup'

const INPUT_CLASS =
  'w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600'

export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const nombreId = useId()
  const apellidoId = useId()
  const emailId = useId()
  const passwordId = useId()
  const repeatId = useId()

  const [mode, setMode] = useState<Mode>('login')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Cuando la cuenta existe pero falta confirmarla, ofrecemos reenviar el correo. */
  const [sinConfirmar, setSinConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="min-h-dvh bg-ink">
        <Spinner label="Cargando…" />
      </div>
    )
  }

  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  function limpiarMensajes() {
    setError(null)
    setNotice(null)
    setSinConfirmar(false)
  }

  async function iniciarSesion(userEmail: string, userPassword: string) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    })

    if (!signInError) return

    // Supabase distingue "falta confirmar" de "credenciales mal". Mostrar
    // "email o contraseña incorrectos" en el primer caso manda a la persona a
    // dudar de datos que en realidad son correctos.
    if (signInError.message.toLowerCase().includes('not confirmed')) {
      setSinConfirmar(true)
      setError('Tu cuenta existe, pero todavía no confirmaste el correo.')
    } else {
      setError('Email o contraseña incorrectos.')
    }
  }

  async function crearCuenta() {
    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nombre: nombre.trim(), apellido: apellido.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'Ese email ya tiene cuenta. Probá iniciando sesión.'
          : 'No pudimos crear la cuenta. Revisá el email y que la contraseña tenga 6 caracteres o más.',
      )
      return
    }

    if (!data.session) {
      setNotice(
        `Te enviamos un correo a ${email.trim()}. Tocá el botón que trae y entrás directo.`,
      )
    }
  }

  async function reenviarConfirmacion() {
    setBusy(true)
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    })
    setBusy(false)

    if (resendError) {
      setError('No pudimos reenviar el correo. Esperá un minuto e intentá de nuevo.')
      return
    }

    setSinConfirmar(false)
    setError(null)
    setNotice(`Te reenviamos el correo a ${email.trim()}. Revisá también el spam.`)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    limpiarMensajes()
    setBusy(true)

    if (mode === 'login') {
      await iniciarSesion(email.trim(), password)
    } else {
      await crearCuenta()
    }

    setBusy(false)
  }

  async function entrarComoDemo() {
    limpiarMensajes()
    setBusy(true)
    await iniciarSesion(DEMO_EMAIL, DEMO_PASSWORD)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Coti<span className="text-brand">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Armá presupuestos y compartilos con un link.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-ink p-1">
            {(['login', 'signup'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value)
                  limpiarMensajes()
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === value ? 'bg-surface text-brand' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {value === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={nombreId} className="mb-1.5 block text-sm text-slate-300">
                    Nombre
                  </label>
                  <input
                    id={nombreId}
                    type="text"
                    required
                    maxLength={60}
                    autoComplete="given-name"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Julio César"
                  />
                </div>

                <div>
                  <label htmlFor={apellidoId} className="mb-1.5 block text-sm text-slate-300">
                    Apellido
                  </label>
                  <input
                    id={apellidoId}
                    type="text"
                    required
                    maxLength={60}
                    autoComplete="family-name"
                    value={apellido}
                    onChange={(event) => setApellido(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Morales"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor={emailId} className="mb-1.5 block text-sm text-slate-300">
                Email
              </label>
              <input
                id={emailId}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={INPUT_CLASS}
                placeholder="vos@ejemplo.com"
              />
            </div>

            <div>
              <label htmlFor={passwordId} className="mb-1.5 block text-sm text-slate-300">
                Contraseña
              </label>
              <input
                id={passwordId}
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={INPUT_CLASS}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor={repeatId} className="mb-1.5 block text-sm text-slate-300">
                  Confirmar contraseña
                </label>
                <input
                  id={repeatId}
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Repetí la contraseña"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                <p>{error}</p>
                {sinConfirmar && (
                  <button
                    type="button"
                    onClick={reenviarConfirmacion}
                    disabled={busy}
                    className="mt-2 font-medium text-red-100 underline underline-offset-4 disabled:opacity-60"
                  >
                    Reenviarme el correo de confirmación
                  </button>
                )}
              </div>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm text-sky-100"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          {mode === 'login' && (
            <Link
              to="/recuperar"
              className="mt-4 block text-center text-sm text-slate-400 transition hover:text-brand"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          )}

          <div className="mt-6 border-t border-line pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={entrarComoDemo}
              className="w-full rounded-md border border-brand/40 px-4 py-2.5 text-sm font-medium text-brand transition hover:bg-brand/10 disabled:opacity-60"
            >
              Entrar como demo
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Cuenta de prueba con cotizaciones cargadas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
