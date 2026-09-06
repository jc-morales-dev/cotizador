import { describe, expect, it } from 'vitest'

import {
  centsToAmount,
  formatMoney,
  lineTotalCents,
  parseAmount,
  totalFromItems,
} from './money'

describe('parseAmount', () => {
  it('acepta coma decimal, que es como escribe la gente acá', () => {
    expect(parseAmount('240,50')).toBe(240.5)
    expect(parseAmount('240.50')).toBe(240.5)
  })

  it('devuelve 0 con el campo vacío en vez de NaN', () => {
    // Si esto devolviera NaN, el total entero de la cotización se rompería
    // mientras el usuario está borrando un precio para reescribirlo.
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('   ')).toBe(0)
  })

  it('ignora entradas inválidas y negativas', () => {
    expect(parseAmount('abc')).toBe(0)
    expect(parseAmount('-50')).toBe(0)
  })

  it('tolera espacios alrededor', () => {
    expect(parseAmount('  12,5  ')).toBe(12.5)
  })
})

describe('lineTotalCents', () => {
  it('multiplica cantidad por precio en centavos enteros', () => {
    expect(lineTotalCents(12, 42.75)).toBe(51300)
    expect(lineTotalCents(1, 240.5)).toBe(24050)
  })

  it('redondea al centavo más cercano', () => {
    expect(lineTotalCents(3, 0.335)).toBe(101)
  })

  it('da 0 cuando la cantidad o el precio son 0', () => {
    expect(lineTotalCents(0, 999)).toBe(0)
    expect(lineTotalCents(5, 0)).toBe(0)
  })
})

describe('totalFromItems', () => {
  it('no arrastra el error de coma flotante', () => {
    // 0.1 + 0.2 en coma flotante da 0.30000000000000004.
    const total = totalFromItems([
      { cantidad: 1, precio: 0.1 },
      { cantidad: 1, precio: 0.2 },
    ])

    expect(total).toBe(0.3)
    expect(total).not.toBe(0.1 + 0.2)
  })

  it('da un importe exacto en los precios que delatan el redondeo', () => {
    // 7 × 19.99 sin redondear da 139.92999999999998 y se imprimiría como 139,92:
    // un centavo menos que lo que el cliente suma a mano. Con 0.1 y 0.2 el error
    // no aparece, así que hace falta este caso para que el test sirva de algo.
    expect(totalFromItems([{ cantidad: 7, precio: 19.99 }])).toBe(139.93)

    expect(
      totalFromItems([
        { cantidad: 7, precio: 19.99 },
        { cantidad: 3, precio: 0.07 },
        { cantidad: 9, precio: 8.29 },
      ]),
    ).toBe(214.75)
  })

  it('suma un presupuesto realista', () => {
    expect(
      totalFromItems([
        { cantidad: 1, precio: 320 },
        { cantidad: 1, precio: 680 },
        { cantidad: 1, precio: 540 },
        { cantidad: 1, precio: 120 },
      ]),
    ).toBe(1660)
  })

  it('mezcla cantidades múltiples con decimales', () => {
    expect(
      totalFromItems([
        { cantidad: 1, precio: 240.5 },
        { cantidad: 12, precio: 42.75 },
      ]),
    ).toBe(753.5)
  })

  it('devuelve 0 sin ítems', () => {
    expect(totalFromItems([])).toBe(0)
  })
})

describe('centsToAmount', () => {
  it('convierte centavos a importe', () => {
    expect(centsToAmount(51300)).toBe(513)
    expect(centsToAmount(1)).toBe(0.01)
  })
})

describe('formatMoney', () => {
  it('siempre muestra dos decimales', () => {
    expect(formatMoney(1660)).toMatch(/1[.\s]660,00/)
    expect(formatMoney(5)).toMatch(/5,00/)
  })

  it('no imprime NaN si le llega un valor corrupto', () => {
    expect(formatMoney(Number.NaN)).toMatch(/0,00/)
  })
})
