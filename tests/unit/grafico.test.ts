import { describe, expect, test } from "vitest";
import {
  type Punto,
  controles,
  cruces,
  escala,
  indiceMasCercano,
  nivelesRedondos,
  posicionesEtiquetadas,
  rutaArea,
  rutaLinea,
} from "@/lib/grafico";

describe("escala", () => {
  test("mapea los extremos del dominio al rango", () => {
    const e = escala([0, 100], [0, 300]);
    expect(e(0)).toBe(0);
    expect(e(50)).toBe(150);
    expect(e(100)).toBe(300);
  });

  test("funciona con el rango invertido, que es el caso del eje Y en SVG", () => {
    const e = escala([0, 1000], [280, 0]);
    expect(e(0)).toBe(280);
    expect(e(1000)).toBe(0);
    expect(e(500)).toBe(140);
  });

  test("un dominio de un solo punto no divide por cero", () => {
    const e = escala([500, 500], [0, 200]);
    expect(e(500)).toBe(100);
    expect(Number.isFinite(e(500))).toBe(true);
  });

  test("rechaza un dominio no finito", () => {
    expect(() => escala([0, Infinity], [0, 1])).toThrow(/dominio/);
  });
});

describe("nivelesRedondos", () => {
  test("da numeros redondos, no los crudos de dividir", () => {
    expect(nivelesRedondos(917_000, 4)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000]);
  });

  test("el ultimo nivel siempre llega al maximo o lo pasa", () => {
    for (const max of [1, 37, 999, 1234, 87_500, 1_250_000, 9_999_999]) {
      const niveles = nivelesRedondos(max);
      expect(niveles.at(-1)!, `con maximo ${max}`).toBeGreaterThanOrEqual(max);
      expect(niveles[0]).toBe(0);
    }
  });

  test("siempre sube: nunca repite ni retrocede", () => {
    for (const max of [1, 500, 73_400, 2_100_000]) {
      const niveles = nivelesRedondos(max);
      for (let i = 1; i < niveles.length; i += 1) {
        expect(niveles[i]!).toBeGreaterThan(niveles[i - 1]!);
      }
    }
  });

  test("un mes sin gastos no rompe el eje", () => {
    expect(nivelesRedondos(0)).toEqual([0, 1]);
    expect(nivelesRedondos(-5)).toEqual([0, 1]);
  });
});

describe("rutaLinea y rutaArea", () => {
  const p: Punto[] = [
    { x: 0, y: 100 },
    { x: 50, y: 40 },
    { x: 100, y: 70 },
  ];

  test("sin puntos no dibuja nada", () => {
    expect(rutaLinea([])).toBe("");
    expect(rutaArea([], 100)).toBe("");
  });

  test("un punto solo deja el lapiz puesto y nada mas", () => {
    expect(rutaLinea([{ x: 5, y: 9 }])).toBe("M 5 9");
  });

  test("poligonal usa L", () => {
    expect(rutaLinea(p, false)).toBe("M 0 100 L 50 40 L 100 70");
  });

  test("suave usa C y termina en el ultimo punto", () => {
    const d = rutaLinea(p, true);
    expect(d.startsWith("M 0 100 C")).toBe(true);
    expect(d).toContain("100 70");
    expect(d).not.toContain("NaN");
  });

  test("el area cierra contra la base", () => {
    const d = rutaArea(p, 280);
    expect(d.endsWith("L 100 280 L 0 280 Z")).toBe(true);
  });
});

/**
 * La propiedad que justifica la interpolacion monotona.
 *
 * Se muestrea cada tramo de la curva de verdad (evaluando el bezier) y se
 * exige que la Y se quede entre las Y de los dos puntos que une. Si alguien
 * cambia esto por Catmull-Rom, este test cae.
 */
