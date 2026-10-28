/**
 * Estadistica del historico de meses: gastos contra ingresos.
 *
 * Funciones puras, sin Prisma ni React.
 *
 * Los casos borde aqui no son teoricos: alguien que recien instala la app
 * tiene UN mes cargado, y casi todas estas formulas dividen por (n - 1) o por
 * el ingreso. Cada una devuelve `null` cuando no hay datos para responder, en
 * vez de un NaN que despues se imprime en pantalla.
 */

export type PuntoMes = {
  /** "2026-10" */
  mes: string;
  ingresos: number;
  gastos: number;
};

export type Extremo = { mes: string; valor: number };

export type ResumenSerie = {
  total: number;
  promedio: number;
  mediana: number;
  maximo: Extremo;
  minimo: Extremo;
  /** Desviacion estandar de muestra (n - 1). `null` con menos de 2 meses. */
  desviacion: number | null;
  /** Cuanto se movio el ultimo mes respecto al anterior, en pesos. */
  variacion: number | null;
  /** Lo mismo en porcentaje. `null` si el mes anterior era 0. */
  variacionPorcentaje: number | null;
};

export type Tendencia = {
  /** Pesos por mes: positivo es que va subiendo. */
  pendiente: number;
  /** Que tan confiable es la recta, de 0 a 1. */
  ajuste: number;
  /** El valor que predice la recta para el mes `n` (0-indexado). */
  predecir: (indiceMes: number) => number;
};

export type EstadisticasHistoricas = {
  meses: readonly PuntoMes[];
  ingresos: ResumenSerie;
  gastos: ResumenSerie;
  ahorro: {
    /** Suma de (ingresos - gastos) de todos los meses. */
    total: number;
    promedio: number;
    /** Promedio de ahorro sobre ingreso. `null` si nunca hubo ingreso. */
    tasaPromedio: number | null;
    mesesEnDeficit: number;
    mejorMes: Extremo | null;
    peorMes: Extremo | null;
  };
  /** Tendencia de los gastos. `null` con menos de 2 meses. */
  tendenciaGastos: Tendencia | null;
  /** Que tanto suben juntos gastos e ingresos. `null` si no se puede calcular. */
  correlacion: number | null;
};

export function promedio(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;

  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);

  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1]! + ordenados[medio]!) / 2
    : ordenados[medio]!;
}

/** Desviacion estandar de muestra. `null` con menos de 2 valores. */
export function desviacionEstandar(valores: readonly number[]): number | null {
  if (valores.length < 2) return null;

  const media = promedio(valores);
  const suma = valores.reduce((acc, v) => acc + (v - media) ** 2, 0);
  return Math.sqrt(suma / (valores.length - 1));
}

/**
 * Recta de minimos cuadrados sobre el indice del mes.
 *
 * `ajuste` es el R2. Si todos los valores son iguales la recta es plana y el
 * R2 no esta definido; en ese caso se devuelve ajuste 1, porque una recta
 * plana describe perfectamente datos planos.
 */
export function regresionLineal(valores: readonly number[]): Tendencia | null {
  const n = valores.length;
  if (n < 2) return null;

  const xs = valores.map((_, i) => i);
  const mediaX = promedio(xs);
  const mediaY = promedio(valores);

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i]! - mediaX) * (valores[i]! - mediaY);
    sxx += (xs[i]! - mediaX) ** 2;
  }

  const pendiente = sxx === 0 ? 0 : sxy / sxx;
  const interseccion = mediaY - pendiente * mediaX;
  const predecir = (i: number) => interseccion + pendiente * i;

  let residual = 0;
  let totalVar = 0;
  for (let i = 0; i < n; i += 1) {
    residual += (valores[i]! - predecir(i)) ** 2;
    totalVar += (valores[i]! - mediaY) ** 2;
  }

  return {
    pendiente,
    ajuste: totalVar === 0 ? 1 : Math.max(0, 1 - residual / totalVar),
    predecir,
  };
}

/** Correlacion de Pearson. `null` si alguna serie es constante. */
export function correlacion(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;

  const ma = promedio(a.slice(0, n));
  const mb = promedio(b.slice(0, n));

  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - ma;
    const db = b[i]! - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }

  if (saa === 0 || sbb === 0) return null;
  return sab / Math.sqrt(saa * sbb);
}

function resumirSerie(meses: readonly PuntoMes[], leer: (m: PuntoMes) => number): ResumenSerie {
  const valores = meses.map(leer);

  let maximo: Extremo = { mes: meses[0]?.mes ?? "", valor: valores[0] ?? 0 };
  let minimo: Extremo = { mes: meses[0]?.mes ?? "", valor: valores[0] ?? 0 };
  for (const [i, v] of valores.entries()) {
    if (v > maximo.valor) maximo = { mes: meses[i]!.mes, valor: v };
    if (v < minimo.valor) minimo = { mes: meses[i]!.mes, valor: v };
  }

  const ultimo = valores.at(-1);
  const anterior = valores.at(-2);
  const variacion =
    ultimo !== undefined && anterior !== undefined ? ultimo - anterior : null;

  return {
    total: valores.reduce((a, b) => a + b, 0),
    promedio: promedio(valores),
    mediana: mediana(valores),
    maximo,
    minimo,
    desviacion: desviacionEstandar(valores),
    variacion,
    variacionPorcentaje:
      variacion !== null && anterior !== undefined && anterior !== 0
        ? (variacion / anterior) * 100
        : null,
  };
}

/**
 * Todo el panel estadistico de una pasada.
 *
 * `meses` tiene que venir ordenado del mas antiguo al mas nuevo: la tendencia
 * y la variacion dependen del orden.
 */
export function analizarHistorico(
  meses: readonly PuntoMes[],
): EstadisticasHistoricas | null {
  if (meses.length === 0) return null;

  const gastos = meses.map((m) => m.gastos);
  const ingresos = meses.map((m) => m.ingresos);

  const diferencias = meses.map((m) => m.ingresos - m.gastos);
  const conIngreso = meses.filter((m) => m.ingresos > 0);

  let mejorMes: Extremo | null = null;
  let peorMes: Extremo | null = null;
  for (const [i, d] of diferencias.entries()) {
    if (mejorMes === null || d > mejorMes.valor) mejorMes = { mes: meses[i]!.mes, valor: d };
    if (peorMes === null || d < peorMes.valor) peorMes = { mes: meses[i]!.mes, valor: d };
  }

  return {
    meses,
    ingresos: resumirSerie(meses, (m) => m.ingresos),
    gastos: resumirSerie(meses, (m) => m.gastos),
    ahorro: {
      total: diferencias.reduce((a, b) => a + b, 0),
      promedio: promedio(diferencias),
      tasaPromedio:
        conIngreso.length === 0
          ? null
          : promedio(conIngreso.map((m) => (m.ingresos - m.gastos) / m.ingresos)),
      mesesEnDeficit: diferencias.filter((d) => d < 0).length,
      mejorMes,
      peorMes,
    },
    tendenciaGastos: regresionLineal(gastos),
    correlacion: correlacion(gastos, ingresos),
  };
}
