import { describe, expect, test } from "vitest";
import { armarSerie, ventanaDeMeses } from "@/dominio/historico";
import type { GastoPorDia, SueldoVigencia } from "@/dominio/historico";

/**
 * Prueba el armado de la serie: limites de mes, meses vacios y sueldo
 * vigente. Es la parte con riesgo real y aqui corre sin base de datos.
 *
 * Las fechas se construyen como las devuelve Postgres para una columna
 * @db.Date: medianoche UTC. Si el agrupado usara metodos locales, en Chile
 * (UTC-3) el dia 1 se iria al mes anterior; eso se ve sin tocar la base.
 *
 * El cableado con Prisma se verifica en tests/db/historico.test.ts.
 */
const dia = (fecha: string, monto: number): GastoPorDia => ({
  fecha: new Date(`${fecha}T00:00:00.000Z`),
  monto,
});

const sueldo = (mes: string, monto: number): SueldoVigencia => ({
  monto,
  vigenteDesde: new Date(`${mes}-01T00:00:00.000Z`),
});

const serie = (
  mesFinal: string,
  cantidad: number,
  gastos: GastoPorDia[] = [],
  sueldos: SueldoVigencia[] = [],
) => armarSerie(mesFinal, cantidad, gastos, sueldos);

describe("ventanaDeMeses", () => {
  test("termina en el mes final y cuenta hacia atras", () => {
    expect(ventanaDeMeses("2026-10", 4)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  test("cruza el fin de ano", () => {
    expect(ventanaDeMeses("2026-01", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  test("pedir 0 o menos entrega al menos el mes final", () => {
    expect(ventanaDeMeses("2026-10", 0)).toEqual(["2026-10"]);
    expect(ventanaDeMeses("2026-10", -5)).toEqual(["2026-10"]);
  });
});

describe("armarSerie", () => {
  test("entrega la ventana completa", () => {
    expect(serie("2026-10", 4).map((p) => p.mes)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  test("suma varios gastos del mismo mes", () => {
    expect(
      serie("2026-10", 2, [
        dia("2026-10-03", 10_000),
        dia("2026-10-17", 25_000),
        dia("2026-09-09", 5_000),
      ]),
    ).toEqual([
      { mes: "2026-09", ingresos: 0, gastos: 5_000 },
      { mes: "2026-10", ingresos: 0, gastos: 35_000 },
    ]);
  });

  test("REGRESION: el dia 1 cuenta en su mes y no en el anterior", () => {
    const s = serie("2026-10", 2, [dia("2026-10-01", 333_000)]);
    expect(s[0]).toEqual({ mes: "2026-09", ingresos: 0, gastos: 0 });
    expect(s[1]).toEqual({ mes: "2026-10", ingresos: 0, gastos: 333_000 });
  });

  test("REGRESION: el ultimo dia del mes no se escapa al siguiente", () => {
    const s = serie("2026-10", 2, [dia("2026-09-30", 111_000)]);
    expect(s[0]!.gastos).toBe(111_000);
    expect(s[1]!.gastos).toBe(0);
  });

  test("los meses sin gastos quedan en 0 y no se saltan", () => {
    expect(
      serie("2026-10", 3, [dia("2026-08-10", 90_000), dia("2026-10-10", 70_000)]).map(
        (p) => [p.mes, p.gastos],
      ),
    ).toEqual([
      ["2026-08", 90_000],
      ["2026-09", 0],
      ["2026-10", 70_000],
    ]);
  });

  test("el sueldo sigue rigiendo hasta que cambia", () => {
    expect(
      serie("2026-10", 3, [], [sueldo("2026-08", 1_000_000), sueldo("2026-10", 1_200_000)])
        .map((p) => p.ingresos),
    ).toEqual([1_000_000, 1_000_000, 1_200_000]);
  });

  test("antes del primer sueldo los ingresos son 0, no el sueldo de hoy", () => {
    expect(
      serie("2026-10", 3, [], [sueldo("2026-09", 1_000_000)]).map((p) => p.ingresos),
    ).toEqual([0, 1_000_000, 1_000_000]);
  });

  test("un sueldo que arranca el dia 1 rige ese mismo mes", () => {
    expect(serie("2026-10", 1, [], [sueldo("2026-10", 900_000)])[0]!.ingresos).toBe(900_000);
  });

  test("un gasto fuera de la ventana no entra", () => {
    // La consulta ya filtra por rango, pero el armado no debe contar de mas
    // si llegara una fila de fuera.
    const s = serie("2026-10", 2, [dia("2026-06-15", 999_999), dia("2026-10-15", 10_000)]);
    expect(s.reduce((a, p) => a + p.gastos, 0)).toBe(10_000);
  });
});
