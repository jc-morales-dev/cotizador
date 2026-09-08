import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthEstado } from '@/lib/authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [estado, setEstado] = useState<AuthEstado>('cargando')
  // Cambiarlo vuelve a correr el efecto: es el reintento, sin duplicar la lógica.
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    // getSession y onAuthStateChange corren en paralelo y no hay garantía de orden.
    // Si el listener emite un evento REAL primero (un SIGNED_OUT desde otra pestaña,
    // por ejemplo), la sesión vieja que devuelve getSession no puede pisarlo.
    let elListenerYaHablo = false

    setEstado('cargando')

    // getSession lee la sesión ya guardada; onAuthStateChange cubre login,
    // logout y refresco de token, incluso desde otra pestaña.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error
        if (!vigente || elListenerYaHablo) return
        setSession(data.session)
        setEstado('lista')
      })
      .catch(() => {
        if (!vigente || elListenerYaHablo) return
        // Sin esto la app entera se quedaba en el spinner para siempre: `loading`
        // nunca pasaba a false y no habia forma de salir ni de reintentar.
        setEstado('error')
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!vigente) return
      elListenerYaHablo = true
      setSession(nextSession)
      setEstado('lista')
    })

    return () => {
      vigente = false
      subscription.subscription.unsubscribe()
    }
  }, [intento])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  const value = useMemo(
    () => ({ session, estado, reintentar }),
    [session, estado, reintentar],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
