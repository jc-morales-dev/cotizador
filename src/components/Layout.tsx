import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function Layout({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  return (
    <div className="min-h-dvh bg-ink text-slate-100">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Coti<span className="text-brand">.</span>
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-400 sm:inline">{session?.user.email}</span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-line px-3 py-1.5 text-slate-300 transition hover:border-brand/60 hover:text-brand"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
