import { describe, expect, test } from "vitest";
import { CORTES_NIVEL, nivelDeSemana, proyectarCierre, ritmoSemanal } from "@/dominio/semanas";
import type { GastoPlano } from "@/dominio/resumen";

const ARRIENDO = { id: "c1", nombre: "Arriendo", color: "#0d9488", icono: "house", esencial: true };
const CAFE = { id: "c2", nombre: "Café", color: "#c2410c", icono: "coffee", esencial: false };
const BENCINA = { id: "c3", nombre: "Bencina", color: "#1d4ed8", icono: "fuel", esencial: false };

let n = 0;
const gasto = (fecha: string, monto: number, categoria = CAFE, cuota: GastoPlano["cuota"] = null): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota, categoria,
});

describe("los bloques del mes", () => {
  test("octubre tiene cinco: el ultimo va del 29 al 31", () => {
    const r = ritmoSemanal([], "2026-10", "2026-11-15");
    expect(r.semanas.map((s) => [s.desde, s.hasta])).toEqual([
      [1, 7], [8, 14], [15, 21], [22, 28], [29, 31],
    ]);
  });

  test("febrero de 28 dias tiene cuatro", () => {
    expect(ritmoSemanal([], "2027-02", "2027-03-10").semanas).toHaveLength(4);
  });
});

describe("un mes en curso", () => {
  const r = ritmoSemanal(
    [
      gasto("2026-10-01", 780_000, ARRIENDO),
      gasto("2026-10-03", 14_000),
      gasto("2026-10-10", 35_000),
      gasto("2026-10-12", 21_000, BENCINA),
      gasto("2026-10-27", 31_500),
      gasto("2026-10-29", 9_000),
      // El pago de una cuota no entra.
      gasto("2026-10-15", 158_400, ARRIENDO, { deudaId: "d1", deudaNombre: "Crédito" }),
    ],
    "2026-10",
    "2026-10-29",
  );

  test("reparte cada gasto en su bloque y separa esenciales de discrecionales", () => {
    const [s1, s2, s3, s4, s5] = r.semanas;
    expect(s1?.total).toBe(794_000);
    expect(s1?.esenciales).toBe(780_000);
    expect(s1?.discrecionales).toBe(14_000);
    expect(s2?.total).toBe(56_000);
    expect(s3?.total).toBe(0);
    expect(s4?.total).toBe(31_500);
    expect(s5?.total).toBe(9_000);
  });

  test("cuenta los dias que van hasta hoy, hoy incluido", () => {
    expect(r.semanas.map((s) => s.diasTranscurridos)).toEqual([7, 7, 7, 7, 1]);
    expect(r.semanas[4]?.enCurso).toBe(true);
    expect(r.semanaInicial).toBe(5);
  });

  test("la tendencia compara gasto discrecional por dia, no el total", () => {
    // Bloque 2: 56.000 en 7 dias = 8.000 por dia. Bloque 1: 14.000 en 7 = 2.000.
    expect(r.semanas[1]?.tendencia).toBeCloseTo(300, 6);
    // Bloque 5: 9.000 en 1 dia contra 31.500 en 7 (4.500 por dia): sube 100%.
    expect(r.semanas[4]?.tendencia).toBeCloseTo(100, 6);
  });

  test("sin gasto discrecional antes no hay con que comparar", () => {
    // Bloque 4 contra el 3, que no tuvo gastos.
    expect(r.semanas[3]?.tendencia).toBeNull();
  });

  test("ordena las categorias de la semana de mayor a menor", () => {
    expect(r.semanas[1]?.categorias.map((c) => c.categoria.nombre)).toEqual(["Café", "Bencina"]);
    expect(r.semanas[1]?.categorias[0]?.total).toBe(35_000);
  });

  test("los promedios usan los dias que van, no los del mes completo", () => {
    const total = 794_000 + 56_000 + 31_500 + 9_000;
    expect(r.promedioDiario).toBeCloseTo(total / 29, 6);
    expect(r.promedioSemanal).toBeCloseTo((total / 29) * 7, 6);
    expect(r.semanaMasAlta).toBe(1);
    expect(r.maximo).toBe(794_000);
    expect(r.maximoDiscrecional).toBe(56_000);
  });
});

describe("meses que no son el en curso", () => {
  test("en un mes cerrado todos los dias cuentan y se abre la ultima semana con gastos", () => {
    const r = ritmoSemanal(
      [gasto("2026-09-02", 10_000), gasto("2026-09-24", 5_000)],
      "2026-09",
      "2026-10-29",
    );
    expect(r.semanas.map((s) => s.diasTranscurridos)).toEqual([7, 7, 7, 7, 2]);
    expect(r.semanas.some((s) => s.enCurso)).toBe(false);
    expect(r.semanaInicial).toBe(4);
  });

  test("en un mes futuro no pasa ningun dia y no hay promedios", () => {
    const r = ritmoSemanal([], "2026-11", "2026-10-29");
    expect(r.semanas.every((s) => s.diasTranscurridos === 0)).toBe(true);
    expect(r.semanas[0]?.promedioDiario).toBeNull();
    expect(r.promedioDiario).toBeNull();
    expect(r.semanaMasAlta).toBeNull();
    expect(r.semanaInicial).toBe(1);
  });
});

