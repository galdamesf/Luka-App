import { PrismaClient } from "@prisma/client";

// En desarrollo Next.js recarga los modulos en caliente. Sin este singleton,
// cada recarga abriria un pool nuevo y Postgres se queda sin conexiones.
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
