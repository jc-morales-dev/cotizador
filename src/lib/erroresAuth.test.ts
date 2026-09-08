import { AuthError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { causaDelError, mensajeDelError } from './erroresAuth'

/** GoTrue construye así sus errores: mensaje, status HTTP y código. */
function errorDeSupabase(message: string, code?: string, status = 400) {
  return new AuthError(message, status, code)
}

describe('causaDelError', () => {
  it('reconoce por código, no por el texto en inglés', () => {
    // Es el punto de todo el módulo: el mensaje puede cambiar sin avisar, el
    // código no. Por eso el texto acá es deliberadamente ajeno al que manda GoTrue.
    const error = errorDeSupabase('cualquier cosa que digan mañana', 'email_not_confirmed')

    expect(causaDelError(error)).toBe('falta_confirmar')
  })

  it('cubre los cuatro casos que antes se detectaban con includes()', () => {
    expect(causaDelError(errorDeSupabase('x', 'email_not_confirmed'))).toBe('falta_confirmar')
    expect(causaDelError(errorDeSupabase('x', 'user_already_exists'))).toBe('cuenta_ya_existe')
    expect(causaDelError(errorDeSupabase('x', 'user_not_found'))).toBe('cuenta_no_existe')
    expect(causaDelError(errorDeSupabase('x', 'same_password'))).toBe('misma_contrasena')
  })

  it('reconoce el rate limit, que antes caía en el cajón de "algo salió mal"', () => {
    // Es el error que la gente realmente se encuentra: pedir el enlace de
    // recuperación dos veces seguidas. Antes mostraba "No pudimos enviar el correo".
    expect(causaDelError(errorDeSupabase('x', 'over_email_send_rate_limit'))).toBe(
      'demasiados_intentos',
    )
  })

  it('cae al texto solo si no vino código', () => {
    // GoTrue viejo no mandaba `code`. La red de seguridad tiene que seguir andando.
    const sinCodigo = errorDeSupabase('Email not confirmed')

    expect(causaDelError(sinCodigo)).toBe('falta_confirmar')
  })

  it('el código gana sobre el texto cuando los dos están', () => {
    const error = errorDeSupabase('Email not confirmed', 'same_password')

    expect(causaDelError(error)).toBe('misma_contrasena')
  })

  it('devuelve desconocida ante un código nuevo, sin romperse', () => {
    expect(causaDelError(errorDeSupabase('x', 'codigo_que_no_existe_todavia'))).toBe('desconocida')
  })

  it('tolera cualquier cosa que no sea un AuthError', () => {
    expect(causaDelError(new Error('un error comun'))).toBe('desconocida')
    expect(causaDelError(null)).toBe('desconocida')
    expect(causaDelError(undefined)).toBe('desconocida')
    expect(causaDelError('un string suelto')).toBe('desconocida')
  })
})

describe('mensajeDelError', () => {
  it('devuelve el mensaje en español', () => {
    expect(mensajeDelError(errorDeSupabase('x', 'email_not_confirmed'))).toMatch(
      /no confirmaste el correo/i,
    )
  })

  it('devuelve null si no reconoce la causa, para que la pantalla ponga el suyo', () => {
    // Fallar al entrar y fallar al pedir un enlace no se explican igual, así que
    // el texto genérico lo elige quien llama y no este módulo.
    expect(mensajeDelError(errorDeSupabase('x', 'codigo_desconocido'))).toBeNull()
    expect(mensajeDelError(new Error('otra cosa'))).toBeNull()
  })
})
