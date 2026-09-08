import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { mensajeDelError } from '@/lib/erroresAuth'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui'

export function NewPasswordPage() {
  const { session, estado } = useAuth()
  const navigate = useNavigate()
  const passwordId = useId()
  const repeatId = useId()

  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Al abrir el enlace del correo, supabase-js canjea el token de la URL por una
  // sesión antes de que esto se renderice. Por eso alcanza con esperar al estado.
  if (estado === 'cargando') {
    return (
      <div className="min-h-dvh bg-ink">
        <Spinner label="Validando el enlace…" />
      </div>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setBusy(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      // Supabase devuelve un código propio cuando repetís la contraseña que ya
      // tenías. Sin ese caso aparte, el usuario leería "pedí otro enlace" y
      // buscaría el problema donde no está.
      setError(
        mensajeDelError(updateError) ??
          'No pudimos cambiar la contraseña. Pedí un enlace nuevo e intentá otra vez.',
      )
      setBusy(false)
      return
    }

    navigate('/', { replace: true })
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
          {!session ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold">Este enlace ya no sirve</h2>
              <p className="mt-3 text-sm text-slate-400">
                Los enlaces vencen en una hora y solo se pueden usar una vez. Pedí uno nuevo.
              </p>
              <Link
                to="/recuperar"
                className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
              >
                Pedir otro enlace
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Elegí una contraseña nueva</h2>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor={passwordId} className="mb-1.5 block text-sm text-slate-300">
                    Contraseña nueva
                  </label>
                  <input
                    id={passwordId}
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label htmlFor={repeatId} className="mb-1.5 block text-sm text-slate-300">
                    Repetila
                  </label>
                  <input
                    id={repeatId}
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={repeat}
                    onChange={(event) => setRepeat(event.target.value)}
                    className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100"
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
                  {busy ? 'Guardando…' : 'Guardar y entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
