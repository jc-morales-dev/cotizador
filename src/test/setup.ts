import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin esto, los componentes de un test siguen montados en el siguiente y las
// consultas por texto encuentran nodos de pruebas anteriores.
afterEach(() => {
  cleanup()
})
