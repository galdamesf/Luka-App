import { prisma } from "@/lib/prisma";
import { isoDesdeFecha, mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import type { AhorroPlano } from "@/dominio/ahorros";
import type { AhorroValidado } from "@/dominio/esquemas";
import type { ClienteDb } from "./gastos";

type FilaAhorro = {
  id: string;
  mes: Date;
  monto: number;
  nota: string | null;
  creadoEn: Date;
};

function aPlano(fila: FilaAhorro): AhorroPlano {
  return {
    id: fila.id,
    // Por los helpers: leer un @db.Date con metodos locales corre el dia y,
    // en el primero del mes, eso cambia el mes entero.
    mes: mesDesdeFecha(fila.mes),
    monto: fila.monto,
    nota: fila.nota,
    creadoEn: isoDesdeFecha(fila.creadoEn),
  };
}

/**
 * Todos los ahorros hasta `mes`, ese incluido, del mas nuevo al mas antiguo.
 * De ahi salen los del mes, el total acumulado y el historial: son pocas
 * filas al ano, no vale la pena una consulta por cada cosa.
 */
export async function listarAhorrosHasta(
  mes: string,
  db: ClienteDb = prisma,
): Promise<AhorroPlano[]> {
  const filas = (await db.ahorro.findMany({
    where: { mes: { lte: rangoDelMesISO(mes).desde } },
    orderBy: [{ mes: "desc" }, { creadoEn: "desc" }],
  })) as FilaAhorro[];
  return filas.map(aPlano);
}

export async function crearAhorro(
  datos: AhorroValidado,
  db: ClienteDb = prisma,
): Promise<AhorroPlano> {
  const fila = (await db.ahorro.create({
    data: { mes: rangoDelMesISO(datos.mes).desde, monto: datos.monto, nota: datos.nota },
  })) as FilaAhorro;
  return aPlano(fila);
}

/** Borra un ahorro. Si ya no existe no pasa nada: el resultado es el mismo. */
export async function eliminarAhorro(id: string, db: ClienteDb = prisma): Promise<void> {
  await db.ahorro.deleteMany({ where: { id } });
}
