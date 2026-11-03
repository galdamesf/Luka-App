import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/*
  Dos proyectos a proposito, para poder correr solo lo que toca la seccion en
  que estas en vez de la suite completa:

    npm run test:unit   logica pura, sin base de datos (medio segundo)
    npm run test:db     integracion contra Postgres
    npm run test        los dos

  Los proyectos heredan la configuracion de la raiz: `extends` es true por
  omision en Vitest 5.
*/
export default defineConfig({
  // tsconfig deja el JSX tal cual ("preserve") porque lo compila Next. Los
  // tests que dibujan un componente con react-dom/server necesitan que Vitest
  // lo compile, con el runtime automatico de React.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Sin paralelismo entre archivos: los tests de integracion comparten una
    // sola base de datos. Es opcion de raiz, no de proyecto.
    fileParallelism: false,
    // Zona fija: sin esto los tests de fecha pasarian por accidente en UTC.
    env: {
      TZ: "America/Santiago",
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["./tests/db/global-setup.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
