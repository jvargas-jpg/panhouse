import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
    globalSetup: './tests/globalSetup.ts',
    // Corre una vez por archivo de test (a diferencia de globalSetup):
    // cierra el pool de conexiones al final de cada archivo, ver
    // tests/setup.ts.
    setupFiles: ['./tests/setup.ts'],
    // Los tests comparten una única base de datos de prueba (misma
    // instancia de Postgres, base "<POSTGRES_DB>_test"); correrlos en
    // paralelo causaría condiciones de carrera al truncar tablas.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
