import type { GastoPlano } from "./resumen";

/**
 * El detalle que se muestra al pasar el mouse sobre una categoria.
 *
 * Funcion pura: recibe los gastos del mes y los del anterior, devuelve el
 * detalle por categoria. Sin Prisma ni React.
 */

export type GastoBreve = {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
};

export type DetalleCategoria = {
  cantidad: number;
  /** Promedio por gasto, sin redondear: la interfaz decide. */
  promedio: number;
  /** Los mas caros primero. Hasta `cuantos`. */
  mayores: GastoBreve[];
  /** Dias distintos del mes con al menos un gasto de esta categoria. */
  diasConGasto: number;
  /** Total de esta categoria el mes anterior. */
  anterior: number;
  /** actual - anterior. Positivo = gastaste mas este mes. */
  diferencia: number;
  /**
   * Variacion porcentual, o null si el mes anterior fue cero: dividir por
   * cero no da una cifra que signifique algo.
   */
  variacion: number | null;
  /** No habia gastos de esta categoria el mes pasado. */
  nueva: boolean;
};

function aBreve(g: GastoPlano): GastoBreve {
  return { id: g.id, fecha: g.fecha, descripcion: g.descripcion, monto: g.monto };
}

/**
 * Detalle de cada categoria, indexado por id de categoria.
 *
 * Solo aparecen las categorias con gastos ESTE mes: el detalle cuelga de una
 * fila de la lista, y si no hay fila no hay donde mostrarlo.
 */
export function detallesPorCategoria(
  gastos: readonly GastoPlano[],
  gastosAnterior: readonly GastoPlano[] = [],
  cuantos = 4,
): Record<string, DetalleCategoria> {
  const porCategoria = new Map<string, GastoPlano[]>();
  for (const g of gastos) {
    const lista = porCategoria.get(g.categoria.id);
    if (lista === undefined) porCategoria.set(g.categoria.id, [g]);
    else lista.push(g);
  }

  const totalesAnteriores = new Map<string, number>();
  for (const g of gastosAnterior) {
    totalesAnteriores.set(
      g.categoria.id,
      (totalesAnteriores.get(g.categoria.id) ?? 0) + g.monto,
    );
  }

  const salida: Record<string, DetalleCategoria> = {};

  for (const [id, lista] of porCategoria) {
    const total = lista.reduce((a, g) => a + g.monto, 0);
    const anterior = totalesAnteriores.get(id) ?? 0;
    const diferencia = total - anterior;

    // Orden estable: monto, despues fecha, despues id. Sin el desempate, dos
    // gastos del mismo monto podrian alternarse entre renders.
    const mayores = [...lista]
      .sort(
        (a, b) =>
          b.monto - a.monto ||
          a.fecha.localeCompare(b.fecha) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, Math.max(0, cuantos))
      .map(aBreve);

    salida[id] = {
      cantidad: lista.length,
      promedio: lista.length === 0 ? 0 : total / lista.length,
      mayores,
      diasConGasto: new Set(lista.map((g) => g.fecha)).size,
      anterior,
      diferencia,
      variacion: anterior === 0 ? null : (diferencia / anterior) * 100,
      nueva: anterior === 0,
    };
  }

  return salida;
}
