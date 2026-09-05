import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { NewPasswordPage } from '@/pages/NewPasswordPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { QuoteEditorPage } from '@/pages/QuoteEditorPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PublicQuotePage } from '@/pages/PublicQuotePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  // Sin este estado intermedio, al recargar se ve el login un instante antes
  // de que Supabase confirme que la sesión guardada sigue siendo válida.
  if (loading) {
    return (
      <div className="min-h-dvh bg-ink">
        <Spinner label="Cargando tu sesión…" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública: la abre el cliente final, sin cuenta. */}
          <Route path="/c/:slug" element={<PublicQuotePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          {/* Fuera de ProtectedRoute: hay que poder mostrar "el enlace venció" sin sesión. */}
          <Route path="/nueva-contrasena" element={<NewPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<QuotesPage />} />
            <Route path="/nueva" element={<QuoteEditorPage />} />
            <Route path="/cotizacion/:id" element={<QuoteEditorPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
