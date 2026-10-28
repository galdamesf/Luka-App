import { describe, expect, test } from "vitest";
import { detallesPorCategoria } from "@/dominio/detalle-categoria";
import type { GastoPlano } from "@/dominio/resumen";

const SUPER = {
  id: "cat-super",
  nombre: "Supermercado",
  color: "#c38409",
  icono: "shopping-cart",
  esencial: true,
};
const SALUD = {
  id: "cat-salud",
  nombre: "Salud y farmacia",
  color: "#db1b51",
  icono: "heart-pulse",
  esencial: true,
};

let n = 0;
const g = (
  fecha: string,
  monto: number,
  categoria = SUPER,
  descripcion = `gasto ${++n}`,
): GastoPlano => ({
  id: `g${n}`,
  fecha,
  descripcion,
  monto,
  medioPago: "DEBITO",
  notas: null,
  boletaArchivo: null,
  cuota: null,
  categoria,
});

describe("detallesPorCategoria", () => {
  test("sin gastos no hay detalle", () => {
    expect(detallesPorCategoria([], [])).toEqual({});
  });

  test("cuenta, suma y promedia por categoria", () => {
    const d = detallesPorCategoria([
      g("2026-10-02", 30_000),
      g("2026-10-05", 50_000),
      g("2026-10-09", 10_000, SALUD),
    ]);

    expect(d[SUPER.id]!.cantidad).toBe(2);
    expect(d[SUPER.id]!.promedio).toBe(40_000);
    expect(d[SALUD.id]!.cantidad).toBe(1);
    expect(d[SALUD.id]!.promedio).toBe(10_000);
  });

  test("los mayores vienen de mayor a menor", () => {
    const d = detallesPorCategoria([
      g("2026-10-02", 10_000, SUPER, "chico"),
      g("2026-10-05", 90_000, SUPER, "grande"),
      g("2026-10-07", 50_000, SUPER, "medio"),
    ]);

    expect(d[SUPER.id]!.mayores.map((m) => m.descripcion)).toEqual([
      "grande",
      "medio",
      "chico",
    ]);
  });

  test("corta la lista de mayores donde se le pide", () => {
    const gastos = Array.from({ length: 10 }, (_, i) => g("2026-10-01", (i + 1) * 1000));
    expect(detallesPorCategoria(gastos, [], 3)[SUPER.id]!.mayores).toHaveLength(3);
    expect(detallesPorCategoria(gastos, [], 0)[SUPER.id]!.mayores).toHaveLength(0);
  });

  test("dos gastos del mismo monto mantienen un orden estable", () => {
    const gastos = [
      g("2026-10-09", 20_000, SUPER, "segundo"),
      g("2026-10-02", 20_000, SUPER, "primero"),
    ];
    const una = detallesPorCategoria(gastos)[SUPER.id]!.mayores.map((m) => m.descripcion);
    const otra = detallesPorCategoria([...gastos].reverse())[SUPER.id]!.mayores.map(
      (m) => m.descripcion,
    );

    expect(una).toEqual(["primero", "segundo"]);
    expect(otra).toEqual(una);
  });

  test("no altera el arreglo que recibe", () => {
    const gastos = [g("2026-10-09", 10_000), g("2026-10-02", 90_000)];
    const copia = gastos.map((x) => x.id);
    detallesPorCategoria(gastos);
    expect(gastos.map((x) => x.id)).toEqual(copia);
  });

  test("cuenta dias distintos, no gastos", () => {
    const d = detallesPorCategoria([
      g("2026-10-02", 1000),
      g("2026-10-02", 2000),
      g("2026-10-05", 3000),
    ]);
    expect(d[SUPER.id]!.cantidad).toBe(3);
    expect(d[SUPER.id]!.diasConGasto).toBe(2);
  });

  test("compara contra el mes anterior", () => {
    const d = detallesPorCategoria(
      [g("2026-10-02", 120_000)],
      [g("2026-09-02", 100_000)],
    );

    expect(d[SUPER.id]!.anterior).toBe(100_000);
    expect(d[SUPER.id]!.diferencia).toBe(20_000);
    expect(d[SUPER.id]!.variacion).toBeCloseTo(20, 6);
    expect(d[SUPER.id]!.nueva).toBe(false);
  });

  test("una categoria que no existia el mes pasado sale como nueva", () => {
    const d = detallesPorCategoria([g("2026-10-02", 50_000)], [g("2026-09-02", 1, SALUD)]);

    expect(d[SUPER.id]!.nueva).toBe(true);
    expect(d[SUPER.id]!.anterior).toBe(0);
    expect(d[SUPER.id]!.variacion).toBeNull();
  });

  test("sin mes anterior no inventa un porcentaje infinito", () => {
    const d = detallesPorCategoria([g("2026-10-02", 50_000)]);
    expect(d[SUPER.id]!.variacion).toBeNull();
    expect(Number.isFinite(d[SUPER.id]!.diferencia)).toBe(true);
  });

  test("detecta una baja respecto al mes pasado", () => {
    const d = detallesPorCategoria(
      [g("2026-10-02", 40_000)],
      [g("2026-09-02", 80_000)],
    );
    expect(d[SUPER.id]!.diferencia).toBe(-40_000);
    expect(d[SUPER.id]!.variacion).toBeCloseTo(-50, 6);
  });

  test("una categoria que estaba el mes pasado y este mes no, no aparece", () => {
    // El detalle cuelga de una fila de la lista; sin fila no hay donde ponerlo.
    const d = detallesPorCategoria([g("2026-10-02", 10_000, SUPER)], [g("2026-09-02", 99_000, SALUD)]);
    expect(Object.keys(d)).toEqual([SUPER.id]);
  });
});
