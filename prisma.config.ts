import { defineConfig } from "prisma/config";
import { cargarEnv } from "./src/lib/env";

// Con prisma.config.ts presente, Prisma 6 ya no carga .env solo. Sin esta
// llamada, cualquier comando de prisma falla con P1012: "Environment variable
// not found: DATABASE_URL".
cargarEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
