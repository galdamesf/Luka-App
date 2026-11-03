import type { PrismaClient } from "@prisma/client";
import { compararMeses, mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import type { DatosDeUnMes, DeudaParaMover, PlanMovimiento } from "@/dominio/mover-mes";

/** Lo de un mes que va anotado con ese mes: cuentas, presupuestos y ahorros. */
export async function leerParaMover(mes: string, db: PrismaClient): Promise<DatosDeUnMes> {
  const dia = rangoDelMesISO(mes).desde;
  const [cuentas, presupuestos, ahorros] = await Promise.all([
    db.cuenta.findMany({
      where: { mes: dia },
      select: { id: true, nombre: true, monto: true, pagadaEn: true, boletaArchivo: true },
      orderBy: { nombre: "asc" },
    }),
    db.presupuesto.findMany({
      where: { mes: dia },
      select: { id: true, categoriaId: true, monto: true, categoria: { select: { nombre: true } } },
    }),
    db.ahorro.findMany({ where: { mes: dia }, select: { id: true, monto: true, nota: true } }),
  ]);

  return {
    cuentas: cuentas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      monto: c.monto,
      pagada: c.pagadaEn !== null,
      conBoleta: c.boletaArchivo !== null,
    })),
    presupuestos: presupuestos.map((p) => ({
      id: p.id,
      categoriaId: p.categoriaId,
      categoriaNombre: p.categoria.nombre,
      monto: p.monto,
    })),
    ahorros,
  };
}

/** Todas las deudas, activas o no, con todos sus pagos. */
export async function leerDeudasParaMover(db: PrismaClient): Promise<DeudaParaMover[]> {
  const deudas = await db.deuda.findMany({
    select: {
      id: true,
      nombre: true,
      primeraCuota: true,
      cuotasTotales: true,
      cuotasPagadas: { select: { id: true, mes: true, monto: true }, orderBy: { mes: "asc" } },
    },
    orderBy: { nombre: "asc" },
  });

  return deudas.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    // Siempre por el helper: leer un @db.Date con metodos locales corre el dia.
    primeraCuota: mesDesdeFecha(d.primeraCuota),
    cuotasTotales: d.cuotasTotales,
    pagos: d.cuotasPagadas.map((p) => ({ id: p.id, mes: mesDesdeFecha(p.mes), monto: p.monto })),
  }));
}

/**
 * Aplica el plan en una sola transaccion: o se mueve todo o no se mueve
 * nada. Primero se quitan las copias que sobran, porque la cuenta que llega
 * tiene el mismo nombre y el par (nombre, mes) es unico.
 *
 * Los pagos de cuota tambien tienen un par unico (deuda, mes), y se corren
 * de a uno: al avanzar se parte por el mas nuevo, para que noviembre deje
 * libre su lugar antes de que llegue octubre. Al retroceder, al reves.
 */
export async function aplicarMovimiento(plan: PlanMovimiento, hasta: string, db: PrismaClient): Promise<void> {
  const mes = rangoDelMesISO(hasta).desde;
  const ids = <T extends { id: string }>(filas: T[]) => filas.map((f) => f.id);

  const avanza = plan.pagos.some((p) => compararMeses(p.nuevoMes, p.mes) > 0);
  const pagosEnOrden = [...plan.pagos].sort((a, b) =>
    avanza ? compararMeses(b.mes, a.mes) : compararMeses(a.mes, b.mes),
  );

  await db.$transaction([
    db.cuenta.deleteMany({ where: { id: { in: ids(plan.copiasQueSobran) } } }),
    db.cuenta.updateMany({ where: { id: { in: ids(plan.cuentas) } }, data: { mes } }),
    db.presupuesto.updateMany({ where: { id: { in: ids(plan.presupuestos) } }, data: { mes } }),
    db.ahorro.updateMany({ where: { id: { in: ids(plan.ahorros) } }, data: { mes } }),
    ...plan.deudas.map((d) =>
      db.deuda.update({ where: { id: d.id }, data: { primeraCuota: rangoDelMesISO(d.nuevaPrimeraCuota).desde } }),
    ),
    ...pagosEnOrden.map((p) =>
      db.cuotaPagada.update({ where: { id: p.id }, data: { mes: rangoDelMesISO(p.nuevoMes).desde } }),
    ),
  ]);
}
