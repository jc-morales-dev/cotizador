import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function Layout({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [saliendo, setSaliendo] = useState(false)
  const [fallo, setFallo] = useState(false)

  /**
   * Antes era `onClick={() => supabase.auth.signOut()}`: una promesa suelta, sin
   * await ni catch. Si fallaba por red no pasaba nada visible y la persona se iba
   * creyendo que había cerrado sesión, que es justo lo que no se puede dejar pasar
   * en un botón de cerrar sesión.
   *
   * ESLint no lo agarraba: eslint.config.js usa `recommended` y no
   * `recommendedTypeChecked`, que es la que trae no-floating-promises.
   */
  async function cerrarSesion() {
    setSaliendo(true)
    setFallo(false)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setFallo(true)
      setSaliendo(false)
    }
    // Si salió bien no se toca el estado: onAuthStateChange desmonta esto solo.
  }

  return (
    <div className="min-h-dvh bg-ink text-slate-100">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Coti<span className="text-brand">.</span>
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-400 sm:inline">{session?.user.email}</span>
            <Link to="/perfil" className="text-slate-300 transition hover:text-brand">
              Tus datos
            </Link>
            <button
              type="button"
              onClick={cerrarSesion}
              disabled={saliendo}
              className="rounded-md border border-line px-3 py-1.5 text-slate-300 transition hover:border-brand/60 hover:text-brand disabled:opacity-60"
            >
              {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </div>

          {fallo && (
            <p role="alert" className="w-full text-right text-xs text-red-300">
              No pudimos cerrar la sesión. Revisá tu conexión e intentá de nuevo.
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
