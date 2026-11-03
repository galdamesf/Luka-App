import { prisma } from "@/lib/prisma";
import type { ClienteDb } from "./gastos";

export type AjustesPlanos = {
  /** Dia en que empieza el mes de gastos, 1 a 31. */
  diaInicioMes: number;
};

/** Sin fila guardada, la app usa el mes calendario. */
export const AJUSTES_POR_OMISION: AjustesPlanos = { diaInicioMes: 1 };

const ID = "app";

export async function leerAjustes(db: ClienteDb = prisma): Promise<AjustesPlanos> {
  const fila = await db.ajustes.findUnique({ where: { id: ID }, select: { diaInicioMes: true } });
  return fila ?? AJUSTES_POR_OMISION;
}

export async function definirDiaInicioMes(dia: number, db: ClienteDb = prisma): Promise<AjustesPlanos> {
  return db.ajustes.upsert({
    where: { id: ID },
    update: { diaInicioMes: dia },
    create: { id: ID, diaInicioMes: dia },
    select: { diaInicioMes: true },
  });
}
