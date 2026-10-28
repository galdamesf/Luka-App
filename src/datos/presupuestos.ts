import { prisma } from "@/lib/prisma";
import { isoDesdeFecha, mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import type { PresupuestoPlano } from "@/dominio/presupuestos";
import type { EdicionPresupuestoValidado, PresupuestoValidado } from "@/dominio/esquemas";
import type { ClienteDb } from "./gastos";

const CATEGORIA_INCLUIDA = {
  categoria: {
    select: { id: true, nombre: true, color: true, icono: true, esencial: true },
  },
} as const;

type FilaPresupuesto = {
  id: string;
  mes: Date;
  monto: number;
  creadoEn: Date;
  categoria: {
    id: string;
    nombre: string;
    color: string;
    icono: string;
    esencial: boolean;
  };
};

function aPlano(fila: FilaPresupuesto): PresupuestoPlano {
  return {
    id: fila.id,
    categoria: fila.categoria,
    // Siempre por los helpers: leer un @db.Date con metodos locales corre el
    // dia y, en el primero del mes, eso cambia el mes entero.
    mes: mesDesdeFecha(fila.mes),
    monto: fila.monto,
    creadoEn: isoDesdeFecha(fila.creadoEn),
  };
}

export async function listarPresupuestosDelMes(
  mes: string,
  db: ClienteDb = prisma,
): Promise<PresupuestoPlano[]> {
  const filas = (await db.presupuesto.findMany({
    where: { mes: rangoDelMesISO(mes).desde },
    include: CATEGORIA_INCLUIDA,
    orderBy: [{ monto: "desc" }],
  })) as FilaPresupuesto[];

  return filas.map(aPlano);
}

/**
 * Crea el presupuesto de una categoria para un mes.
 *
 * El par (categoria, mes) es unico en la base: si ya hay uno, se avisa en vez
 * de dejar dos presupuestos peleando por la misma categoria.
 */
export async function crearPresupuesto(
  datos: PresupuestoValidado,
  db: ClienteDb = prisma,
): Promise<PresupuestoPlano> {
  const yaHay = await db.presupuesto.findUnique({
    where: {
      categoriaId_mes: {
        categoriaId: datos.categoriaId,
        mes: rangoDelMesISO(datos.mes).desde,
      },
    },
    select: { id: true },
  });

  if (yaHay !== null) {
    throw new Error("Esa categoría ya tiene presupuesto este mes. Edítalo en vez de crear otro.");
  }

  const fila = (await db.presupuesto.create({
    data: {
      categoriaId: datos.categoriaId,
      mes: rangoDelMesISO(datos.mes).desde,
      monto: datos.monto,
    },
    include: CATEGORIA_INCLUIDA,
  })) as FilaPresupuesto;

  return aPlano(fila);
}

/**
 * Cambia el monto de un presupuesto.
 *
 * Solo el monto: la categoria y el mes son su identidad. Moverlo de categoria
 * seria borrarlo y crear otro, y hacerlo desde un formulario de edicion
 * dejaria a la categoria original sin presupuesto sin que se note.
 */
export async function actualizarPresupuesto(
  datos: EdicionPresupuestoValidado,
  db: ClienteDb = prisma,
): Promise<PresupuestoPlano> {
  const actual = await db.presupuesto.findUnique({
    where: { id: datos.id },
    select: { id: true },
  });
  if (actual === null) throw new Error("Ese presupuesto ya no existe.");

  const fila = (await db.presupuesto.update({
    where: { id: datos.id },
    data: { monto: datos.monto },
    include: CATEGORIA_INCLUIDA,
  })) as FilaPresupuesto;

  return aPlano(fila);
}

export async function eliminarPresupuesto(
  id: string,
  db: ClienteDb = prisma,
): Promise<void> {
  await db.presupuesto.deleteMany({ where: { id } });
}
