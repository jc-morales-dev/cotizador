import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui'

const DEMO_EMAIL = 'demo@coti.app'
const DEMO_PASSWORD = 'demo1234'

type Mode = 'login' | 'signup'

export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const emailId = useId()
  const passwordId = useId()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  async function authenticate(userEmail: string, userPassword: string, action: Mode) {
    setBusy(true)
    setError(null)
    setNotice(null)

    if (action === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      })
      if (signInError) setError('Email o contraseña incorrectos.')
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: userEmail,
        password: userPassword,
      })

      if (signUpError) {
        setError(
          signUpError.message.includes('already registered')
            ? 'Ese email ya tiene cuenta. Probá entrando.'
            : 'No pudimos crear la cuenta. Revisá el email y que la contraseña tenga 6 caracteres o más.',
        )
      } else if (!data.session) {
        // El proyecto tiene activada la confirmación por correo: no hay sesión todavía.
        setNotice('Te enviamos un correo para confirmar la cuenta. Mientras tanto podés entrar con la cuenta demo.')
      }
    }

    setBusy(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    authenticate(email, password, mode)
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
                  setError(null)
                  setNotice(null)
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === value ? 'bg-surface text-brand' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {value === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
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
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => authenticate(DEMO_EMAIL, DEMO_PASSWORD, 'login')}
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
