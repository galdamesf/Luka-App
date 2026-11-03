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
    expect(r.pagado).toEqual({ gastos: 145_000, cuotas: 50_000, total: 195_000, detalle: null });
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

describe("libre, lo que puedes ahorrar y la meta", () => {
  const r = calcularLoQueQueda(base);
  test("libre es el sueldo menos lo pagado y lo que falta pagar, antes de presupuestos y ahorro", () => {
    expect(r.libre).toBe(1_000_000 - 195_000 - 30_000 - 75_000);
    // De ahi salen el presupuesto por gastar y el ahorro, y queda lo que quedaria.
    expect(r.libre - r.presupuestoPorGastar.total - r.ahorro.total).toBe(r.quedaria);
  });

  test("puedes ahorrar lo que quedaria; si no alcanza, cero", () => {
    expect(r.puedesAhorrar).toBe(430_000);
    expect(calcularLoQueQueda({ ...base, ahorros: [{ monto: 750_000 }] }).puedesAhorrar).toBe(0);
  });

  test("sin meta no hay comparacion", () => {
    expect(r.meta).toBeNull();
  });

  test("con lo apartado y lo que puedes ahorrar, dice cuanto sobra despues de cumplir la meta", () => {
    const m = calcularLoQueQueda({ ...base, metaAhorro: 200_000 }).meta;
    expect(m).toEqual({ monto: 200_000, apartado: 150_000, porApartar: 50_000, alcanza: true, diferencia: 380_000 });
  });

  test("y cuanto falta cuando no alcanza (el caso real: meta 751.611, puedes 562.314)", () => {
    const m = calcularLoQueQueda({ ...base, ahorros: [], metaAhorro: 1_000_000 }).meta;
    // Sin ahorro apartado: quedaria = 1.000.000 - 195.000 - 30.000 - 75.000 - 120.000 = 580.000.
    expect(m).toEqual({ monto: 1_000_000, apartado: 0, porApartar: 1_000_000, alcanza: false, diferencia: 420_000 });
  });
});

describe("el detalle de los pagos realizados", () => {
  const r = calcularLoQueQueda(base);
  const REGALOS = { id: "c4", nombre: "Regalos", color: "#be185d", icono: "gift", esencial: false };
  const luz: GastoPlano = { ...gasto(30_000, CUENTAS), descripcion: "Luz", cuenta: { cuentaId: "q1", nombre: "Luz" } };
  const lego: GastoPlano = { ...gasto(34_990, REGALOS), descripcion: "Lego" };
  const libro: GastoPlano = { ...gasto(23_398, REGALOS), descripcion: "Libro" };
  const parque: GastoPlano = { ...gasto(450, REGALOS), descripcion: "Estacionamiento" };
  const juego: GastoPlano = { ...gasto(19_900, REGALOS), descripcion: "Rompecabezas" };
  const cuota: GastoPlano = { ...gasto(50_000, CUENTAS), cuota: { deudaId: "d1", deudaNombre: "Ripley" } };
  const delMes = [...gastos, luz, lego, libro, parque, juego, cuota];
  const totalSinCuotas = 145_000 + 30_000 + 34_990 + 23_398 + 450 + 19_900;

  const conDetalle = calcularLoQueQueda({ ...base, gastos: totalSinCuotas, gastosDelMes: delMes });
  const detalle = conDetalle.pagado.detalle!;

  test("separa cuentas y cuotas, dentro de presupuesto y fuera de presupuesto", () => {
    // La luz es de "Cuentas", que tiene presupuesto, pero es el pago de una cuenta.
    expect(detalle.cuentasYCuotas).toBe(30_000 + 50_000);
    // Super y cafe tienen presupuesto (el cafe aunque se haya pasado).
    expect(detalle.dentroDePresupuesto).toBe(120_000 + 25_000);
    expect(detalle.fueraDePresupuesto.total).toBe(34_990 + 23_398 + 450 + 19_900);
    expect(detalle.fueraDePresupuesto.cantidad).toBe(4);
  });

  test("las tres partes suman exactamente lo pagado", () => {
    expect(detalle.cuentasYCuotas + detalle.dentroDePresupuesto + detalle.fueraDePresupuesto.total).toBe(
      conDetalle.pagado.total,
    );
  });

  test("nombra los tres mas grandes de fuera de presupuesto", () => {
    expect(detalle.fueraDePresupuesto.mayores.map((g) => [g.descripcion, g.monto])).toEqual([
      ["Lego", 34_990],
      ["Libro", 23_398],
      ["Rompecabezas", 19_900],
    ]);
  });

  test("sin los gastos del mes no hay detalle", () => {
    expect(r.pagado.detalle).toBeNull();
  });
});
