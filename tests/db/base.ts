import { PrismaClient } from "@prisma/client";
import { urlDePrueba, urlDePruebaNube } from "@/lib/url-db";

export { urlDePrueba, urlDePruebaNube };

/** El hogar donde quedaron los datos de antes de los hogares (ver schema.prisma). */
export const HOGAR_INICIAL = "hogar-inicial";

export function clienteDePrueba(): PrismaClient {
  return new PrismaClient({ datasourceUrl: urlDePrueba() });
}

/** La segunda base de pruebas, que hace de «la nube» (ver global-setup.ts). */
export function clienteDeLaNube(): PrismaClient {
  return new PrismaClient({ datasourceUrl: urlDePruebaNube() });
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

let correlativo = 0;

/**
 * Un miembro de un hogar, para los tests que lo necesitan (por ejemplo, para
 * anotar su sueldo). Por omision, el dueno del hogar inicial, que ya entro.
 */
export async function miembroDePrueba(
  prisma: PrismaClient,
  {
    hogarId = HOGAR_INICIAL,
    correo,
    nombre = null,
    rol = "DUENO",
    entro = true,
  }: { hogarId?: string; correo?: string; nombre?: string | null; rol?: "DUENO" | "MIEMBRO"; entro?: boolean } = {},
): Promise<string> {
  correlativo += 1;
  const fila = await prisma.miembro.create({
    data: {
      hogarId,
      correo: correo ?? `persona-${correlativo}@prueba.cl`,
      nombre,
      rol,
      entroEn: entro ? new Date("2026-11-01T12:00:00Z") : null,
    },
    select: { id: true },
  });
  return fila.id;
}
