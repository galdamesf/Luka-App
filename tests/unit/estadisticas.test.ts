import { describe, expect, test } from "vitest";
import {
  type PuntoMes,
  analizarHistorico,
  correlacion,
  desviacionEstandar,
  mediana,
  promedio,
  regresionLineal,
} from "@/dominio/estadisticas";

const mes = (m: string, ingresos: number, gastos: number): PuntoMes => ({
  mes: m,
  ingresos,
  gastos,
});

describe("promedio y mediana", () => {
  test("promedio simple", () => {
    expect(promedio([10, 20, 30])).toBe(20);
  });

  test("mediana impar toma el del medio", () => {
    expect(mediana([30, 10, 20])).toBe(20);
  });

  test("mediana par promedia los dos del medio", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });

  test("la mediana no altera el arreglo que recibe", () => {
    const original = [30, 10, 20];
    mediana(original);
    expect(original).toEqual([30, 10, 20]);
  });

  test("la mediana aguanta un mes malo sin moverse, el promedio no", () => {
    // Un mes con un gasto enorme (compraste un auto) no deberia definir
    // "lo normal". Por eso el informe muestra las dos.
    const normales = [400_000, 420_000, 410_000, 430_000];
    const conAuto = [...normales, 8_000_000];
    expect(mediana(conAuto)).toBe(420_000);
    expect(promedio(conAuto)).toBeGreaterThan(1_900_000);
  });

  test("sin datos devuelven 0 en vez de NaN", () => {
    expect(promedio([])).toBe(0);
    expect(mediana([])).toBe(0);
  });
});

