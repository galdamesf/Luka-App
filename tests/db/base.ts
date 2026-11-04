import { PrismaClient } from "@prisma/client";
import { urlDePrueba } from "@/lib/url-db";

export { urlDePrueba };

/** El hogar donde quedaron los datos de antes de los hogares (ver schema.prisma). */
export const HOGAR_INICIAL = "hogar-inicial";

export function clienteDePrueba(): PrismaClient {
  return new PrismaClient({ datasourceUrl: urlDePrueba() });
}

/**
 * Deja todas las tablas vacias. CASCADE se encarga del orden de las llaves
 * foraneas. Se nombran todas, incluso las que un test no toque, para que no
 * se filtren filas de un archivo a otro.
 *
 * Despues vuelve a poner el hogar inicial, como lo deja la migracion: lo que
 * se crea sin decir de que hogar es cae ahi, y sin el fallaria la llave foranea.
 */
export async function limpiar(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "gastos", "categorias", "sueldos", "deudas", "ahorros", "ajustes", "miembros", "hogares" RESTART IDENTITY CASCADE',
  );
  await prisma.hogar.create({ data: { id: HOGAR_INICIAL, nombre: "Mi hogar" } });
}
