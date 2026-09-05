import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  /** True hasta que sabemos si hay sesión guardada. Sin esto, al recargar parpadea el login. */
  loading: boolean
}

// El contexto vive en su propio archivo para que AuthProvider.tsx exporte
// solo componentes y el fast refresh de Vite no se rompa al editarlo.
export const AuthContext = createContext<AuthState | undefined>(undefined)
