import { prisma } from "@/lib/prisma";
import { periodoDe, rangoDelPeriodo } from "@/lib/periodo";
import { armarSerie, ventanaDeMeses, type SueldoVigencia } from "@/dominio/historico";
import type { PuntoMes } from "@/dominio/estadisticas";
import type { ClienteDb } from "./gastos";

/**
 * Serie de varios meses para el grafico de gastos contra ingresos.
 *
 * Aqui solo se consulta; el armado (limites de mes, meses vacios, sueldo
 * vigente) esta en @/dominio/historico, que se testea sin base de datos.
 *
 * Los ingresos no se suman de una tabla de movimientos: salen de los sueldos
 * vigentes en cada mes (el de cada miembro, sumados), que es como esta
 * modelado el sueldo (fijo, ajustable).
 *
 * Gastos y sueldos, solo los del hogar de quien mira.
 */
export async function serieHistorica(
  hogarId: string,
  mesFinal: string,
  cantidadMeses = 12,
  db: ClienteDb = prisma,
  /** Dia en que empieza cada mes de gastos. 1 es el mes calendario. */
  diaInicio = 1,
): Promise<PuntoMes[]> {
  const ventana = ventanaDeMeses(mesFinal, cantidadMeses);

  // Rango semiabierto [inicio, fin): desde el primer dia del periodo mas
  // antiguo hasta el dia siguiente al ultimo del mas nuevo.
  const { desde } = rangoDelPeriodo(periodoDe(ventana[0] as string, diaInicio));
  const { hasta } = rangoDelPeriodo(periodoDe(ventana.at(-1) as string, diaInicio));

  // Se agrupa por fecha exacta y no por mes porque Prisma no sabe hacer
  // date_trunc; agrupar por dia deja a lo mas ~365 filas que se suman aqui.
  const [porDia, sueldos] = await Promise.all([
    db.gasto.groupBy({
      by: ["fecha"],
      where: { hogarId, fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    }),
    db.sueldo.findMany({
      where: { hogarId, vigenteDesde: { lt: hasta } },
      select: { miembroId: true, monto: true, vigenteDesde: true, vigenteHasta: true },
    }),
  ]);

  return armarSerie(
    mesFinal,
    cantidadMeses,
    (porDia as { fecha: Date; _sum: { monto: number | null } }[]).map((f) => ({
      fecha: f.fecha,
      monto: f._sum.monto ?? 0,
    })),
    sueldos as SueldoVigencia[],
    diaInicio,
  );
}
