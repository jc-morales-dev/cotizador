import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthProvider'
import { useAuth } from '@/hooks/useAuth'

/**
 * El fallo que estos tests fijan era el único con alcance global: si
 * `getSession()` rechazaba, `loading` nunca pasaba a false y la app entera se
 * quedaba en el spinner para siempre, sin mensaje ni reintento.
 *
 * Se prueba acá y no en el navegador porque provocar un rechazo real de
 * `getSession` a mano es incómodo y frágil, y porque este es justo el camino que
 * nadie recorre hasta que es tarde: tiene que quedar cubierto para siempre.
 */

const getSession = vi.fn()
const onAuthStateChange = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: (cb: unknown) => onAuthStateChange(cb),
    },
  },
}))

function Sonda() {
  const { estado, session, reintentar } = useAuth()
  return (
    <div>
      <span data-testid="estado">{estado}</span>
      <span data-testid="sesion">{session ? session.user.id : 'sin sesion'}</span>
      <button type="button" onClick={reintentar}>
        Reintentar
      </button>
    </div>
  )
}

function sesionFalsa(id: string) {
  return { user: { id } } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  // Por defecto el listener no dice nada: cada test decide si emite.
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('AuthProvider', () => {
  it('queda en error, y NO colgado, si getSession rechaza', async () => {
    getSession.mockRejectedValue(new Error('sin red'))

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    // Lo importante es que salga de 'cargando'. Antes se quedaba ahí para siempre.
    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('también entra en error si getSession devuelve error en vez de rechazar', async () => {
    // supabase-js devuelve `{ data, error }` casi siempre; rechazar es la excepción.
    // Los dos caminos tienen que terminar igual.
    getSession.mockResolvedValue({ data: { session: null }, error: new Error('falló') })

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('reintentar vuelve a preguntar y se recupera', async () => {
    const user = userEvent.setup()
    getSession.mockRejectedValueOnce(new Error('sin red'))

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )
    expect(await screen.findByText('error')).toBeInTheDocument()

    // La segunda vez la red anda.
    getSession.mockResolvedValue({ data: { session: sesionFalsa('u1') }, error: null })
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('lista')).toBeInTheDocument()
    expect(screen.getByTestId('sesion')).toHaveTextContent('u1')
  })

  it('deja la sesión lista cuando getSession responde bien', async () => {
    getSession.mockResolvedValue({ data: { session: sesionFalsa('u42') }, error: null })

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    expect(await screen.findByText('lista')).toBeInTheDocument()
    expect(screen.getByTestId('sesion')).toHaveTextContent('u42')
  })

  it('el listener le gana a getSession si habla primero', async () => {
    // Carrera real: un SIGNED_OUT desde otra pestaña llega antes de que resuelva
    // getSession. La sesión vieja no puede pisar a la nueva.
    let emitir: ((evento: string, sesion: unknown) => void) | undefined
    onAuthStateChange.mockImplementation((cb: (evento: string, sesion: unknown) => void) => {
      emitir = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    let resolverGetSession: ((valor: unknown) => void) | undefined
    getSession.mockReturnValue(
      new Promise((resolve) => {
        resolverGetSession = resolve
      }),
    )

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    // El listener dice "no hay sesión" primero.
    emitir!('SIGNED_OUT', null)
    expect(await screen.findByText('lista')).toBeInTheDocument()

    // Y recién después llega getSession con la sesión vieja: hay que ignorarla.
    resolverGetSession!({ data: { session: sesionFalsa('vieja') }, error: null })

    expect(await screen.findByText('lista')).toBeInTheDocument()
    expect(screen.getByTestId('sesion')).toHaveTextContent('sin sesion')
  })
})
