import type { ComponentType } from 'react'
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner, Spinner } from '@/components/ui'
import { ErrorDelDocumento, ErrorDelPanel } from '@/components/errores'
// Estáticas a propósito: son las dos únicas páginas que puede llegar a ver alguien
// sin cuenta, así que no tienen que esperar a que baje un chunk aparte.
import { PublicQuotePage } from '@/pages/PublicQuotePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function ProtectedRoute() {
  const { session, estado, reintentar } = useAuth()
  const location = useLocation()

  // Sin este estado intermedio, al recargar se ve el login un instante antes
  // de que Supabase confirme que la sesión guardada sigue siendo válida.
  if (estado === 'cargando') {
    return (
      <div className="min-h-dvh bg-ink">
        <Spinner label="Cargando tu sesión…" />
      </div>
    )
  }

  // No saber si hay sesión no es lo mismo que saber que no la hay. Mandar al login
  // a alguien que sí está logueado —porque se le cayó la red un segundo— sería
  // mentirle. Antes esto no existía: la app se quedaba colgada en el spinner para
  // siempre, sin mensaje y sin salida.
  if (estado === 'error') {
    return (
      <div className="min-h-dvh bg-ink px-4 py-16">
        <div className="mx-auto max-w-md">
          <ErrorBanner
            message="No pudimos verificar tu sesión. Revisá tu conexión."
            onRetry={reintentar}
          />
        </div>
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

/**
 * `lazy` de la ruta y no `React.lazy`: es la forma nativa del router de datos y
 * no necesita envolver nada en `<Suspense>`.
 *
 * Las páginas se exportan con nombre, así que hay que mapearlas a `Component`,
 * que es lo que el router espera encontrar.
 */
function diferida(cargar: () => Promise<Record<string, unknown>>, nombre: string) {
  return async () => ({ Component: (await cargar())[nombre] as ComponentType })
}

// createBrowserRouter y no <BrowserRouter>: el editor avisa de los cambios sin
// guardar con useBlocker, y ese hook solo existe en los routers de datos.
// Con <BrowserRouter> lanza "useBlocker must be used within a data router".
const router = createBrowserRouter([
  // Pública: la abre el cliente final, sin cuenta. Su boundary le habla a él.
  {
    path: '/c/:slug',
    element: <PublicQuotePage />,
    errorElement: <ErrorDelDocumento />,
  },

  {
    // Todo lo demás comparte el boundary del panel: lo lee alguien con cuenta.
    errorElement: <ErrorDelPanel />,
    children: [
      { path: '/login', lazy: diferida(() => import('@/pages/LoginPage'), 'LoginPage') },
      {
        path: '/recuperar',
        lazy: diferida(() => import('@/pages/ForgotPasswordPage'), 'ForgotPasswordPage'),
      },
      // Fuera de ProtectedRoute: hay que poder mostrar "el enlace venció" sin sesión.
      {
        path: '/nueva-contrasena',
        lazy: diferida(() => import('@/pages/NewPasswordPage'), 'NewPasswordPage'),
      },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', lazy: diferida(() => import('@/pages/QuotesPage'), 'QuotesPage') },
          {
            path: '/nueva',
            lazy: diferida(() => import('@/pages/QuoteEditorPage'), 'QuoteEditorPage'),
          },
          {
            path: '/cotizacion/:id',
            lazy: diferida(() => import('@/pages/QuoteEditorPage'), 'QuoteEditorPage'),
          },
          { path: '/perfil', lazy: diferida(() => import('@/pages/ProfilePage'), 'ProfilePage') },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
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
