import { useRouteError } from 'react-router-dom'

/**
 * Los `errorElement` del router.
 *
 * Hay dos y no uno porque los lee gente distinta. Un error en el panel lo ve el
 * dueño, que puede recargar o reportar; el mismo error en `/c/:slug` lo ve un
 * cliente que no tiene cuenta, no sabe qué es Coti y no puede hacer nada al
 * respecto salvo avisarle a quien le mandó el presupuesto. Un solo mensaje
 * genérico serviría mal a los dos.
 *
 * OJO con lo que esto NO cubre: el `throw` de src/lib/supabase.ts ocurre al
 * importar el módulo, antes de que React renderice nada, así que ningún error
 * boundary lo agarra. Para ese caso la contención es el guard de vite.config.ts,
 * que corta el build si faltan las credenciales.
 */

/** En desarrollo el detalle ayuda; en producción es ruido que además filtra internals. */
function detalleSiSirve(error: unknown): string | null {
  if (!import.meta.env.DEV) return null
  if (error instanceof Error) return error.message
  return String(error)
}

/** Para el panel: quien lo ve tiene cuenta y puede hacer algo. */
export function ErrorDelPanel() {
  const error = useRouteError()
  const detalle = detalleSiSirve(error)

  return (
    <div className="min-h-dvh bg-ink px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo se rompió de este lado</h1>
        <p className="mt-3 text-sm text-slate-400">
          No es culpa de lo que estabas haciendo. Recargá la página; si vuelve a pasar,
          tus cotizaciones están a salvo igual.
        </p>

        {detalle && (
          <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface p-3 text-left text-xs text-slate-400">
            {detalle}
          </pre>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-dark"
        >
          Recargar
        </button>
      </div>
    </div>
  )
}

/**
 * Para el presupuesto público: quien lo ve es el cliente.
 *
 * Sin jerga, sin botón de reportar y sin pedirle nada técnico. Lo único accionable
 * que tiene es hablar con quien le pasó el link, así que eso es lo que dice.
 */
export function ErrorDelDocumento() {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-8 sm:py-16">
      <div className="documento mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <h1 className="text-xl font-semibold text-slate-900">
          No pudimos mostrar este presupuesto
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">
          Probá recargar la página. Si sigue sin verse, avisale a quien te lo envió: el link
          está bien, el problema es nuestro.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Recargar
        </button>
      </div>
    </div>
  )
}
