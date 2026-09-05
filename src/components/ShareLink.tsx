import { useEffect, useState } from 'react'

export function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/c/${slug}`

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS) el usuario todavía puede
      // abrir el link y copiarlo de la barra de direcciones.
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="min-w-0 flex-1 truncate rounded-md bg-ink px-3 py-1.5 text-xs text-slate-400">
        {url}
      </code>

      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand/60 hover:text-brand"
      >
        {copied ? 'Copiado' : 'Copiar link'}
      </button>

      <a
        href={`/c/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-brand hover:underline"
      >
        Ver
      </a>

      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copiado al portapapeles' : ''}
      </span>
    </div>
  )
}
