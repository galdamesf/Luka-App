import { mesDesdeFecha, sumarMeses } from "@/lib/fecha";
import { sueldoVigente } from "./balance";
import type { PuntoMes } from "./estadisticas";

/**
 * Armado de la serie historica a partir de filas crudas.
 *
 * Vive en dominio y no en datos a proposito: es la parte con riesgo real
 * (limites de mes, meses vacios, sueldo vigente) y asi se puede testear sin
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
  monto: number;
  vigenteDesde: Date;
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
): PuntoMes[] {
  const gastoPorMes = new Map<string, number>();
  for (const fila of gastosPorDia) {
    // mesDesdeFecha lee con metodos UTC. Con metodos locales, en Chile el dia
    // 1 se iria al mes anterior y el gasto se contaria en el mes equivocado.
    const mes = mesDesdeFecha(fila.fecha);
    gastoPorMes.set(mes, (gastoPorMes.get(mes) ?? 0) + fila.monto);
  }

  const vigencias = sueldos.map((s) => ({
    monto: s.monto,
    vigenteDesde: mesDesdeFecha(s.vigenteDesde),
  }));

  return ventanaDeMeses(mesFinal, cantidadMeses).map((mes) => ({
    mes,
    ingresos: sueldoVigente(vigencias, mes) ?? 0,
    gastos: gastoPorMes.get(mes) ?? 0,
  }));
}
