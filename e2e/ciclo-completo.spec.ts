import { expect, test, type Page } from '@playwright/test'

/**
 * El único camino que ninguna prueba unitaria puede cubrir.
 *
 * Las 37 de Vitest verifican el cálculo del dinero y el editor de ítems con la
 * base mockeada. Lo que no pueden tocar es lo que hace distinto a este proyecto:
 * que una persona SIN CUENTA abra un link, vea exactamente los mismos números que
 * vio quien lo emitió, y pueda responder — todo eso pasando por RLS, por dos
 * funciones `security definer` y por dos motores de cálculo distintos.
 *
 * Por eso el test corre el ciclo entero contra Supabase de verdad, y por eso la
 * página pública se abre en un contexto de navegador aparte: sin sesión, sin
 * cookies y sin localStorage, como le llega al cliente.
 *
 * Limpia lo que crea. Si algo falla en el medio queda una cotización de prueba
 * en la cuenta demo, reconocible por el título con marca de tiempo.
 */

// Un cliente que YA existe en la demo. Guardar con un nombre nuevo crearia una
// ficha, y borrar la cotizacion no borra al cliente: cada corrida del CI dejaba
// residuo en la base de produccion. guardar_cotizacion solo pisa el email si se
// le pasa uno, y aca no se le pasa ninguno, asi que reusar esta ficha no la toca.
const CLIENTE = 'Estudio Marlow'

async function entrarComoDemo(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar como demo' }).click()
  await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible()
}

test('el ciclo completo: crear, enviar, aceptar sin cuenta y verlo en el panel', async ({
  page,
  browser,
}) => {
  const titulo = `Prueba e2e ${Date.now()}`

  // Los window.confirm del editor (borrar, cambios sin guardar) se aceptan solos.
  page.on('dialog', (dialogo) => dialogo.accept())

  await entrarComoDemo(page)

  // ---------------------------------------------------------------------------
  // Crear el presupuesto, ya en "enviada" para que el link muestre algo
  // ---------------------------------------------------------------------------
  await page.getByRole('link', { name: 'Nueva cotización' }).click()

  await page.getByLabel('Cliente', { exact: true }).fill(CLIENTE)
  await page.getByLabel('Título').fill(titulo)
  await page.getByLabel('Descuento (%)').fill('10')
  await page.getByLabel('IVA (%)').fill('22')
  await page.getByLabel('Descripción').fill('Trabajo de prueba')
  await page.getByLabel('Cantidad').fill('2')
  await page.getByLabel('Precio').fill('500')
  await page.getByLabel('Estado').selectOption('enviada')

  // 2 × 500 = 1.000 → −10 % = 900 → +22 % = 1.098
  await expect(page.getByText('Descuento (10 %)')).toBeVisible()
  await expect(page.getByText('IVA (22 %)')).toBeVisible()

  const totalEnElEditor = (await page.getByTestId('total').textContent())?.trim()
  expect(totalEnElEditor).toContain('1.098,00')

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible()

  // ---------------------------------------------------------------------------
  // El link que le llega al cliente
  // ---------------------------------------------------------------------------
  const fila = page.locator('li').filter({ hasText: titulo })
  await expect(fila).toBeVisible()
  await expect(fila.getByText('El cliente todavía no lo abrió.')).toBeVisible()

  const urlPublica = (await fila.locator('code').textContent())?.trim()
  expect(urlPublica).toMatch(/\/c\/[\w-]{12}$/)

  // ---------------------------------------------------------------------------
  // Abrirlo como el cliente: contexto nuevo, sin sesión ni almacenamiento
  // ---------------------------------------------------------------------------
  const contextoDelCliente = await browser.newContext()
  const paginaDelCliente = await contextoDelCliente.newPage()

  try {
    await paginaDelCliente.goto(urlPublica!)

    await expect(paginaDelCliente.getByRole('heading', { name: titulo })).toBeVisible()

    // El corazón del asunto: el importe que calculó Postgres para la página
    // pública tiene que coincidir carácter por carácter con el que calculó
    // JavaScript en el editor. Son dos fórmulas escritas por separado.
    const totalPublico = (await paginaDelCliente.getByTestId('total-publico').textContent())?.trim()
    expect(totalPublico).toBe(totalEnElEditor)

    // El desglose también, renglón por renglón.
    await expect(paginaDelCliente.getByText('Descuento (10 %)')).toBeVisible()
    await expect(paginaDelCliente.getByText('IVA (22 %)')).toBeVisible()

    // ---------------------------------------------------------------------------
    // Antes de responder: el emisor ya tiene que ver que lo abrieron
    // ---------------------------------------------------------------------------
    // Es media función aparte (`registrar_vista`), porque `cotizacion_publica` es
    // `stable` y no puede escribir. Se verifica acá y no al final: en cuanto hay
    // respuesta, el panel muestra el sello en lugar de las visitas.
    await page.reload()
    await expect(
      page.locator('li').filter({ hasText: titulo }).getByText(/^Visto /),
    ).toBeVisible()

    // ---------------------------------------------------------------------------
    // Aceptar, sin cuenta
    // ---------------------------------------------------------------------------
    await paginaDelCliente.getByLabel('Tu nombre').fill('Ana Pérez')
    await paginaDelCliente.getByLabel(/Comentario/).fill('Arrancamos el lunes')
    await paginaDelCliente.getByRole('button', { name: 'Aceptar presupuesto' }).click()

    await expect(paginaDelCliente.getByText(/Presupuesto aprobado por Ana Pérez/)).toBeVisible()
    await expect(paginaDelCliente.getByText('“Arrancamos el lunes”')).toBeVisible()

    // Y el bloque de respuesta ya no está: la respuesta es de una sola vez.
    await expect(
      paginaDelCliente.getByRole('button', { name: 'Aceptar presupuesto' }),
    ).toHaveCount(0)
  } finally {
    await contextoDelCliente.close()
  }

  // ---------------------------------------------------------------------------
  // Lo que ve el emisor al volver al panel
  // ---------------------------------------------------------------------------
  await page.reload()
  const filaRespondida = page.locator('li').filter({ hasText: titulo })

  await expect(filaRespondida.getByText(/Aprobada por Ana Pérez/)).toBeVisible()
  await expect(filaRespondida.getByText('“Arrancamos el lunes”')).toBeVisible()

  // El selector de estado quedó acotado: el panel no puede contradecir al cliente.
  const opciones = await filaRespondida.locator('select').locator('option').allTextContents()
  expect(opciones).toEqual(['Aprobada', 'Cobrada'])

  // ---------------------------------------------------------------------------
  // Limpiar
  // ---------------------------------------------------------------------------
  await filaRespondida.getByRole('link', { name: titulo }).click()
  await page.getByRole('button', { name: 'Borrar' }).last().click()

  await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible()
  await expect(page.locator('li').filter({ hasText: titulo })).toHaveCount(0)
})

test('un slug inventado no revela nada, y sin sesión no se llega al panel', async ({ page }) => {
  await page.goto('/c/noExisteXYZ1')
  await expect(page.getByRole('heading', { name: 'Este presupuesto no está disponible' })).toBeVisible()

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})
