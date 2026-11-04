import { PrismaClient } from "@prisma/client";
import { refrescarCategoriasBase } from "../src/datos/categorias";

const prisma = new PrismaClient();

/**
 * Carga las categorias base en cada hogar. Es idempotente: se puede correr
 * las veces que sea sin duplicar nada. Lo que hace, y por que refresca todos
 * los campos, esta en refrescarCategoriasBase (src/datos/categorias.ts).
 */
async function main() {
  const { hogares, creadas, actualizadas } = await refrescarCategoriasBase(prisma);
  const total = await prisma.categoria.count();
  console.log(
    `Seed listo: ${creadas} nueva(s), ${actualizadas} actualizada(s), ${total} en total, en ${hogares} ${hogares === 1 ? "hogar" : "hogares"}.`,
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
