/**
 * Pasa las boletas de antes de los hogares a la carpeta de su hogar
 * (boletas/<hogar>/). Corre solo con cada `npm run dev`, despues de las
 * migraciones; una vez ordenadas, no hace nada y no dice nada.
 *
 * No borra ni pisa ningun archivo: lo que nadie usa se queda donde esta.
 */
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { carpetaDeBoletas } from "../src/lib/boletas";
import { ordenarBoletasSueltas } from "../src/datos/boletas";

cargarEnv();

async function main() {
  const prisma = new PrismaClient();
  try {
    const { movidas, sinDueno } = await ordenarBoletasSueltas(carpetaDeBoletas(), prisma);
    if (movidas === 0) return;
    console.log(`Boletas: ${movidas} ${movidas === 1 ? "pasó" : "pasaron"} a la carpeta de su hogar.`);
    // Las sueltas se cuentan solo la vez que se ordena, no en cada arranque.
    if (sinDueno.length > 0) {
      console.log(
        `Boletas: ${sinDueno.length} ${sinDueno.length === 1 ? "queda suelta" : "quedan sueltas"} en boletas/ ` +
          "porque ningún gasto ni cuenta la usa. No se borró nada.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudieron ordenar las boletas:", error);
  process.exitCode = 1;
});
