import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  /**
   * Cortar el build si faltan las credenciales.
   *
   * Sin esto Vite reemplaza `import.meta.env.VITE_SUPABASE_URL` por `undefined`,
   * el build termina en verde y el error recién aparece en el navegador de quien
   * entra: pantalla en blanco. Ya pasó una vez en producción — un deploy "READY"
   * sirviendo una app que no arranca es peor que un deploy que falla, porque nadie
   * se entera hasta que un cliente abre el link.
   *
   * Solo en `build`: en `dev` conviene que el servidor levante igual y que el
   * mensaje de src/lib/supabase.ts explique qué falta.
   */
  if (command === 'build') {
    const faltantes = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
      (clave) => !env[clave] && !process.env[clave],
    )

    if (faltantes.length > 0) {
      throw new Error(
        `Faltan ${faltantes.join(' y ')} en el build. ` +
          'En local van en .env.local; en Vercel, en las variables de entorno del ' +
          'proyecto o en el bloque build.env de vercel.json.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
