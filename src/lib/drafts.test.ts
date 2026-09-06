import { describe, expect, it } from 'vitest'

import { createDraftItem, toDraftItems } from './drafts'

describe('createDraftItem', () => {
  it('arranca con cantidad 1 y precio vacío', () => {
    const item = createDraftItem()

    expect(item.descripcion).toBe('')
    expect(item.cantidad).toBe('1')
    expect(item.precio).toBe('')
  })

  it('da una clave distinta cada vez', () => {
    // Cada fila se borra buscando su clave. Si dos filas compartieran clave, un
    // solo clic en "Borrar" se llevaría las dos por delante.
    const claves = new Set([createDraftItem().key, createDraftItem().key, createDraftItem().key])

    expect(claves.size).toBe(3)
  })
})

describe('toDraftItems', () => {
  it('devuelve los importes con coma y dos decimales', () => {
    // Si se escribió "240,50", al reabrir tiene que volver igual y no como "240.5".
    const [item] = toDraftItems([{ descripcion: 'Auditoría', cantidad: 1, precio: 240.5 }])

    expect(item.precio).toBe('240,50')
    expect(item.cantidad).toBe('1')
  })

  it('deja las cantidades enteras sin decimales de más', () => {
    const [item] = toDraftItems([{ descripcion: 'Horas', cantidad: 12, precio: 42.75 }])

    expect(item.cantidad).toBe('12')
    expect(item.precio).toBe('42,75')
  })

  it('usa coma también en cantidades fraccionadas', () => {
    const [item] = toDraftItems([{ descripcion: 'Media jornada', cantidad: 1.5, precio: 100 }])

    expect(item.cantidad).toBe('1,50')
  })

  it('conserva el orden recibido', () => {
    const items = toDraftItems([
      { descripcion: 'Primero', cantidad: 1, precio: 10 },
      { descripcion: 'Segundo', cantidad: 1, precio: 20 },
      { descripcion: 'Tercero', cantidad: 1, precio: 30 },
    ])

    expect(items.map((i) => i.descripcion)).toEqual(['Primero', 'Segundo', 'Tercero'])
  })

  it('devuelve una fila vacía cuando la cotización no tiene ítems', () => {
    // El editor nunca debe quedar sin ninguna fila donde escribir.
    const items = toDraftItems([])

    expect(items).toHaveLength(1)
    expect(items[0].descripcion).toBe('')
  })
})
