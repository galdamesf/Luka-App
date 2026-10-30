import { describe, expect, test } from "vitest";
import { calcularLoQueQueda, type EntradaLoQueQueda } from "@/dominio/lo-que-queda";
import { armarPresupuestos, type PresupuestoPlano } from "@/dominio/presupuestos";
import type { GastoPlano } from "@/dominio/resumen";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#c38409", icono: "shopping-cart", esencial: true };
const CUENTAS = { id: "c2", nombre: "Cuentas", color: "#009993", icono: "zap", esencial: true };
const CAFE = { id: "c3", nombre: "Café", color: "#c38409", icono: "coffee", esencial: false };

let n = 0;
const gasto = (monto: number, categoria = SUPER): GastoPlano => ({
  id: `g${++n}`, fecha: "2026-10-10", descripcion: "x", monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota: null, categoria,
});
const presupuesto = (categoria: typeof SUPER, monto: number): PresupuestoPlano => ({
  id: `p${++n}`, categoria, mes: "2026-10", monto, creadoEn: "2026-10-01",
});

// Supermercado: presupuesto 200.000, gastado 120.000 -> faltan 80.000.
// Cuentas: presupuesto 70.000, sin gasto, y una cuenta de luz pendiente de 30.000 -> faltan 40.000.
// Cafe: presupuesto 20.000, gastado 25.000 -> se paso, no falta nada.
const gastos = [gasto(120_000), gasto(25_000, CAFE)];
const presupuestos = armarPresupuestos(
  [presupuesto(SUPER, 200_000), presupuesto(CUENTAS, 70_000), presupuesto(CAFE, 20_000)],
  gastos,
  "2026-10",
);

const base: EntradaLoQueQueda = {
  sueldo: 1_000_000,
  gastos: 145_000,
  cuotasPagadas: 50_000,
  cuentasPorPagar: { total: 30_000, cantidad: 1 },
  cuotasPorPagar: { total: 75_000, cantidad: 1 },
  presupuestos,
  comprometidoPorCategoria: { c2: 30_000 },
  ahorros: [{ monto: 100_000 }, { monto: 50_000 }],
  diasRestantes: 10,
  estado: "en-curso",
};

describe("calcularLoQueQueda", () => {
  const r = calcularLoQueQueda(base);

  test("resta pagos, cuentas, cuotas, presupuesto por gastar y ahorro", () => {
    expect(r.pagado).toEqual({ gastos: 145_000, cuotas: 50_000, total: 195_000 });
    expect(r.presupuestoPorGastar.total).toBe(80_000 + 40_000);
    expect(r.ahorro).toEqual({ total: 150_000, cantidad: 2 });
    expect(r.descuentos).toBe(195_000 + 30_000 + 75_000 + 120_000 + 150_000);
    expect(r.quedaria).toBe(1_000_000 - 570_000);
  });

  test("del presupuesto resta solo lo que falta, sin la cuenta pendiente que ya se cuenta aparte", () => {
    expect(r.presupuestoPorGastar.lineas.map((l) => [l.categoria.nombre, l.porGastar, l.enCuentas])).toEqual([
      ["Supermercado", 80_000, 0],
      ["Cuentas", 40_000, 30_000],
    ]);
  });

  test("un presupuesto excedido no suma nada: lo gastado de mas ya esta en los pagos", () => {
    expect(r.presupuestoPorGastar.lineas.some((l) => l.categoria.nombre === "Café")).toBe(false);
  });

  test("reparte lo que queda en los dias que faltan y dice si sobra", () => {
    expect(r.porDia).toBe(43_000);
    expect(r.porcentajeDelSueldo).toBeCloseTo(43, 9);
    expect(r.estado).toBe("sobra");
  });

  test("bajo el 10% del sueldo es ajustado; bajo cero, falta", () => {
    expect(calcularLoQueQueda({ ...base, ahorros: [{ monto: 500_000 }] }).estado).toBe("ajustado");
    const falta = calcularLoQueQueda({ ...base, ahorros: [{ monto: 750_000 }] });
    expect(falta.quedaria).toBe(-170_000);
    expect(falta.estado).toBe("falta");
    expect(falta.porDia).toBeNull();
  });

  test("en un mes cerrado el presupuesto sin gastar ya no se descuenta", () => {
    const cerrado = calcularLoQueQueda({ ...base, estado: "cerrado", diasRestantes: 0 });
    expect(cerrado.presupuestoPorGastar).toEqual({ total: 0, lineas: [] });
    expect(cerrado.quedaria).toBe(1_000_000 - 450_000);
    expect(cerrado.porDia).toBeNull();
  });

  test("sin sueldo lo dice, y todo lo comprometido queda en negativo", () => {
    const sin = calcularLoQueQueda({ ...base, sueldo: null });
    expect(sin.sinSueldo).toBe(true);
    expect(sin.quedaria).toBe(-570_000);
    expect(sin.porcentajeDelSueldo).toBeNull();
  });

  test("sin ahorros ni presupuestos, es el sueldo menos lo pagado y lo pendiente", () => {
    const simple = calcularLoQueQueda({ ...base, ahorros: [], presupuestos: { lineas: [] } });
    expect(simple.quedaria).toBe(1_000_000 - 195_000 - 30_000 - 75_000);
  });
});
