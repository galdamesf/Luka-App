import { describe, expect, test } from "vitest";
import { historialDeAhorro, totalAhorrado } from "@/dominio/ahorros";
import { esquemaAhorroFormulario } from "@/dominio/esquemas";

const ahorros = [
  { mes: "2026-08", monto: 100_000 },
  { mes: "2026-10", monto: 150_000 },
  { mes: "2026-10", monto: 50_000 },
  { mes: "2026-11", monto: 999_999 },
  { mes: "2025-12", monto: 30_000 },
];

describe("totalAhorrado", () => {
  test("suma todo hasta el mes, ese incluido, y nada despues", () => {
    expect(totalAhorrado(ahorros, "2026-10")).toBe(330_000);
    expect(totalAhorrado(ahorros, "2026-09")).toBe(130_000);
    expect(totalAhorrado([], "2026-10")).toBe(0);
  });
});

describe("historialDeAhorro", () => {
  test("los ultimos meses en orden, con cero donde no hubo ahorro", () => {
    expect(historialDeAhorro(ahorros, "2026-10", 4)).toEqual([
      { mes: "2026-07", total: 0 },
      { mes: "2026-08", total: 100_000 },
      { mes: "2026-09", total: 0 },
      { mes: "2026-10", total: 200_000 },
    ]);
  });

  test("cruza el cambio de ano", () => {
    expect(historialDeAhorro(ahorros, "2026-01", 2)).toEqual([
      { mes: "2025-12", total: 30_000 },
      { mes: "2026-01", total: 0 },
    ]);
  });
});

describe("esquemaAhorroFormulario", () => {
  test("acepta el monto como se escribe y la nota vacia queda en null", () => {
    expect(esquemaAhorroFormulario.parse({ mes: "2026-10", monto: "$150.000", nota: "  " })).toEqual({
      mes: "2026-10",
      monto: 150_000,
      nota: null,
    });
  });

  test("rechaza el cero, un mes mal escrito y una nota muy larga", () => {
    expect(esquemaAhorroFormulario.safeParse({ mes: "2026-10", monto: "0" }).success).toBe(false);
    expect(esquemaAhorroFormulario.safeParse({ mes: "10-2026", monto: "1000" }).success).toBe(false);
    expect(esquemaAhorroFormulario.safeParse({ mes: "2026-10", monto: "1000", nota: "x".repeat(121) }).success).toBe(false);
  });
});
