import { useContext } from 'react'
import { AuthContext } from '@/lib/authContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth necesita estar dentro de <AuthProvider>')
  return context
}
