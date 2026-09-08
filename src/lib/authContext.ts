import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

/**
 * Tres estados y no un booleano.
 *
 * Con `{ session, loading }` el par `loading:false, session:null` significaba dos
 * cosas a la vez: "no hay sesión" y "no pudimos averiguar si la hay". La UI tiene
 * que tratarlas distinto — a la primera se la manda al login, a la segunda no,
 * porque puede ser alguien que sí tiene sesión y quedó del otro lado de una red
 * caída.
 */
export type AuthEstado = 'cargando' | 'lista' | 'error'

export interface AuthState {
  /** Solo es de fiar con `estado === 'lista'`. */
  session: Session | null
  estado: AuthEstado
  /** Vuelve a intentar leer la sesión. Es lo que engancha el botón de reintento. */
  reintentar: () => void
}

// El contexto vive en su propio archivo para que AuthProvider.tsx exporte
// solo componentes y el fast refresh de Vite no se rompa al editarlo.
export const AuthContext = createContext<AuthState | undefined>(undefined)
