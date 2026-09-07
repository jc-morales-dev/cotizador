import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom'
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

// createBrowserRouter y no <BrowserRouter>: el editor avisa de los cambios sin
// guardar con useBlocker, y ese hook solo existe en los routers de datos.
// Con <BrowserRouter> lanza "useBlocker must be used within a data router".
const router = createBrowserRouter([
  // Pública: la abre el cliente final, sin cuenta.
  { path: '/c/:slug', element: <PublicQuotePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar', element: <ForgotPasswordPage /> },
  // Fuera de ProtectedRoute: hay que poder mostrar "el enlace venció" sin sesión.
  { path: '/nueva-contrasena', element: <NewPasswordPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <QuotesPage /> },
      { path: '/nueva', element: <QuoteEditorPage /> },
      { path: '/cotizacion/:id', element: <QuoteEditorPage /> },
      { path: '/perfil', element: <ProfilePage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  // AuthProvider queda por fuera del RouterProvider: no usa hooks de routing y
  // así la sesión no se remonta en cada navegación.
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
