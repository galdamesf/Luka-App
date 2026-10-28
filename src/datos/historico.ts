import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, sumarMeses } from "@/lib/fecha";
import { armarSerie, ventanaDeMeses } from "@/dominio/historico";
import type { PuntoMes } from "@/dominio/estadisticas";
import type { ClienteDb } from "./gastos";

/**
 * Serie de varios meses para el grafico de gastos contra ingresos.
 *
 * Aqui solo se consulta; el armado (limites de mes, meses vacios, sueldo
 * vigente) esta en @/dominio/historico, que se testea sin base de datos.
 *
 * Los ingresos no se suman de una tabla de movimientos: salen del sueldo
 * vigente en cada mes, que es como esta modelado el sueldo (fijo, ajustable).
 */
export async function serieHistorica(
  mesFinal: string,
  cantidadMeses = 12,
  db: ClienteDb = prisma,
): Promise<PuntoMes[]> {
  const ventana = ventanaDeMeses(mesFinal, cantidadMeses);

  // Rango semiabierto [inicio, fin): el primer dia del mes siguiente al final,
  // asi entra completo el ultimo dia del mes final.
  const desde = fechaDesdeISO(`${ventana[0]}-01`);
  const hasta = fechaDesdeISO(`${sumarMeses(ventana.at(-1)!, 1)}-01`);

  // Se agrupa por fecha exacta y no por mes porque Prisma no sabe hacer
  // date_trunc; agrupar por dia deja a lo mas ~365 filas que se suman aqui.
  const [porDia, sueldos] = await Promise.all([
    db.gasto.groupBy({
      by: ["fecha"],
      where: { fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    }),
    db.sueldo.findMany({
      where: { vigenteDesde: { lt: hasta } },
      select: { monto: true, vigenteDesde: true },
    }),
  ]);

  return armarSerie(
    mesFinal,
    cantidadMeses,
    (porDia as { fecha: Date; _sum: { monto: number | null } }[]).map((f) => ({
      fecha: f.fecha,
      monto: f._sum.monto ?? 0,
    })),
    sueldos as { monto: number; vigenteDesde: Date }[],
  );
}
