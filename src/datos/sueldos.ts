import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import { ordenarMiembros } from "@/dominio/hogar";
import {
  aportesDelMes,
  cierreDeSueldos,
  ingresosDelMes,
  type Aporte,
  type FilaDeSueldo,
  type IngresosDelMes,
} from "@/dominio/sueldos";

/*
  Los sueldos de cada hogar: cada miembro tiene el suyo, uno por mes desde el
  que rige. Las reglas (la suma, el cierre al salir) estan en
  src/dominio/sueldos.ts. Como en todo el acceso a datos, cada funcion recibe
  primero el hogar de quien mira.
*/

type ClienteSueldos = Pick<PrismaClient, "sueldo">;

export type SueldoPlano = FilaDeSueldo & {
  id: string;
  nota: string | null;
};

type FilaSueldo = {
  id: string;
  miembroId: string | null;
  monto: number;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
  nota: string | null;
};

const CAMPOS = { id: true, miembroId: true, monto: true, vigenteDesde: true, vigenteHasta: true, nota: true } as const;

function aPlano(fila: FilaSueldo): SueldoPlano {
  return {
    id: fila.id,
    miembroId: fila.miembroId,
    monto: fila.monto,
    // Por el helper: leer un @db.Date con metodos locales corre el dia y, en
    // el primero del mes, eso cambia el mes entero.
    vigenteDesde: mesDesdeFecha(fila.vigenteDesde),
    vigenteHasta: fila.vigenteHasta === null ? null : mesDesdeFecha(fila.vigenteHasta),
    nota: fila.nota,
  };
}

/** Todos los sueldos del hogar, de todos sus miembros, del mas reciente al mas antiguo. */
export async function listarSueldos(hogarId: string, db: ClienteSueldos = prisma): Promise<SueldoPlano[]> {
  const filas = (await db.sueldo.findMany({
    where: { hogarId },
    orderBy: { vigenteDesde: "desc" },
    select: CAMPOS,
  })) as FilaSueldo[];
  return filas.map(aPlano);
}

/**
 * Define el sueldo de un miembro desde un mes. Si ya habia uno suyo para ese
 * mes, lo reemplaza: corregir un monto mal tipeado no deberia crear una fila
 * nueva. La base rechaza el sueldo de alguien que no es del hogar (la llave
 * va por el miembro y el hogar).
 */
export async function definirSueldo(
  hogarId: string,
  miembroId: string,
  mes: string,
  monto: number,
  nota: string | null,
  db: ClienteSueldos = prisma,
): Promise<SueldoPlano> {
  const vigenteDesde = rangoDelMesISO(mes).desde;

  const fila = (await db.sueldo.upsert({
    where: { miembroId_vigenteDesde: { miembroId, vigenteDesde } },
    update: { monto, nota },
    create: { hogarId, miembroId, monto, nota, vigenteDesde },
    select: CAMPOS,
  })) as FilaSueldo;

  return aPlano(fila);
}

/**
 * Lo que entra al hogar en un mes: la suma de los sueldos de todos y el de
 * cada uno. Trae solo las filas que ya empezaron a regir para ese mes.
 */
export async function ingresosDelHogar(
  hogarId: string,
  mes: string,
  db: ClienteSueldos = prisma,
): Promise<IngresosDelMes> {
  const { desde } = rangoDelMesISO(mes);
  const filas = (await db.sueldo.findMany({
    where: { hogarId, vigenteDesde: { lte: desde } },
    select: CAMPOS,
  })) as FilaSueldo[];
  return ingresosDelMes(filas.map(aPlano), mes);
}

/** Lo que entra al hogar en un mes, sumando el sueldo de todos. null si no rige ninguno. */
export async function sueldoDelMes(hogarId: string, mes: string, db: ClienteSueldos = prisma): Promise<number | null> {
  return (await ingresosDelHogar(hogarId, mes, db)).total;
}

export type SueldosDelMes = IngresosDelMes & {
  /** Una fila por miembro que ya entro, con lo que gana ese mes. */
  aportes: Aporte[];
};

/** Lo que muestra el balance: el total y el sueldo de cada miembro, marcando el de quien mira. */
export async function sueldosDelMes(
  hogarId: string,
  mes: string,
  yo: string,
  db: Pick<PrismaClient, "sueldo" | "miembro"> = prisma,
): Promise<SueldosDelMes> {
  const [ingresos, miembros] = await Promise.all([
    ingresosDelHogar(hogarId, mes, db),
    db.miembro.findMany({
      where: { hogarId },
      select: { id: true, correo: true, nombre: true, rol: true, entroEn: true },
    }),
  ]);
  const enOrden = ordenarMiembros(
    miembros.map((m) => ({ ...m, entroEn: m.entroEn === null ? null : m.entroEn.toISOString() })),
  );
  return { ...ingresos, aportes: aportesDelMes(enOrden, ingresos, yo) };
}

export async function eliminarSueldo(
  hogarId: string,
  miembroId: string,
  mes: string,
  db: ClienteSueldos = prisma,
): Promise<void> {
  await db.sueldo.deleteMany({
    where: { hogarId, miembroId, vigenteDesde: rangoDelMesISO(mes).desde },
  });
}

/**
 * El sueldo de antes de los hogares, que esperaba a su dueno, pasa a ser del
 * dueno de «Mi hogar» la primera vez que entra. Va en la misma transaccion.
 */
export async function adoptarSueldoSinDueno(hogarId: string, miembroId: string, tx: ClienteSueldos): Promise<void> {
  await tx.sueldo.updateMany({
    where: { hogarId, miembroId: null, vigenteHasta: null },
    data: { miembroId },
  });
}

/**
 * Cierra el sueldo de alguien que sale del hogar en `mes` (las reglas, en
 * cierreDeSueldos): va dentro de la misma transaccion que lo saca, antes de
 * borrarlo. Mientras tenga un sueldo abierto, la base no deja borrarlo.
 */
export async function cerrarSueldosDe(
  hogarId: string,
  miembroId: string,
  mes: string,
  tx: ClienteSueldos,
): Promise<void> {
  const filas = await tx.sueldo.findMany({
    where: { hogarId, miembroId },
    select: { id: true, vigenteDesde: true },
  });
  const { borrar, cerrar } = cierreDeSueldos(
    filas.map((f) => ({ id: f.id, vigenteDesde: mesDesdeFecha(f.vigenteDesde) })),
    mes,
  );

  if (borrar.length > 0) await tx.sueldo.deleteMany({ where: { id: { in: borrar } } });
  // Las dos cosas en la misma fila y a la vez: la base no acepta un sueldo
  // cerrado que siga siendo de alguien.
  for (const { id, vigenteHasta } of cerrar) {
    await tx.sueldo.update({
      where: { id },
      data: { miembroId: null, vigenteHasta: rangoDelMesISO(vigenteHasta).desde },
    });
  }
}
