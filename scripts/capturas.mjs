/**
 * Regenera las capturas del README.
 *
 *   npm run capturas                        # contra el dev server local
 *   COTI_URL=https://tu-demo.vercel.app npm run capturas
 *
 * Correrlo contra la demo desplegada es lo que hace que los links del panel
 * salgan con el dominio real y no con localhost.
 */
import { chromium } from '@playwright/test'

const BASE = process.env.COTI_URL ?? 'http://localhost:5173'
const SLUG = process.env.COTI_SLUG ?? 'Gh4zJFsjA4O2'

const navegador = await chromium.launch()

// El panel primero: si abriéramos antes el link público, nuestra propia visita
// quedaría registrada y el panel diría "visto hace unos segundos" en vez de
// mostrar un seguimiento realista.
const panel = await navegador.newContext({ viewport: { width: 1280, height: 900 } })
const paginaPanel = await panel.newPage()

await paginaPanel.goto(`${BASE}/login`)
await paginaPanel.getByRole('button', { name: 'Entrar como demo' }).click()

// Esperar el encabezado NO alcanza: se renderiza antes que la lista y la captura
// sale con el spinner de "Cargando cotizaciones…". Hay que esperar contenido real.
await paginaPanel.locator('li').first().waitFor()
await paginaPanel.getByRole('button', { name: /^Todas/ }).waitFor()
await paginaPanel.waitForTimeout(600)
await paginaPanel.screenshot({ path: 'docs/coti-panel.png', fullPage: true })
await panel.close()

for (const [nombre, viewport, extra] of [
  ['docs/coti-publica-escritorio.png', { width: 1280, height: 900 }, {}],
  [
    'docs/coti-publica-movil.png',
    { width: 390, height: 844 },
    { deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ],
]) {
  const contexto = await navegador.newContext({ viewport, ...extra })
  const pagina = await contexto.newPage()

  await pagina.goto(`${BASE}/c/${SLUG}`)
  await pagina.getByRole('button', { name: 'Aceptar presupuesto' }).waitFor()
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: nombre, fullPage: true })

  await contexto.close()
}

await navegador.close()
console.log(`Capturas listas en docs/ (contra ${BASE})`)