describe("desviacionEstandar", () => {
  test("usa n - 1, no n", () => {
    // Con [2,4,4,4,5,5,7,9]: poblacional 2, de muestra 2.138
    const d = desviacionEstandar([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(d).toBeCloseTo(2.138, 3);
  });

  test("datos planos dan cero", () => {
    expect(desviacionEstandar([5, 5, 5])).toBe(0);
  });

  test("con menos de 2 valores devuelve null, no NaN", () => {
    expect(desviacionEstandar([])).toBeNull();
    expect(desviacionEstandar([42])).toBeNull();
  });
});

describe("regresionLineal", () => {
  test("una recta perfecta se detecta exacta", () => {
    const t = regresionLineal([100, 200, 300, 400])!;
    expect(t.pendiente).toBeCloseTo(100, 6);
    expect(t.ajuste).toBeCloseTo(1, 6);
    expect(t.predecir(4)).toBeCloseTo(500, 6);
  });

  test("detecta que los gastos van bajando", () => {
    const t = regresionLineal([500, 450, 400, 350])!;
    expect(t.pendiente).toBeLessThan(0);
  });

  test("datos planos: recta plana y ajuste 1, no una division por cero", () => {
    const t = regresionLineal([300, 300, 300])!;
    expect(t.pendiente).toBe(0);
    expect(t.ajuste).toBe(1);
    expect(Number.isNaN(t.ajuste)).toBe(false);
  });

  test("datos sin patron dan ajuste bajo", () => {
    const t = regresionLineal([100, 900, 150, 850, 200])!;
    expect(t.ajuste).toBeLessThan(0.5);
  });

  test("con un mes solo no hay tendencia", () => {
    expect(regresionLineal([500])).toBeNull();
    expect(regresionLineal([])).toBeNull();
  });
});

describe("correlacion", () => {
  test("subir juntos da cerca de 1", () => {
    expect(correlacion([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 6);
  });

  test("moverse al reves da cerca de -1", () => {
    expect(correlacion([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 6);
  });

  test("una serie constante no tiene correlacion definida", () => {
    expect(correlacion([5, 5, 5], [1, 2, 3])).toBeNull();
  });

  test("con un punto no se puede correlacionar", () => {
    expect(correlacion([1], [2])).toBeNull();
  });
});

describe("analizarHistorico", () => {
  const historico = [
    mes("2026-07", 1_200_000, 900_000),
    mes("2026-08", 1_200_000, 1_100_000),
    mes("2026-09", 1_200_000, 1_300_000),
    mes("2026-10", 1_250_000, 1_000_000),
  ];

  test("sin meses no hay informe", () => {
    expect(analizarHistorico([])).toBeNull();
  });

  test("resume gastos e ingresos", () => {
    const e = analizarHistorico(historico)!;
    expect(e.gastos.total).toBe(4_300_000);
    expect(e.gastos.maximo).toEqual({ mes: "2026-09", valor: 1_300_000 });
    expect(e.gastos.minimo).toEqual({ mes: "2026-07", valor: 900_000 });
    expect(e.ingresos.total).toBe(4_850_000);
  });

  test("la variacion del ultimo mes compara contra el anterior", () => {
    const e = analizarHistorico(historico)!;
    expect(e.gastos.variacion).toBe(-300_000);
    expect(e.gastos.variacionPorcentaje).toBeCloseTo(-23.08, 2);
  });

  test("cuenta los meses en deficit y encuentra el peor", () => {
    const e = analizarHistorico(historico)!;
    expect(e.ahorro.mesesEnDeficit).toBe(1);
    expect(e.ahorro.peorMes).toEqual({ mes: "2026-09", valor: -100_000 });
    expect(e.ahorro.mejorMes).toEqual({ mes: "2026-07", valor: 300_000 });
  });

  test("el ahorro total es la suma de las diferencias", () => {
    const e = analizarHistorico(historico)!;
    expect(e.ahorro.total).toBe(550_000);
  });

  test("la tasa de ahorro sale del promedio por mes", () => {
    const e = analizarHistorico([
      mes("2026-09", 1_000_000, 500_000),
      mes("2026-10", 1_000_000, 900_000),
    ])!;
    // (0.5 + 0.1) / 2
    expect(e.ahorro.tasaPromedio).toBeCloseTo(0.3, 6);
  });

  test("un mes sin ingreso no envenena la tasa con un Infinity", () => {
    const e = analizarHistorico([
      mes("2026-09", 0, 200_000),
      mes("2026-10", 1_000_000, 500_000),
    ])!;
    expect(e.ahorro.tasaPromedio).toBeCloseTo(0.5, 6);
    expect(Number.isFinite(e.ahorro.tasaPromedio!)).toBe(true);
  });

  test("si nunca hubo ingreso la tasa es null, no NaN", () => {
    const e = analizarHistorico([mes("2026-10", 0, 200_000)])!;
    expect(e.ahorro.tasaPromedio).toBeNull();
  });

  test("con un mes solo: resume pero no inventa tendencia ni variacion", () => {
    const e = analizarHistorico([mes("2026-10", 1_000_000, 700_000)])!;
    expect(e.gastos.total).toBe(700_000);
    expect(e.gastos.desviacion).toBeNull();
    expect(e.gastos.variacion).toBeNull();
    expect(e.gastos.variacionPorcentaje).toBeNull();
    expect(e.tendenciaGastos).toBeNull();
    expect(e.correlacion).toBeNull();
  });

  test("si el mes anterior fue 0 no calcula un porcentaje infinito", () => {
    const e = analizarHistorico([mes("2026-09", 0, 0), mes("2026-10", 100, 100)])!;
    expect(e.gastos.variacion).toBe(100);
    expect(e.gastos.variacionPorcentaje).toBeNull();
  });

  test("detecta que los gastos vienen subiendo", () => {
    const e = analizarHistorico([
      mes("2026-07", 1_000_000, 600_000),
      mes("2026-08", 1_000_000, 700_000),
      mes("2026-09", 1_000_000, 800_000),
    ])!;
    expect(e.tendenciaGastos!.pendiente).toBeCloseTo(100_000, 6);
    expect(e.tendenciaGastos!.ajuste).toBeCloseTo(1, 6);
  });
});
