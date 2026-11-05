import { isoDesdeFecha, mesDesdeFecha, sumarMeses } from "@/lib/fecha";
import { periodoDeFecha } from "@/lib/periodo";
import { ingresosDelMes } from "./sueldos";
import type { PuntoMes } from "./estadisticas";

/**
 * Armado de la serie historica a partir de filas crudas.
 *
 * Vive en dominio y no en datos a proposito: es la parte con riesgo real
 * (limites de mes, meses vacios, sueldos vigentes) y asi se puede testear sin
 * base de datos ni cliente de Prisma.
 *
 * `src/datos/historico.ts` solo consulta y delega aqui.
 */

export type GastoPorDia = {
  /** Lo que devuelve Postgres para una columna @db.Date: medianoche UTC. */
  fecha: Date;
  monto: number;
};

export type SueldoVigencia = {
  /** De quien es. null en el sueldo cerrado de alguien que ya salio del hogar. */
  miembroId: string | null;
  monto: number;
  vigenteDesde: Date;
  /** El ultimo mes en que rige: solo en un sueldo cerrado. */
  vigenteHasta: Date | null;
};

/** La ventana de meses que cubre la serie, del mas antiguo al mas nuevo. */
export function ventanaDeMeses(mesFinal: string, cantidadMeses: number): string[] {
  const cantidad = Math.max(1, Math.trunc(cantidadMeses) || 1);
  const mesInicial = sumarMeses(mesFinal, -(cantidad - 1));

  return Array.from({ length: cantidad }, (_, i) => sumarMeses(mesInicial, i));
}

export function armarSerie(
  mesFinal: string,
  cantidadMeses: number,
  gastosPorDia: readonly GastoPorDia[],
  sueldos: readonly SueldoVigencia[],
  /** Dia en que empieza cada mes de gastos. 1 es el mes calendario. */
  diaInicio = 1,
): PuntoMes[] {
  const gastoPorMes = new Map<string, number>();
  for (const fila of gastosPorDia) {
    // isoDesdeFecha lee con metodos UTC. Con metodos locales, en Chile el dia
    // 1 se iria al mes anterior y el gasto se contaria en el mes equivocado.
    // Despues se busca el periodo de esa fecha: con dia 27, el 2 de
    // noviembre suma en octubre.
    const mes = periodoDeFecha(isoDesdeFecha(fila.fecha), diaInicio).mes;
    gastoPorMes.set(mes, (gastoPorMes.get(mes) ?? 0) + fila.monto);
  }

  const vigencias = sueldos.map((s) => ({
    miembroId: s.miembroId,
    monto: s.monto,
    vigenteDesde: mesDesdeFecha(s.vigenteDesde),
    vigenteHasta: s.vigenteHasta === null ? null : mesDesdeFecha(s.vigenteHasta),
  }));

  // Los ingresos de cada mes son la suma de los sueldos de todos los del hogar.
  return ventanaDeMeses(mesFinal, cantidadMeses).map((mes) => ({
    mes,
    ingresos: ingresosDelMes(vigencias, mes).total ?? 0,
    gastos: gastoPorMes.get(mes) ?? 0,
  }));
}
