import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui'
import { LoginPage } from '@/pages/LoginPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { QuoteEditorPage } from '@/pages/QuoteEditorPage'
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

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<QuotesPage />} />
            <Route path="/nueva" element={<QuoteEditorPage />} />
            <Route path="/cotizacion/:id" element={<QuoteEditorPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
