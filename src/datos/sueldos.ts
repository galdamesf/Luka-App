import { prisma } from "@/lib/prisma";
import { mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import { sueldoVigente } from "@/dominio/balance";
import type { ClienteDb } from "./gastos";

/*
  Los sueldos de cada hogar: uno por mes desde el que rige. Como en todo el
  acceso a datos, cada funcion recibe primero el hogar de quien mira.
*/

export type SueldoPlano = {
  id: string;
  monto: number;
  /** Mes desde el que rige, "YYYY-MM". */
  vigenteDesde: string;
  nota: string | null;
};

type FilaSueldo = {
  id: string;
  monto: number;
  vigenteDesde: Date;
  nota: string | null;
};

function aPlano(fila: FilaSueldo): SueldoPlano {
  return {
    id: fila.id,
    monto: fila.monto,
    // Por el helper: leer un @db.Date con metodos locales corre el dia y, en
    // el primero del mes, eso cambia el mes entero.
    vigenteDesde: mesDesdeFecha(fila.vigenteDesde),
    nota: fila.nota,
  };
}

/** Todos los sueldos, del mas reciente al mas antiguo. */
export async function listarSueldos(hogarId: string, db: ClienteDb = prisma): Promise<SueldoPlano[]> {
  const filas = (await db.sueldo.findMany({
    where: { hogarId },
    orderBy: { vigenteDesde: "desc" },
  })) as FilaSueldo[];
  return filas.map(aPlano);
}

/**
 * Define el sueldo que rige desde un mes. Si ya habia uno para ese mes, lo
 * reemplaza: corregir un monto mal tipeado no deberia crear una fila nueva.
 */
export async function definirSueldo(
  hogarId: string,
  mes: string,
  monto: number,
  nota: string | null,
  db: ClienteDb = prisma,
): Promise<SueldoPlano> {
  const vigenteDesde = rangoDelMesISO(mes).desde;

  const fila = (await db.sueldo.upsert({
    where: { hogarId_vigenteDesde: { hogarId, vigenteDesde } },
    update: { monto, nota },
    create: { hogarId, monto, nota, vigenteDesde },
  })) as FilaSueldo;

  return aPlano(fila);
}

/**
 * Sueldo que rige en un mes, o null si no hay ninguno definido antes.
 *
 * Trae solo los que ya estan rigiendo y se queda con el mas reciente, asi no
 * hay que cargar el historial completo para responder.
 */
export async function sueldoDelMes(
  hogarId: string,
  mes: string,
  db: ClienteDb = prisma,
): Promise<number | null> {
  const { desde } = rangoDelMesISO(mes);

  const filas = (await db.sueldo.findMany({
    where: { hogarId, vigenteDesde: { lte: desde } },
    orderBy: { vigenteDesde: "desc" },
    take: 1,
  })) as FilaSueldo[];

  return sueldoVigente(filas.map(aPlano), mes);
}

export async function eliminarSueldo(hogarId: string, mes: string, db: ClienteDb = prisma): Promise<void> {
  await db.sueldo.delete({
    where: { hogarId_vigenteDesde: { hogarId, vigenteDesde: rangoDelMesISO(mes).desde } },
  });
}
