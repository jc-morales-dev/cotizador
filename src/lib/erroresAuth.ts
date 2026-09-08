import { AuthError } from '@supabase/supabase-js'

/**
 * Qué salió mal al autenticar, en términos del producto y no de GoTrue.
 *
 * Antes cada pantalla decidía por su cuenta haciendo `includes()` sobre el mensaje
 * EN INGLÉS que devuelve Supabase: `'not confirmed'`, `'already registered'`,
 * `'not found'`, `'should be different'`. Cuatro lugares, ninguno compartido, todos
 * atados a un texto que Supabase puede cambiar sin avisar.
 *
 * Y cuando ese texto cambiara, el fallo era silencioso y de la peor clase: una
 * cuenta sin confirmar habría pasado a mostrar "Email o contraseña incorrectos",
 * mandando a la persona a dudar de datos que en realidad estaban bien.
 *
 * `AuthError` expone `code`, que es un identificador estable y documentado. Es lo
 * que se mira acá.
 */
export type CausaAuth =
  | 'falta_confirmar'
  | 'credenciales_invalidas'
  | 'cuenta_ya_existe'
  | 'cuenta_no_existe'
  | 'misma_contrasena'
  | 'contrasena_debil'
  | 'demasiados_intentos'
  | 'desconocida'

/** Códigos de GoTrue → causa del producto. Los códigos son parte de su API pública. */
const POR_CODIGO: Record<string, CausaAuth> = {
  email_not_confirmed: 'falta_confirmar',
  phone_not_confirmed: 'falta_confirmar',
  invalid_credentials: 'credenciales_invalidas',
  user_already_exists: 'cuenta_ya_existe',
  email_exists: 'cuenta_ya_existe',
  user_not_found: 'cuenta_no_existe',
  same_password: 'misma_contrasena',
  weak_password: 'contrasena_debil',
  over_request_rate_limit: 'demasiados_intentos',
  over_email_send_rate_limit: 'demasiados_intentos',
}

/**
 * Red de seguridad por texto, solo para versiones viejas de GoTrue que todavía no
 * mandaban `code`. Es el camino de atrás, no el principal: si esto empieza a ser lo
 * único que funciona, el mapa de códigos quedó desactualizado.
 */
const POR_TEXTO: [string, CausaAuth][] = [
  ['not confirmed', 'falta_confirmar'],
  ['invalid login credentials', 'credenciales_invalidas'],
  ['already registered', 'cuenta_ya_existe'],
  ['should be different', 'misma_contrasena'],
]

export function causaDelError(error: unknown): CausaAuth {
  if (!(error instanceof AuthError)) return 'desconocida'

  if (error.code && POR_CODIGO[error.code]) return POR_CODIGO[error.code]

  const texto = error.message.toLowerCase()
  for (const [fragmento, causa] of POR_TEXTO) {
    if (texto.includes(fragmento)) return causa
  }

  return 'desconocida'
}

/**
 * El mensaje que ve la persona.
 *
 * `desconocida` no tiene entrada acá a propósito: cada pantalla sabe mejor que este
 * módulo qué decir cuando algo falla sin causa reconocible — no es lo mismo fallar
 * al entrar que al pedir un enlace de recuperación.
 */
const MENSAJES: Record<Exclude<CausaAuth, 'desconocida'>, string> = {
  falta_confirmar: 'Tu cuenta existe, pero todavía no confirmaste el correo.',
  credenciales_invalidas: 'Email o contraseña incorrectos.',
  cuenta_ya_existe: 'Ese email ya tiene cuenta. Probá iniciando sesión.',
  cuenta_no_existe: 'No encontramos una cuenta con ese email.',
  misma_contrasena: 'Esa ya es tu contraseña actual. Elegí una distinta.',
  contrasena_debil: 'La contraseña es muy corta. Usá 6 caracteres o más.',
  demasiados_intentos: 'Probaste varias veces seguidas. Esperá un minuto e intentá de nuevo.',
}

/** Devuelve null si la causa no se reconoce, para que quien llama ponga su propio texto. */
export function mensajeDelError(error: unknown): string | null {
  const causa = causaDelError(error)
  return causa === 'desconocida' ? null : MENSAJES[causa]
}
