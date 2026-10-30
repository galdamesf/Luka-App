import { sumarMeses } from "@/lib/fecha";

/** Un ahorro apartado en un mes. Funciones puras, sin Prisma. */
export type AhorroPlano = {
  id: string;
  /** "YYYY-MM". */
  mes: string;
  monto: number;
  nota: string | null;
  /** Dia en que se anoto, "YYYY-MM-DD". */
  creadoEn: string;
};

export type MesDeAhorro = { mes: string; total: number };

/** Todo lo ahorrado desde siempre hasta `hasta`, ese mes incluido. */
export function totalAhorrado(ahorros: readonly Pick<AhorroPlano, "mes" | "monto">[], hasta: string): number {
  return ahorros.reduce((suma, a) => (a.mes <= hasta ? suma + a.monto : suma), 0);
}

/**
 * Lo ahorrado en cada uno de los ultimos `cantidad` meses hasta `hasta`, del
 * mas antiguo al mas nuevo. Un mes sin ahorro sale en cero, no se salta: el
 * hueco tambien es informacion.
 */
export function historialDeAhorro(
  ahorros: readonly Pick<AhorroPlano, "mes" | "monto">[],
  hasta: string,
  cantidad = 6,
): MesDeAhorro[] {
  const meses = Array.from({ length: cantidad }, (_, i) => sumarMeses(hasta, i - cantidad + 1));
  const porMes = new Map(meses.map((m) => [m, 0]));
  for (const a of ahorros) {
    if (porMes.has(a.mes)) porMes.set(a.mes, (porMes.get(a.mes) as number) + a.monto);
  }
  return meses.map((mes) => ({ mes, total: porMes.get(mes) as number }));
}
