import { LOCALE } from './money'

/** Para timestamptz: `created_at`, `respondido_at`, `ultima_vista`. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Para `date` de Postgres, que llega como "2026-03-15".
 * Pasarlo por `new Date()` lo interpreta en UTC y en cualquier huso al oeste de
 * Greenwich lo muestra un día antes, así que se parte a mano.
 */
export function formatDateOnly(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/** Vencido es "ayer o antes": un presupuesto válido hasta hoy todavía vale hoy. */
export function estaVencido(fecha: string | null): boolean {
  if (!fecha) return false

  const [year, month, day] = fecha.split('-').map(Number)
  const limite = new Date(year, month - 1, day)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return limite.getTime() < hoy.getTime()
}

const relativo = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/**
 * "hace 2 horas", "ayer", "hace 3 días".
 *
 * En el panel importa el orden de magnitud, no la fecha exacta: lo que se quiere
 * saber de un vistazo es si el cliente lo abrió recién o hace una semana.
 */
export function formatRelative(iso: string): string {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutos) < 60) return relativo.format(minutos, 'minute')

  const horas = Math.round(minutos / 60)
  if (Math.abs(horas) < 24) return relativo.format(horas, 'hour')

  const dias = Math.round(horas / 24)
  if (Math.abs(dias) < 30) return relativo.format(dias, 'day')

  return relativo.format(Math.round(dias / 30), 'month')
}
