import { prisma } from "@/lib/prisma";
import type { ClienteDb } from "./gastos";
import { HOGAR_DE_TRANSICION } from "./hogares";

export type AjustesPlanos = {
  /** Dia en que empieza el mes de gastos, 1 a 31. */
  diaInicioMes: number;
};

/** Sin fila guardada, la app usa el mes calendario. */
export const AJUSTES_POR_OMISION: AjustesPlanos = { diaInicioMes: 1 };

export async function leerAjustes(db: ClienteDb = prisma): Promise<AjustesPlanos> {
  const fila = await db.ajustes.findUnique({
    where: { hogarId: HOGAR_DE_TRANSICION },
    select: { diaInicioMes: true },
  });
  return fila ?? AJUSTES_POR_OMISION;
}

export async function definirDiaInicioMes(dia: number, db: ClienteDb = prisma): Promise<AjustesPlanos> {
  return db.ajustes.upsert({
    where: { hogarId: HOGAR_DE_TRANSICION },
    update: { diaInicioMes: dia },
    create: { hogarId: HOGAR_DE_TRANSICION, diaInicioMes: dia },
    select: { diaInicioMes: true },
  });
}