describe("proyectarCierre", () => {
  const r = ritmoSemanal(
    [gasto("2026-10-01", 780_000, ARRIENDO), gasto("2026-10-05", 290_000)],
    "2026-10",
    "2026-10-29",
  );

  test("el discrecional diario va sobre los dias que van", () => {
    expect(r.discrecionalDiario).toBeCloseTo(10_000, 6);
  });

  test("suma lo gastado, lo por pagar y lo discrecional de los dias que quedan despues de hoy", () => {
    // Quedan 3 dias contando hoy: se proyectan 2.
    expect(proyectarCierre(1_070_000, 100_000, 3, r, true)).toBeCloseTo(1_190_000, 6);
  });

  test("el ultimo dia del mes no proyecta nada mas", () => {
    expect(proyectarCierre(1_070_000, 0, 1, r, true)).toBe(1_070_000);
  });

  test("fuera del mes en curso no hay proyeccion", () => {
    expect(proyectarCierre(1_070_000, 0, 0, r, false)).toBeNull();
  });
});

describe("la semana en curso recien empezada", () => {
  const r = ritmoSemanal(
    [gasto("2026-10-23", 20_000), gasto("2026-10-27", 12_000)],
    "2026-10",
    "2026-10-29",
  );

  test("sin gasto discrecional todavia, no se compara: seria un -100% falso", () => {
    expect(r.semanas[4]?.enCurso).toBe(true);
    expect(r.semanas[4]?.tendencia).toBeNull();
  });

  test("se abre en la ultima semana con gastos, no en la vacia", () => {
    expect(r.semanaInicial).toBe(4);
  });

  test("una semana cerrada sin gasto discrecional si se compara: bajar a cero es real", () => {
    const cerrado = ritmoSemanal(
      [gasto("2026-09-03", 7_000), gasto("2026-09-09", 15_000, ARRIENDO)],
      "2026-09",
      "2026-10-29",
    );
    expect(cerrado.semanas[1]?.tendencia).toBeCloseTo(-100, 6);
  });
});

describe("nivelDeSemana", () => {
  // Discrecional del mes: 110.500 en 29 dias, unos 3.810 por dia.
  const r = ritmoSemanal(
    [
      gasto("2026-10-01", 780_000, ARRIENDO),
      gasto("2026-10-03", 14_000),
      gasto("2026-10-10", 35_000),
      gasto("2026-10-12", 21_000, BENCINA),
      gasto("2026-10-27", 31_500),
      gasto("2026-10-29", 9_000),
    ],
    "2026-10",
    "2026-10-29",
  );
  const nivel = (i: number) => nivelDeSemana(r.semanas[i] as (typeof r.semanas)[number], r);

  test("mide solo lo discrecional: el arriendo no hace alta a la primera semana", () => {
    expect(nivel(0)?.nivel).toBe("bajo");
    expect(nivel(0)?.veces).toBeCloseTo(2_000 / (110_500 / 29), 6);
  });

  test("reparte las semanas en niveles segun las veces del ritmo del mes", () => {
    expect(nivel(1)?.nivel).toBe("muy-alto"); // 8.000 por dia, 2.1 veces
    expect(nivel(3)?.nivel).toBe("alto"); // 4.500 por dia, 1.18 veces
  });

  test("una semana sin ningun gasto no tiene nivel: no se anoto nada, no es que fuera baja", () => {
    expect(r.semanas[2]?.cantidad).toBe(0);
    expect(nivel(2)).toBeNull();
  });

  test("una semana cerrada con gastos pero ninguno discrecional si es baja", () => {
    const soloArriendo = ritmoSemanal(
      [gasto("2026-10-01", 780_000, ARRIENDO), gasto("2026-10-10", 35_000)],
      "2026-10",
      "2026-10-20",
    );
    expect(nivelDeSemana(soloArriendo.semanas[0] as (typeof soloArriendo.semanas)[number], soloArriendo)).toEqual({ nivel: "bajo", veces: 0 });
  });

  test("los cortes son inclusivos hacia abajo", () => {
    const base = r.semanas[1] as (typeof r.semanas)[number];
    const conVeces = (veces: number) =>
      nivelDeSemana({ ...base, enCurso: false, diasTranscurridos: 1, discrecionales: veces * 1_000 }, { discrecionalDiario: 1_000 })?.nivel;
    expect(conVeces(CORTES_NIVEL.bajo)).toBe("bajo");
    expect(conVeces(1)).toBe("normal");
    expect(conVeces(CORTES_NIVEL.normal)).toBe("normal");
    expect(conVeces(CORTES_NIVEL.alto)).toBe("alto");
    expect(conVeces(1.51)).toBe("muy-alto");
  });

  test("sin dias, sin gasto discrecional en el mes o en curso sin gastar todavia, no hay nivel", () => {
    const futuro = ritmoSemanal([gasto("2026-12-03", 5_000)], "2026-12", "2026-11-10");
    expect(nivelDeSemana(futuro.semanas[0] as (typeof futuro.semanas)[number], futuro)).toBeNull();

    const soloEsencial = ritmoSemanal([gasto("2026-10-01", 780_000, ARRIENDO)], "2026-10", "2026-10-20");
    expect(nivelDeSemana(soloEsencial.semanas[0] as (typeof soloEsencial.semanas)[number], soloEsencial)).toBeNull();

    const recien = ritmoSemanal([gasto("2026-10-03", 14_000)], "2026-10", "2026-10-29");
    expect(nivelDeSemana(recien.semanas[4] as (typeof recien.semanas)[number], recien)).toBeNull();
  });
});
