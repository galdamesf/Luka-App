import { diasEnMesISO, sumarMeses } from "@/lib/fecha";
import type { GastoPlano, ResumenMensual, CategoriaPlana } from "./resumen";
import { resumirMes } from "./resumen";
import type { MedioPago } from "./esquemas";

/**
 * Calculos del informe mensual. Todo puro: recibe gastos y devuelve numeros,
 * sin tocar la base, para poder probarlo sin Postgres.
 */

export type LineaComparada = {
  categoria: CategoriaPlana;
  actual: number;
  anterior: number;
  /** actual - anterior. Positivo = gastaste mas este mes. */
  diferencia: number;
  /**
   * Variacion porcentual, o null cuando el mes anterior fue cero: dividir por
   * cero no da infinito util, da una cifra que no significa nada.
   */
  variacion: number | null;
  /** true si la categoria no existia en el mes anterior. */
  nueva: boolean;
  /** true si estaba el mes pasado y este mes no. */
  desaparecida: boolean;
};

export type Comparacion = {
  mes: string;
  mesAnterior: string;
  totalActual: number;
  totalAnterior: number;
  diferencia: number;
  variacion: number | null;
  /** De mayor aumento a mayor baja. */
  lineas: LineaComparada[];
  /** Hubo gastos el mes anterior con que comparar. */
  hayAnterior: boolean;
};

/** Compara el gasto por categoria contra el mes anterior. */
export function compararConMesAnterior(
  gastosActual: readonly GastoPlano[],
  gastosAnterior: readonly GastoPlano[],
  mes: string,
  hoy: Date = new Date(),
): Comparacion {
  const mesAnterior = sumarMeses(mes, -1);
  const actual = resumirMes(gastosActual, mes, hoy);
  const anterior = resumirMes(gastosAnterior, mesAnterior, hoy);

  const porCategoria = new Map<string, { categoria: CategoriaPlana; actual: number; anterior: number }>();

  for (const linea of actual.porCategoria) {
    porCategoria.set(linea.categoria.id, {
      categoria: linea.categoria,
      actual: linea.total,
      anterior: 0,
    });
  }
  for (const linea of anterior.porCategoria) {
    const existente = porCategoria.get(linea.categoria.id);
    if (existente) existente.anterior = linea.total;
    else {
      porCategoria.set(linea.categoria.id, {
        categoria: linea.categoria,
        actual: 0,
        anterior: linea.total,
      });
    }
  }

  const lineas: LineaComparada[] = [...porCategoria.values()]
    .map((f) => ({
      categoria: f.categoria,
      actual: f.actual,
      anterior: f.anterior,
      diferencia: f.actual - f.anterior,
      variacion: f.anterior === 0 ? null : ((f.actual - f.anterior) / f.anterior) * 100,
      nueva: f.anterior === 0 && f.actual > 0,
      desaparecida: f.actual === 0 && f.anterior > 0,
    }))
    .sort(
      (a, b) =>
        b.diferencia - a.diferencia ||
        a.categoria.nombre.localeCompare(b.categoria.nombre, "es"),
    );

  return {
    mes,
    mesAnterior,
    totalActual: actual.total,
    totalAnterior: anterior.total,
    diferencia: actual.total - anterior.total,
    variacion:
      anterior.total === 0 ? null : ((actual.total - anterior.total) / anterior.total) * 100,
    lineas,
    hayAnterior: anterior.cantidad > 0,
  };
}

export type LineaMedioPago = {
  medio: MedioPago;
  total: number;
  cantidad: number;
  porcentaje: number;
};

/** Cuanto se gasto con cada medio de pago. */
export function porMedioDePago(
  gastos: readonly GastoPlano[],
  mes: string,
): LineaMedioPago[] {
  const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const total = delMes.reduce((s, g) => s + g.monto, 0);

  const acumulado = new Map<MedioPago, { total: number; cantidad: number }>();
  for (const gasto of delMes) {
    const actual = acumulado.get(gasto.medioPago) ?? { total: 0, cantidad: 0 };
    actual.total += gasto.monto;
    actual.cantidad += 1;
    acumulado.set(gasto.medioPago, actual);
  }

  return [...acumulado.entries()]
    .map(([medio, f]) => ({
      medio,
      total: f.total,
      cantidad: f.cantidad,
      porcentaje: total === 0 ? 0 : (f.total / total) * 100,
    }))
    .sort((a, b) => b.total - a.total);
}

export type LineaSemana = {
  /** 1 a 5: la semana del mes en que cae el gasto. */
  semana: number;
  /** Dias que cubre, para poder rotularla. */
  desde: number;
  hasta: number;
  total: number;
  cantidad: number;
};

/**
 * Gasto repartido por semana del mes, en bloques de 7 dias desde el dia 1.
 *
 * No son semanas de calendario (lunes a domingo) a proposito: lo util aca es
 * "primeros siete dias, segundos siete", que se alinea con como llega la
 * plata y como se gasta, y no cambia de forma segun en que dia caiga el 1.
 */
export function porSemana(gastos: readonly GastoPlano[], mes: string): LineaSemana[] {
  const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const dias = diasEnMesISO(mes);
  const cantidadSemanas = Math.ceil(dias / 7);

  const semanas: LineaSemana[] = Array.from({ length: cantidadSemanas }, (_, i) => ({
    semana: i + 1,
    desde: i * 7 + 1,
    hasta: Math.min((i + 1) * 7, dias),
    total: 0,
    cantidad: 0,
  }));

  for (const gasto of delMes) {
    const dia = Number(gasto.fecha.slice(8, 10));
    const indice = Math.min(Math.floor((dia - 1) / 7), cantidadSemanas - 1);
    const semana = semanas[indice] as LineaSemana;
    semana.total += gasto.monto;
    semana.cantidad += 1;
  }

  return semanas;
}

/** Los gastos mas grandes del mes, para la seccion "donde se fue la plata". */
export function mayoresGastos(
  gastos: readonly GastoPlano[],
  mes: string,
  cuantos = 5,
): GastoPlano[] {
  return gastos
    .filter((g) => g.fecha.startsWith(mes))
    .sort((a, b) => b.monto - a.monto || a.descripcion.localeCompare(b.descripcion, "es"))
    .slice(0, cuantos);
}

export type Informe = {
  mes: string;
  resumen: ResumenMensual;
  comparacion: Comparacion;
  medios: LineaMedioPago[];
  semanas: LineaSemana[];
  mayores: GastoPlano[];
};

export function armarInforme(
  gastosActual: readonly GastoPlano[],
  gastosAnterior: readonly GastoPlano[],
  mes: string,
  hoy: Date = new Date(),
): Informe {
  return {
    mes,
    resumen: resumirMes(gastosActual, mes, hoy),
    comparacion: compararConMesAnterior(gastosActual, gastosAnterior, mes, hoy),
    medios: porMedioDePago(gastosActual, mes),
    semanas: porSemana(gastosActual, mes),
    mayores: mayoresGastos(gastosActual, mes),
  };
}
