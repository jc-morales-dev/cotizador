import type { ReactNode } from 'react'
import { STATUS_LABELS, type QuoteStatus } from '@/types'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400" role="status">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-red-400/50 px-3 py-1.5 font-medium text-red-100 transition hover:bg-red-500/20"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

const STATUS_STYLES: Record<QuoteStatus, string> = {
  borrador: 'border-slate-500/40 bg-slate-500/15 text-slate-300',
  enviada: 'border-sky-400/40 bg-sky-400/15 text-sky-200',
  aprobada: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
  rechazada: 'border-rose-400/40 bg-rose-400/15 text-rose-200',
  cobrada: 'border-brand/40 bg-brand/15 text-brand',
}

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
