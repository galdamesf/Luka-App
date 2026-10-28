import { PrismaClient } from "@prisma/client";
import { CATEGORIAS_CON_COLOR } from "../src/dominio/categorias-base";

const prisma = new PrismaClient();

/**
 * Carga las categorias base. Es idempotente: se puede correr las veces que
 * sea sin duplicar nada.
 *
 * El `update` refresca TODO lo que define la categoria en el codigo (color,
 * icono, esencial y orden) a proposito, para que al cambiar la paleta —o al
 * mover una categoria de "esencial" a "discrecional"— baste con volver a
 * correrlo. Si falta un campo aca, cambiarlo en el codigo no hace nada en las
 * categorias que ya existen: solo en las nuevas. Si algun dia quieres
 * personalizar un color a mano, hay que sacar `color` de ahi o el seed te lo
 * va a pisar.
 */
async function main() {
  let creadas = 0;
  let actualizadas = 0;

  for (const [indice, categoria] of CATEGORIAS_CON_COLOR.entries()) {
    const existente = await prisma.categoria.findUnique({
      where: { nombre: categoria.nombre },
      select: { id: true },
    });

    await prisma.categoria.upsert({
      where: { nombre: categoria.nombre },
      update: {
        color: categoria.color,
        icono: categoria.icono,
        esencial: categoria.esencial,
        orden: indice,
      },
      create: { ...categoria, orden: indice },
    });

    if (existente === null) creadas += 1;
    else actualizadas += 1;
  }

  const total = await prisma.categoria.count();
  console.log(
    `Seed listo: ${creadas} nueva(s), ${actualizadas} actualizada(s), ${total} en total.`,
  );
}

main()
  .catch((error) => {
    console.error("El seed fallo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
