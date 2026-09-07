import { describe, expect, it } from 'vitest'

import {
  centsToAmount,
  computeTotals,
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

  it('redondea cada línea antes de sumar, igual que Postgres', () => {
    // 1,5 × 33,33 = 49,995. Si se sumara sin redondear, la línea se imprimiría
    // como 50,00 y el total como 49,99: la columna de importes no sumaría el
    // total que está justo abajo. La migración 0004 hace el mismo round(., 2)
    // dentro del sum para que la página pública y el editor no discrepen.
    expect(totalFromItems([{ cantidad: 1.5, precio: 33.33 }])).toBe(50)

    expect(
      totalFromItems([
        { cantidad: 1.5, precio: 33.33 },
        { cantidad: 1.5, precio: 33.33 },
      ]),
    ).toBe(100)
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
    expect(formatMoney(1660, 'UYU')).toMatch(/1[.\s]660,00/)
    expect(formatMoney(5, 'UYU')).toMatch(/5,00/)
  })

  it('no imprime NaN si le llega un valor corrupto', () => {
    expect(formatMoney(Number.NaN, 'UYU')).toMatch(/0,00/)
  })
})

describe('computeTotals', () => {
  const ITEMS = [
    { cantidad: 2, precio: 500 },
    { cantidad: 1, precio: 200 },
  ]

  it('sin descuento ni IVA el total es el subtotal', () => {
    const totales = computeTotals(ITEMS, { descuento: 0, iva: 0 })

    expect(totales.subtotal).toBe(1200)
    expect(totales.descuento_monto).toBe(0)
    expect(totales.neto).toBe(1200)
    expect(totales.iva_monto).toBe(0)
    expect(totales.total).toBe(1200)
  })

  it('calcula el descuento sobre el subtotal y el IVA sobre el neto', () => {
    // Para el TOTAL el orden da igual: dos porcentajes conmutan. Lo que cambia, y
    // es lo que se imprime renglón por renglón en el documento, es el monto de IVA:
    // sobre el neto son 237,60 y sobre el subtotal serían 264. Un cliente que
    // controla el IVA de una factura mira ese número, no solo el total.
    const totales = computeTotals(ITEMS, { descuento: 10, iva: 22 })

    expect(totales.subtotal).toBe(1200)
    expect(totales.descuento_monto).toBe(120)
    expect(totales.neto).toBe(1080)
    expect(totales.iva_monto).toBe(237.6)
    expect(totales.total).toBe(1317.6)
  })

  it('redondea el descuento y el IVA al centavo', () => {
    // 333,33 con 15 % de descuento da 49,9995, que tiene que quedar en 50,00 y no
    // arrastrar milésimas hasta el total.
    const totales = computeTotals([{ cantidad: 1, precio: 333.33 }], {
      descuento: 15,
      iva: 22,
    })

    expect(totales.descuento_monto).toBe(50)
    expect(totales.neto).toBe(283.33)
    expect(totales.iva_monto).toBe(62.33)
    expect(totales.total).toBe(345.66)
  })

  it('el desglose cierra: neto + IVA da exactamente el total', () => {
    // Si alguno de los renglones se redondeara por su cuenta, el documento
    // mostraría una suma que no da, que es justo lo que un cliente verifica.
    const totales = computeTotals(
      [
        { cantidad: 3, precio: 19.99 },
        { cantidad: 7, precio: 4.33 },
      ],
      { descuento: 7.5, iva: 22 },
    )

    expect(totales.subtotal - totales.descuento_monto).toBe(totales.neto)
    expect(totales.neto + totales.iva_monto).toBeCloseTo(totales.total, 10)
  })

  it('sin ítems devuelve todo en cero', () => {
    const totales = computeTotals([], { descuento: 22, iva: 22 })

    expect(totales.subtotal).toBe(0)
    expect(totales.total).toBe(0)
  })
})
