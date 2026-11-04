import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { carpetaDelHogar, nombreValido } from "@/lib/boletas";

export type OrdenDeBoletas = {
  /** Las que se pasaron a la carpeta de su hogar. */
  movidas: number;
  /** Las que quedan sueltas porque ningun gasto ni cuenta las usa. */
  sinDueno: string[];
};

/**
 * Pasa las boletas sueltas de la carpeta de boletas (las de antes de los
 * hogares) a la carpeta del hogar que las usa: boletas/<hogar>/<archivo>.
 *
 * El hogar se saca de la base: es el del gasto o la cuenta que tiene esa
 * boleta. Las que nadie usa se dejan donde estan, sin borrar nada, y se
 * cuentan para avisar.
 *
 * Repetirla no hace dano: una vez ordenadas, ya no hay boletas sueltas. Si en
 * la carpeta del hogar ya hay un archivo con ese nombre, no se pisa.
 */
export async function ordenarBoletasSueltas(
  raiz: string,
  db: Pick<PrismaClient, "gasto" | "cuenta">,
): Promise<OrdenDeBoletas> {
  let entradas: string[];
  try {
    entradas = await readdir(raiz);
  } catch (error) {
    // Sin carpeta de boletas no hay nada que ordenar.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { movidas: 0, sinDueno: [] };
    throw error;
  }

  const sueltas: string[] = [];
  for (const nombre of entradas.filter(nombreValido)) {
    if ((await stat(join(raiz, nombre))).isFile()) sueltas.push(nombre);
  }
  if (sueltas.length === 0) return { movidas: 0, sinDueno: [] };

  const [gastos, cuentas] = await Promise.all([
    db.gasto.findMany({ where: { boletaArchivo: { in: sueltas } }, select: { boletaArchivo: true, hogarId: true } }),
    db.cuenta.findMany({ where: { boletaArchivo: { in: sueltas } }, select: { boletaArchivo: true, hogarId: true } }),
  ]);
  const hogarDe = new Map<string, string>();
  for (const fila of [...gastos, ...cuentas]) {
    if (fila.boletaArchivo !== null && !hogarDe.has(fila.boletaArchivo)) {
      hogarDe.set(fila.boletaArchivo, fila.hogarId);
    }
  }

  let movidas = 0;
  const sinDueno: string[] = [];
  for (const nombre of sueltas) {
    const hogarId = hogarDe.get(nombre);
    if (hogarId === undefined) {
      sinDueno.push(nombre);
      continue;
    }
    const destino = carpetaDelHogar(hogarId, raiz);
    await mkdir(destino, { recursive: true });
    const ya = await stat(join(destino, nombre)).then(() => true, () => false);
    if (ya) continue;
    await rename(join(raiz, nombre), join(destino, nombre));
    movidas += 1;
  }

  return { movidas, sinDueno };
}
