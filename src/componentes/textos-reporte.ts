import type { ReporteSemanal } from "@/dominio/reporte-semanal";
import { nombreDelMes, variacionLegible } from "./formato";

/**
 * Las frases del reporte semanal que dicen lo mismo en la pagina y en el
 * PDF. Viven en un solo lugar para que las dos versiones no se separen.
 */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const formatoCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** "29 al 31 de octubre de 2026" */
export function rangoDeLaSemana(reporte: Pick<ReporteSemanal, "mes" | "fechaDesde" | "fechaHasta">): string {
  const [mes, anio] = nombreDelMes(reporte.mes).split(" ");
  return `${Number(reporte.fechaDesde.slice(8, 10))} al ${Number(reporte.fechaHasta.slice(8, 10))} de ${mes} de ${anio}`;
}

/** "luka-reporte-semana-5-octubre-2026.pdf": sin tildes ni espacios, para cualquier sistema. */
export function nombreArchivoReporte(reporte: Pick<ReporteSemanal, "mes" | "semana">): string {
  return `luka-reporte-semana-${reporte.semana}-${nombreDelMes(reporte.mes).replace(" ", "-")}.pdf`;
}

/** La URL que descarga el PDF de una semana. */
export function urlPdfReporte(mes: string, semana: number): string {
  return `/informes/semana/pdf?mes=${mes}&semana=${semana}`;
}

/** La URL de la pagina del reporte. Sin semana abre la en curso, o la ultima con gastos. */
export function urlReporte(mes: string, semana?: number): string {
  return semana === undefined ? `/informes/semana?mes=${mes}` : `/informes/semana?mes=${mes}&semana=${semana}`;
}

/** "En curso: van 2 de 3 días", "Semana cerrada · 7 días", "Todavía no empieza". */
export function estadoDeLaSemana(reporte: Pick<ReporteSemanal, "estado" | "diasTranscurridos" | "totalDias">): string {
  if (reporte.estado === "en-curso") return `En curso: van ${reporte.diasTranscurridos} de ${reporte.totalDias} días`;
  if (reporte.estado === "cerrada") return `Semana cerrada · ${plural(reporte.totalDias, "día", "días")}`;
  return "Todavía no empieza";
}

export type LineaComparacion = { texto: string; tono: "neutro" | "sube" | "baja" };

/** Lo que cambio contra la semana anterior, en una o dos frases. */
export function comparacionConAnterior(
  reporte: Pick<ReporteSemanal, "anterior" | "tendencia" | "diasTranscurridos" | "estado" | "discrecionales">,
): LineaComparacion[] {
  const a = reporte.anterior;
  if (a === null) {
    return [{ texto: "Es la primera semana del mes: no hay semana anterior con qué comparar.", tono: "neutro" }];
  }
  const lineas: LineaComparacion[] = [
    {
      texto: `Semana ${a.semana}: ${formatoCLP.format(a.total)} en ${plural(a.diasTranscurridos, "día", "días")}, ${formatoCLP.format(a.discrecionales)} de ello discrecional.`,
      tono: "neutro",
    },
  ];
  if (reporte.tendencia === null) {
    lineas.push({
      texto:
        reporte.diasTranscurridos === 0
          ? "Esta semana todavía no empieza."
          : reporte.estado === "en-curso" && reporte.discrecionales === 0
            ? "Todavía no hay gasto discrecional esta semana para comparar."
            : "La semana anterior no tuvo gasto discrecional: no hay base para comparar.",
      tono: "neutro",
    });
  } else {
    lineas.push({
      texto: `Gasto discrecional por día: ${variacionLegible(reporte.tendencia)} contra la semana ${a.semana}. Se compara por día porque los bloques no duran lo mismo.`,
      tono: reporte.tendencia > 0 ? "sube" : "baja",
    });
  }
  return lineas;
}

export const COMO_SE_LEE =
  "Las semanas son bloques de 7 días desde el día 1 del mes (1-7, 8-14, 15-21, 22-28 y 29 en adelante). El ritmo discrecional compara lo que gastaste por día en lo no esencial esta semana con tu promedio del mes: hasta 0,85 veces es bajo, hasta 1,15 normal, hasta 1,5 alto y sobre eso muy alto. Las cuotas de deudas no suman al total de la semana: el balance ya las descuenta del sueldo por su lado.";
