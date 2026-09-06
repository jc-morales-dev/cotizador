import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ItemsEditor } from './ItemsEditor'
import { toDraftItems } from '@/lib/drafts'
import type { QuoteItem } from '@/types'

/** El editor es controlado, así que para probarlo necesita quien le sostenga el estado. */
function EditorConEstado({ iniciales = [] }: { iniciales?: QuoteItem[] }) {
  const [items, setItems] = useState(() => toDraftItems(iniciales))
  return <ItemsEditor items={items} onChange={setItems} />
}

const PRESUPUESTO: QuoteItem[] = [
  { descripcion: 'Diseño', cantidad: 1, precio: 320 },
  { descripcion: 'Maquetación', cantidad: 1, precio: 680 },
  { descripcion: 'Soporte', cantidad: 6, precio: 45 },
]

function leerTotal() {
  return screen.getByText('Total').parentElement?.textContent ?? ''
}

describe('ItemsEditor', () => {
  it('suma el total de las filas que recibe', () => {
    render(<EditorConEstado iniciales={PRESUPUESTO} />)

    // 320 + 680 + (6 × 45) = 1270
    expect(leerTotal()).toMatch(/1[.\s]270,00/)
  })

  it('actualiza el total mientras se escribe un precio', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={[{ descripcion: 'Auditoría', cantidad: 2, precio: 0 }]} />)

    // El campo ya trae "0,00": hay que vaciarlo antes o el texto se concatena.
    await user.clear(screen.getByLabelText('Precio'))
    await user.type(screen.getByLabelText('Precio'), '150')

    expect(leerTotal()).toMatch(/300,00/)
  })

  it('acepta coma decimal al escribir', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={[{ descripcion: 'Hora', cantidad: 1, precio: 0 }]} />)

    await user.clear(screen.getByLabelText('Precio'))
    await user.type(screen.getByLabelText('Precio'), '42,75')

    expect(leerTotal()).toMatch(/42,75/)
  })

  it('no rompe el total al vaciar un precio', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={[{ descripcion: 'Algo', cantidad: 1, precio: 100 }]} />)

    await user.clear(screen.getByLabelText('Precio'))

    // Si el campo vacío se convirtiera a número sin cuidado, acá saldría NaN.
    expect(leerTotal()).toMatch(/0,00/)
    expect(leerTotal()).not.toMatch(/NaN/)
  })

  it('borra la fila correcta sin descolocar las demás', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={PRESUPUESTO} />)

    await user.click(screen.getByRole('button', { name: 'Borrar ítem 2' }))

    const descripciones = screen
      .getAllByLabelText('Descripción')
      .map((input) => (input as HTMLInputElement).value)

    // Borrar la del medio es el caso que delata si se elimina por posición en vez
    // de por identidad: si se quitara la última, acá quedarían Diseño y Maquetación.
    expect(descripciones).toEqual(['Diseño', 'Soporte'])
    expect(leerTotal()).toMatch(/590,00/)
  })

  it('agrega una fila vacía al final', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={[{ descripcion: 'Único', cantidad: 1, precio: 50 }]} />)

    await user.click(screen.getByRole('button', { name: 'Agregar ítem' }))

    const descripciones = screen.getAllByLabelText('Descripción')
    expect(descripciones).toHaveLength(2)
    expect((descripciones[1] as HTMLInputElement).value).toBe('')
    // Agregar una línea en blanco no cambia lo que se cobra.
    expect(leerTotal()).toMatch(/50,00/)
  })

  it('muestra el subtotal de cada línea', () => {
    render(<EditorConEstado iniciales={[{ descripcion: 'Soporte', cantidad: 6, precio: 45 }]} />)

    const fila = screen.getByLabelText('Descripción').closest('li')!
    expect(within(fila).getByText(/270,00/)).toBeInTheDocument()
  })

  it('avisa cuando no queda ninguna fila', async () => {
    const user = userEvent.setup()
    render(<EditorConEstado iniciales={[{ descripcion: 'Único', cantidad: 1, precio: 10 }]} />)

    await user.click(screen.getByRole('button', { name: 'Borrar ítem 1' }))

    expect(screen.getByText(/Agregá al menos un ítem/)).toBeInTheDocument()
  })
})
