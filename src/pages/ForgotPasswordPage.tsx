import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    // Confirmamos el envío aunque el email no exista: decir "esa cuenta no existe"
    // permitiría averiguar quién está registrado.
    if (resetError && !resetError.message.toLowerCase().includes('not found')) {
      setError('No pudimos enviar el correo. Intentá de nuevo en un minuto.')
    } else {
      setSent(true)
    }

    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Coti<span className="text-brand">.</span>
          </h1>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          {sent ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold">Revisá tu correo</h2>
              <p className="mt-3 text-sm text-slate-400">
                Si <span className="text-slate-200">{email}</span> tiene una cuenta, le enviamos un
                enlace para elegir una contraseña nueva. Vence en una hora.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm text-brand underline-offset-4 hover:underline"
              >
                Volver a entrar
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">¿Olvidaste tu contraseña?</h2>
              <p className="mt-2 text-sm text-slate-400">
                Poné tu email y te mandamos un enlace para crear una nueva.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {busy ? 'Enviando…' : 'Enviarme el enlace'}
                </button>
              </form>

              <Link
                to="/login"
                className="mt-5 block text-center text-sm text-slate-400 transition hover:text-brand"
              >
                Volver
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
