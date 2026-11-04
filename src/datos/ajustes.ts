import { prisma } from "@/lib/prisma";
import type { ClienteDb } from "./gastos";

export type AjustesPlanos = {
  /** Dia en que empieza el mes de gastos, 1 a 31. */
  diaInicioMes: number;
};

/** Sin fila guardada, el hogar usa el mes calendario. */
export const AJUSTES_POR_OMISION: AjustesPlanos = { diaInicioMes: 1 };

/** Los ajustes del hogar: una fila por hogar, con el hogar como llave. */
export async function leerAjustes(hogarId: string, db: ClienteDb = prisma): Promise<AjustesPlanos> {
  const fila = await db.ajustes.findUnique({
    where: { hogarId },
    select: { diaInicioMes: true },
  });
  return fila ?? AJUSTES_POR_OMISION;
}

export async function definirDiaInicioMes(
  hogarId: string,
  dia: number,
  db: ClienteDb = prisma,
): Promise<AjustesPlanos> {
  return db.ajustes.upsert({
    where: { hogarId },
    update: { diaInicioMes: dia },
    create: { hogarId, diaInicioMes: dia },
    select: { diaInicioMes: true },
  });
}
