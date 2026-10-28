import { PrismaClient } from "@prisma/client";
import { urlDePrueba } from "@/lib/url-db";

export { urlDePrueba };

export function clienteDePrueba(): PrismaClient {
  return new PrismaClient({ datasourceUrl: urlDePrueba() });
}

/**
 * Deja todas las tablas vacias. CASCADE se encarga del orden de las llaves
 * foraneas. Se nombran todas, incluso las que un test no toque, para que no
 * se filtren filas de un archivo a otro.
 */
export async function limpiar(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "gastos", "categorias", "sueldos", "deudas" RESTART IDENTITY CASCADE',
  );
}
