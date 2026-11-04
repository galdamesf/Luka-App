import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO } from "@/lib/fecha";
import { aPeriodo, rangoDelPeriodo, type Periodo } from "@/lib/periodo";
import { aPlano, type GastoPlano } from "@/dominio/resumen";
import type { GastoParcial, GastoValidado } from "@/dominio/esquemas";

/**
 * Acceso a la tabla de gastos.
 *
 * Todas las funciones reciben primero el hogar de quien mira (el de la
 * sesion, ver src/lib/hogar-actual.ts) y solo leen o tocan lo de ese hogar:
 * un id de otro hogar se comporta como si no existiera.
 *
 * Y reciben el cliente como ultimo parametro, con el singleton por omision.
 * Eso es lo que deja que los tests de integracion le pasen el cliente que
 * apunta a la base _test en vez de a la de trabajo.
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
  | "ajustes"
  | "$queryRaw"
>;

/**
 * Campos de la categoria que necesita la interfaz, mas el enlace a la cuota
 * de deuda que haya generado el gasto.
 *
 * La cuota importa aunque casi nunca este: los gastos que vienen de pagar una
 * cuota no se suman con los demas (el balance ya descuenta las cuotas por su
 * lado) y en Movimientos se marcan como cuota. Sin este include, aPlano los
 * daria como gastos normales y la cuota se restaria dos veces.
 */
const CATEGORIA_INCLUIDA = {
  categoria: {
    select: { id: true, nombre: true, color: true, icono: true, esencial: true },
  },
  cuota: {
    select: { deudaId: true, deuda: { select: { nombre: true } } },
  },
  cuenta: { select: { id: true, nombre: true } },
  // Quien lo anoto: en un hogar de varias personas, cada gasto lo dice.
  anotadoPor: { select: { nombre: true, correo: true } },
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
  cuenta: { id: string; nombre: string } | null;
  anotadoPor: { nombre: string | null; correo: string } | null;
  categoria: {
    id: string;
    nombre: string;
    color: string;
    icono: string;
    esencial: boolean;
  };
};

/**
 * Gastos de un periodo, del mas reciente al mas antiguo. Con un "YYYY-MM"
 * suelto, los del mes calendario.
 */
export async function listarGastosDelMes(
  hogarId: string,
  mes: string | Periodo,
  db: ClienteDb = prisma,
): Promise<GastoPlano[]> {
  const { desde, hasta } = rangoDelPeriodo(aPeriodo(mes));

  const filas = (await db.gasto.findMany({
    where: { hogarId, fecha: { gte: desde, lt: hasta } },
    include: CATEGORIA_INCLUIDA,
    // Por fecha, y a igual fecha el ultimo ingresado primero.
    orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
  })) as FilaGasto[];

  return filas.map(aPlano);
}

export async function obtenerGasto(
  hogarId: string,
  id: string,
  db: ClienteDb = prisma,
): Promise<GastoPlano | null> {
  const fila = (await db.gasto.findFirst({
    where: { id, hogarId },
    include: CATEGORIA_INCLUIDA,
  })) as FilaGasto | null;

  return fila === null ? null : aPlano(fila);
}

/**
 * Anota un gasto en el hogar. `anotadoPorId` es el miembro que lo anota (el
 * de la sesion, nunca del formulario). La categoria tiene que ser del mismo
 * hogar: si no, la base lo rechaza (llave por categoria y hogar).
 */
export async function crearGasto(
  hogarId: string,
  datos: GastoValidado & { anotadoPorId?: string | null },
  db: ClienteDb = prisma,
): Promise<GastoPlano> {
  const fila = (await db.gasto.create({
    data: {
      hogarId,
      anotadoPorId: datos.anotadoPorId ?? null,
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
  hogarId: string,
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

  // Un gasto de otro hogar no se encuentra: falla igual que uno que no existe.
  const fila = (await db.gasto.update({
    where: { id, hogarId },
    data,
    include: CATEGORIA_INCLUIDA,
  })) as FilaGasto;

  return aPlano(fila);
}

/**
 * Borra un gasto.
 *
 * Si el gasto es el pago de una cuota o de una cuenta, ese pago se deshace:
 * la cuota o la cuenta vuelve a quedar pendiente. Sin esto seguirian
 * contando como pagadas sin ningun gasto que lo respalde, y lo que te queda
 * subiria sin que nadie haya devuelto esa plata. Primero se suelta el enlace
 * y despues se borra el gasto, igual que al revertir un pago.
 *
 * Todo dentro del hogar: si el id es de otro hogar, el ultimo paso falla y la
 * transaccion entera se deshace, sin tocar sus cuotas ni sus cuentas.
 */
export async function eliminarGasto(
  hogarId: string,
  id: string,
  db: typeof prisma = prisma,
): Promise<void> {
  await db.$transaction([
    db.cuotaPagada.deleteMany({ where: { gastoId: id, gasto: { hogarId } } }),
    db.cuenta.updateMany({ where: { gastoId: id, hogarId }, data: { pagadaEn: null, gastoId: null } }),
    db.gasto.delete({ where: { id, hogarId } }),
  ]);
}

/**
 * Meses que tienen al menos un gasto, del mas reciente al mas antiguo.
 * Alimenta el selector de mes: no tiene sentido ofrecer meses vacios.
 *
 * Va en SQL crudo porque Prisma no sabe agrupar por `date_trunc`.
 */
export async function mesesConGastos(hogarId: string, db: ClienteDb = prisma): Promise<string[]> {
  const filas = (await db.$queryRaw`
    SELECT DISTINCT to_char("fecha", 'YYYY-MM') AS mes
    FROM "gastos"
    WHERE "hogar_id" = ${hogarId}
    ORDER BY mes DESC
  `) as Array<{ mes: string }>;

  return filas.map((fila) => fila.mes);
}
