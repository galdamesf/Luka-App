import { prisma } from "@/lib/prisma";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { ClienteDb } from "./gastos";

/** Categorias activas, en el orden definido por el seed. */
export async function listarCategoriasActivas(
  db: ClienteDb = prisma,
): Promise<CategoriaPlana[]> {
  return (await db.categoria.findMany({
    where: { activa: true },
    select: { id: true, nombre: true, color: true, icono: true, esencial: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  })) as CategoriaPlana[];
}

/**
 * Desactiva una categoria en vez de borrarla.
 *
 * Borrarla fallaria si tiene gastos (ON DELETE RESTRICT) y, aunque no los
 * tuviera, perder la categoria dejaria el historial sin contexto.
 */
export async function desactivarCategoria(
  id: string,
  db: ClienteDb = prisma,
): Promise<void> {
  await db.categoria.update({ where: { id }, data: { activa: false } });
}

export async function reactivarCategoria(
  id: string,
  db: ClienteDb = prisma,
): Promise<void> {
  await db.categoria.update({ where: { id }, data: { activa: true } });
}
