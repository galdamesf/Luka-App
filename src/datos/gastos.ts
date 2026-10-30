import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, rangoDelMesISO } from "@/lib/fecha";
import { aPlano, type GastoPlano } from "@/dominio/resumen";
import type { GastoParcial, GastoValidado } from "@/dominio/esquemas";

/**
 * Acceso a la tabla de gastos.
 *
 * Todas las funciones reciben el cliente como ultimo parametro, con el
 * singleton por omision. Eso es lo que deja que los tests de integracion le
 * pasen el cliente que apunta a la base _test en vez de a la de trabajo.
 */
export type ClienteDb = Pick<
  PrismaClient,
  | "gasto"
  | "categoria"
  | "sueldo"
  | "deuda"
  | "cuenta"
  | "cuotaPagada"
  | "presupuesto"
  | "ahorro"
  | "$queryRaw"
>;

/**
 * Campos de la categoria que necesita la interfaz, mas el enlace a la cuota
 * de deuda que haya generado el gasto.
 *
 * La cuota importa aunque casi nunca este: los gastos que vienen de pagar una
 * cuota no se suman con los demas (el balance ya descuenta las cuotas por su
 * lado) y se muestran en su propia seccion. Sin este include, aPlano los
 * daria como gastos normales y la cuota se restaria dos veces.
 */
const CATEGORIA_INCLUIDA = {
  categoria: {
    select: { id: true, nombre: true, color: true, icono: true, esencial: true },
  },
  cuota: {
    select: { deudaId: true, deuda: { select: { nombre: true } } },
  },
} as const;

/** Lo que Prisma devuelve con esa inclusion. */
type FilaGasto = {
  id: string;
  fecha: Date;
  descripcion: string;
  monto: number;
  medioPago: string;
  notas: string | null;
  boletaArchivo: string | null;
  cuota: { deudaId: string; deuda: { nombre: string } | null } | null;
  categoria: {
    id: string;
    nombre: string;
    color: string;
    icono: string;
    esencial: boolean;
  };
};

/** Gastos de un mes, del mas reciente al mas antiguo. */
export async function listarGastosDelMes(
  mes: string,
  db: ClienteDb = prisma,
): Promise<GastoPlano[]> {
  const { desde, hasta } = rangoDelMesISO(mes);

  const filas = (await db.gasto.findMany({
    where: { fecha: { gte: desde, lt: hasta } },
    include: CATEGORIA_INCLUIDA,
    // Por fecha, y a igual fecha el ultimo ingresado primero.
    orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
  })) as FilaGasto[];

  return filas.map(aPlano);
}

export async function obtenerGasto(
  id: string,
  db: ClienteDb = prisma,
): Promise<GastoPlano | null> {
  const fila = (await db.gasto.findUnique({
    where: { id },
    include: CATEGORIA_INCLUIDA,
  })) as FilaGasto | null;

  return fila === null ? null : aPlano(fila);
}

export async function crearGasto(
  datos: GastoValidado,
  db: ClienteDb = prisma,
): Promise<GastoPlano> {
  const fila = (await db.gasto.create({
    data: {
      // Siempre por el helper: construir la fecha a mano corre el dia en Chile.
      fecha: fechaDesdeISO(datos.fecha),
      descripcion: datos.descripcion,
      monto: datos.monto,
      medioPago: datos.medioPago,
      notas: datos.notas,
      categoriaId: datos.categoriaId,
      boletaArchivo: datos.boletaArchivo ?? null,
    },
    include: CATEGORIA_INCLUIDA,
  })) as FilaGasto;

  return aPlano(fila);
}

export async function actualizarGasto(
  id: string,
  cambios: GastoParcial,
  db: ClienteDb = prisma,
): Promise<GastoPlano> {
  // Solo se mandan los campos presentes: `undefined` en Prisma significa
  // "no tocar", pero construir el objeto explicito evita sorpresas.
  const data: Record<string, unknown> = {};
  if (cambios.fecha !== undefined) data.fecha = fechaDesdeISO(cambios.fecha);
  if (cambios.descripcion !== undefined) data.descripcion = cambios.descripcion;
  if (cambios.monto !== undefined) data.monto = cambios.monto;
  if (cambios.medioPago !== undefined) data.medioPago = cambios.medioPago;
  if (cambios.notas !== undefined) data.notas = cambios.notas;
  if (cambios.categoriaId !== undefined) data.categoriaId = cambios.categoriaId;

  const fila = (await db.gasto.update({
    where: { id },
    data,
    include: CATEGORIA_INCLUIDA,
  })) as FilaGasto;

  return aPlano(fila);
}

export async function eliminarGasto(id: string, db: ClienteDb = prisma): Promise<void> {
  await db.gasto.delete({ where: { id } });
}

/**
 * Meses que tienen al menos un gasto, del mas reciente al mas antiguo.
 * Alimenta el selector de mes: no tiene sentido ofrecer meses vacios.
 *
 * Va en SQL crudo porque Prisma no sabe agrupar por `date_trunc`.
 */
export async function mesesConGastos(db: ClienteDb = prisma): Promise<string[]> {
  const filas = (await db.$queryRaw`
    SELECT DISTINCT to_char("fecha", 'YYYY-MM') AS mes
    FROM "gastos"
    ORDER BY mes DESC
  `) as Array<{ mes: string }>;

  return filas.map((fila) => fila.mes);
}