describe("la curva no se pasa de los datos", () => {
  function evaluar(a: Punto, c1: Punto, c2: Punto, b: Punto, t: number): number {
    const u = 1 - t;
    return u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
  }

  const series: Punto[][] = [
    [{ x: 0, y: 100 }, { x: 1, y: 10 }, { x: 2, y: 100 }],          // valle agudo
    [{ x: 0, y: 10 }, { x: 1, y: 100 }, { x: 2, y: 10 }],           // pico agudo
    [{ x: 0, y: 50 }, { x: 1, y: 50 }, { x: 2, y: 0 }],             // tramo plano
    [{ x: 0, y: 0 }, { x: 1, y: 90 }, { x: 2, y: 95 }, { x: 3, y: 5 }],
  ];

  for (const [i, puntos] of series.entries()) {
    test(`serie ${i}: cada tramo se queda en su caja`, () => {
      const tramos = controles(puntos);

      for (const [j, { c1, c2, fin }] of tramos.entries()) {
        const a = puntos[j]!;
        const bajo = Math.min(a.y, fin.y);
        const alto = Math.max(a.y, fin.y);

        for (let t = 0; t <= 1.0001; t += 0.02) {
          const y = evaluar(a, c1, c2, fin, Math.min(t, 1));
          expect(y, `tramo ${j} en t=${t.toFixed(2)} se fue a ${y.toFixed(2)}`)
            .toBeGreaterThanOrEqual(bajo - 1e-9);
          expect(y).toBeLessThanOrEqual(alto + 1e-9);
        }
      }
    });
  }

  test("REGRESION: Catmull-Rom si se pasaria, y por eso no se usa", () => {
    // Serie plana despues de una caida: baja de 50 a 0 y se queda en 0.
    // El ultimo tramo une dos puntos que valen 0, asi que la curva NO deberia
    // moverse de cero. Catmull-Rom le mete tangente -25 heredada del tramo
    // anterior y la hunde bajo cero: plata negativa dibujada.
    const p: Punto[] = [
      { x: 0, y: 50 },
      { x: 1, y: 50 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];

    // Catmull-Rom uniforme en el punto 2: (y3 - y1) / (x3 - x1).
    const tangenteCR = (p[3]!.y - p[1]!.y) / (p[3]!.x - p[1]!.x);
    expect(tangenteCR).toBe(-25);

    const controlCR = p[2]!.y + (tangenteCR * (p[3]!.x - p[2]!.x)) / 3;
    expect(controlCR).toBeCloseTo(-8.33, 2);
    expect(controlCR).toBeLessThan(0); // se pasa: dibuja deuda inexistente

    // La monotona detecta el quiebre y aplana la tangente, asi que el ultimo
    // tramo se queda clavado en cero.
    const ultimo = controles(p).at(-1)!;
    expect(ultimo.c1.y).toBe(0);
    expect(ultimo.c2.y).toBe(0);
  });
});

describe("cruces", () => {
  const serie = (ys: number[]): Punto[] => ys.map((y, i) => ({ x: i, y }));

  test("encuentra el cruce interpolado", () => {
    expect(cruces(serie([0, 100]), serie([100, 0]))).toEqual([{ x: 0.5, y: 50 }]);
  });

  test("sin cruce no devuelve nada", () => {
    expect(cruces(serie([10, 20, 30]), serie([40, 50, 60]))).toEqual([]);
  });

  test("dos cruces en una serie de cuatro meses", () => {
    expect(cruces(serie([0, 100, 0, 100]), serie([50, 50, 50, 50]))).toHaveLength(3);
  });

  /**
   * REGRESION: el grafico mostraba un circulito por cada mes sin datos.
   *
   * Con la base recien sembrada hay un solo mes cargado y los once anteriores
   * quedan en 0 para las dos series. Como estaban pegadas, se marcaba un
   * "cruce" en cada uno: once avisos de que la plata se dio vuelta sin que
   * hubiera pasado nada.
   */
  test("REGRESION: meses pegados en cero no son cruces", () => {
    const ceros = serie([0, 0, 0, 0, 0, 0]);
    expect(cruces(ceros, ceros)).toEqual([]);
  });

  test("REGRESION: once meses vacios y uno con datos no marcan nada", () => {
    const ingresos = serie([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_250_000]);
    const gastos = serie([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1_023_100]);
    expect(cruces(ingresos, gastos)).toEqual([]);
  });

  test("tocarse y seguir por el mismo lado no es cruce", () => {
    // Venian con a arriba, se juntan, y a sigue arriba.
    expect(cruces(serie([100, 50, 100]), serie([50, 50, 50]))).toEqual([]);
  });

  test("tocarse y salir por el otro lado SI es cruce", () => {
    // a venia arriba, se tocan, y queda abajo: ahi si se dio vuelta.
    const salida = cruces(serie([100, 50, 0]), serie([50, 50, 50]));
    expect(salida).toHaveLength(1);
  });

  test("una zona pegada larga cuenta como un solo cruce", () => {
    const a = serie([100, 50, 50, 50, 0]);
    const b = serie([50, 50, 50, 50, 50]);
    expect(cruces(a, b)).toHaveLength(1);
  });

  test("arrancar pegados y despegarse no inventa un cruce", () => {
    expect(cruces(serie([50, 100]), serie([50, 0]))).toEqual([]);
  });

  test("con un punto o menos no hay nada que cruzar", () => {
    expect(cruces(serie([5]), serie([5]))).toEqual([]);
    expect(cruces([], [])).toEqual([]);
  });

  test("el cruce cae dentro del tramo, nunca fuera", () => {
    for (const [ya, yb] of [[[0, 100], [100, 0]], [[10, 90], [80, 20]], [[1, 2], [2, 1]]] as const) {
      const salida = cruces(serie([...ya]), serie([...yb]));
      expect(salida).toHaveLength(1);
      expect(salida[0]!.x).toBeGreaterThanOrEqual(0);
      expect(salida[0]!.x).toBeLessThanOrEqual(1);
    }
  });
});

describe("indiceMasCercano", () => {
  const p: Punto[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];

  test("se pega al mes mas cercano", () => {
    expect(indiceMasCercano(p, 0)).toBe(0);
    expect(indiceMasCercano(p, 4)).toBe(0);
    expect(indiceMasCercano(p, 6)).toBe(1);
    expect(indiceMasCercano(p, 19)).toBe(2);
    expect(indiceMasCercano(p, 999)).toBe(2);
  });

  test("sin puntos devuelve -1 en vez de reventar", () => {
    expect(indiceMasCercano([], 5)).toBe(-1);
  });
});

describe("posicionesEtiquetadas", () => {
  test("REGRESION: con 12 meses el ultimo par no queda pegado", () => {
    // El bug: paso 2 daba [0,2,4,6,8,10] mas el 11 forzado, y "sep 2026"
    // quedaba encima de "oct 2026" en el eje.
    const p = posicionesEtiquetadas(12, 8);
    expect(p).toContain(11);
    expect(p).not.toContain(10);
  });

  test("ninguna pareja de etiquetas queda a menos del paso", () => {
    for (let n = 2; n <= 36; n += 1) {
      const p = posicionesEtiquetadas(n, 8);
      const paso = Math.max(1, Math.ceil(n / 8));

      for (let i = 1; i < p.length; i += 1) {
        expect(
          p[i]! - p[i - 1]!,
          `con ${n} meses, ${p[i - 1]} y ${p[i]} quedan muy juntos`,
        ).toBeGreaterThanOrEqual(paso);
      }
    }
  });

  test("el ultimo mes siempre lleva etiqueta", () => {
    for (let n = 1; n <= 36; n += 1) {
      expect(posicionesEtiquetadas(n, 8), `con ${n} meses`).toContain(n - 1);
    }
  });

  test("el primero lleva etiqueta salvo que choque con el ultimo", () => {
    expect(posicionesEtiquetadas(12, 8)[0]).toBe(0);
    expect(posicionesEtiquetadas(6, 8)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("con pocos meses se etiquetan todos", () => {
    expect(posicionesEtiquetadas(1)).toEqual([0]);
    expect(posicionesEtiquetadas(2)).toEqual([0, 1]);
    expect(posicionesEtiquetadas(3)).toEqual([0, 1, 2]);
  });

  test("no revienta con cantidades invalidas", () => {
    expect(posicionesEtiquetadas(0)).toEqual([]);
    expect(posicionesEtiquetadas(-3)).toEqual([]);
  });

  test("nunca etiqueta mas alla del rango", () => {
    for (let n = 1; n <= 40; n += 1) {
      for (const i of posicionesEtiquetadas(n, 8)) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(n);
      }
    }
  });
});
