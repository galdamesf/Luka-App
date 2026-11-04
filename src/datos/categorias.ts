import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { ClienteDb } from "./gastos";
import { categoriasDePartida } from "./hogares";

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

/**
 * Pone al dia las categorias de partida en TODOS los hogares: crea las que
 * falten y refresca color, icono, esencial y orden de las que ya estan. Es lo
 * que corre el seed en cada `npm run dev`; repetirlo no duplica nada.
 *
 * Refresca TODO lo que define la categoria en el codigo a proposito, para que
 * al cambiar la paleta, o al mover una categoria de "esencial" a
 * "discrecional", baste con volver a correrlo. Si algun dia quieres
 * personalizar un color a mano, hay que sacar `color` del update o el seed te
 * lo va a pisar.
 */
export async function refrescarCategoriasBase(
  db: Pick<PrismaClient, "hogar" | "categoria"> = prisma,
): Promise<{ hogares: number; creadas: number; actualizadas: number }> {
  const hogares = await db.hogar.findMany({ select: { id: true }, orderBy: { creadoEn: "asc" } });
  let creadas = 0;
  let actualizadas = 0;

  for (const { id: hogarId } of hogares) {
    const existentes = new Set(
      (await db.categoria.findMany({ where: { hogarId }, select: { nombre: true } })).map((c) => c.nombre),
    );
    for (const categoria of categoriasDePartida()) {
      const { nombre, color, icono, esencial, orden } = categoria;
      await db.categoria.upsert({
        where: { hogarId_nombre: { hogarId, nombre } },
        update: { color, icono, esencial, orden },
        create: { ...categoria, hogarId },
      });
      if (existentes.has(nombre)) actualizadas += 1;
      else creadas += 1;
    }
  }

  return { hogares: hogares.length, creadas, actualizadas };
}
