import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-4 text-center text-slate-100">
      <h1 className="text-2xl font-semibold">Esta página no existe</h1>
      <p className="text-sm text-slate-400">Puede que el link esté mal escrito.</p>
      <Link
        to="/"
        className="mt-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-dark"
      >
        Ir al inicio
      </Link>
    </div>
  )
}
