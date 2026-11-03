import { describe, expect, test } from "vitest";
import {
  cambiosDelPlan,
  planearMovimiento,
  type DatosDeUnMes,
  type DeudaParaMover,
} from "@/dominio/mover-mes";

const vacio: DatosDeUnMes = { cuentas: [], presupuestos: [], ahorros: [] };
const OCT_A_NOV = { desde: "2026-10", hasta: "2026-11" };
const cuenta = (id: string, nombre: string, extra: { pagada?: boolean; conBoleta?: boolean } = {}) => ({
  id, nombre, monto: 10_000, pagada: extra.pagada ?? false, conBoleta: extra.conBoleta ?? false,
});
const conAlgo: DatosDeUnMes = { ...vacio, cuentas: [cuenta("c1", "Luz")] };

// Los datos reales: Ripley vence el 30, 2 cuotas desde octubre, la primera
// pagada el 2 de noviembre y anotada en octubre.
const ripley: DeudaParaMover = {
  id: "d1", nombre: "Deuda-Ripley", primeraCuota: "2026-10", cuotasTotales: 2,
  pagos: [{ id: "q1", mes: "2026-10", monto: 95_000 }],
};
const scotiabank: DeudaParaMover = {
  id: "d2", nombre: "Deuda Scotiabank", primeraCuota: "2026-04", cuotasTotales: 12, pagos: [],
};

describe("planearMovimiento", () => {
  test("sin nada en el destino, pasa todo", () => {
    const origen: DatosDeUnMes = {
      cuentas: [cuenta("c1", "Luz", { pagada: true }), cuenta("c2", "Agua")],
      presupuestos: [{ id: "p1", categoriaId: "k1", categoriaNombre: "Supermercado", monto: 200_000 }],
      ahorros: [{ id: "a1", monto: 50_000, nota: null }],
    };
    const plan = planearMovimiento(origen, vacio, OCT_A_NOV);
    expect(plan.cuentas.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(plan.presupuestos.map((p) => p.id)).toEqual(["p1"]);
    expect(plan.ahorros.map((a) => a.id)).toEqual(["a1"]);
    expect(plan.copiasQueSobran).toEqual([]);
    expect(plan.conflictos).toEqual([]);
    expect(cambiosDelPlan(plan)).toBe(4);
  });

  test("la copia pendiente que la app creo sola en el destino se quita, y pasa la de origen", () => {
    const plan = planearMovimiento(
      { ...vacio, cuentas: [cuenta("c1", "Luz", { pagada: true })] },
      { ...vacio, cuentas: [cuenta("n1", "Luz")] },
      OCT_A_NOV,
    );
    expect(plan.copiasQueSobran.map((c) => c.id)).toEqual(["n1"]);
    expect(plan.cuentas.map((c) => c.id)).toEqual(["c1"]);
  });

  test("si en el destino ya esta pagada o tiene boleta, no se toca y se avisa", () => {
    const plan = planearMovimiento(
      { ...vacio, cuentas: [cuenta("c1", "Luz"), cuenta("c2", "Gas")] },
      { ...vacio, cuentas: [cuenta("n1", "Luz", { pagada: true }), cuenta("n2", "Gas", { conBoleta: true })] },
      OCT_A_NOV,
    );
    expect(plan.cuentas).toEqual([]);
    expect(plan.copiasQueSobran).toEqual([]);
    expect(plan.conflictos.map((c) => c.que)).toEqual(['Cuenta "Luz"', 'Cuenta "Gas"']);
  });

  test("un presupuesto repetido en el destino no se mueve", () => {
    const plan = planearMovimiento(
      { ...vacio, presupuestos: [{ id: "p1", categoriaId: "k1", categoriaNombre: "Supermercado", monto: 200_000 }] },
      { ...vacio, presupuestos: [{ id: "p2", categoriaId: "k1", categoriaNombre: "Supermercado", monto: 150_000 }] },
      OCT_A_NOV,
    );
    expect(plan.presupuestos).toEqual([]);
    expect(plan.conflictos).toHaveLength(1);
    expect(cambiosDelPlan(plan)).toBe(0);
  });
});

describe("el calendario de las deudas", () => {
  test("Ripley: noviembre pasa a ser la cuota 1 de 2 (pagada), no la 2 que la daba por terminada", () => {
    const plan = planearMovimiento(conAlgo, vacio, OCT_A_NOV, [ripley]);
    expect(plan.deudas).toEqual([{
      id: "d1", nombre: "Deuda-Ripley", primeraCuota: "2026-10", nuevaPrimeraCuota: "2026-11",
      cuotasTotales: 2, cuotaAntes: 2, cuotaDespues: 1,
    }]);
    expect(plan.pagos).toEqual([{
      id: "q1", deudaId: "d1", deudaNombre: "Deuda-Ripley", monto: 95_000, mes: "2026-10", nuevoMes: "2026-11",
    }]);
  });

  test("una deuda que partio antes conserva la cuota que se paga con este sueldo", () => {
    const plan = planearMovimiento(conAlgo, vacio, OCT_A_NOV, [scotiabank]);
    expect(plan.deudas[0]).toMatchObject({ nuevaPrimeraCuota: "2026-05", cuotaAntes: 8, cuotaDespues: 7 });
  });

  test("se corren todos los pagos de la deuda, no solo los del mes de origen", () => {
    const conVarios: DeudaParaMover = {
      ...scotiabank,
      pagos: [{ id: "q1", mes: "2026-09", monto: 168_000 }, { id: "q2", mes: "2026-10", monto: 168_000 }],
    };
    const plan = planearMovimiento(conAlgo, vacio, OCT_A_NOV, [conVarios]);
    expect(plan.pagos.map((p) => [p.mes, p.nuevoMes])).toEqual([["2026-09", "2026-10"], ["2026-10", "2026-11"]]);
  });

  test("con el mes de origen vacio (ya se aplico) no se corren otra vez", () => {
    const plan = planearMovimiento(vacio, conAlgo, OCT_A_NOV, [ripley, scotiabank]);
    expect(plan.deudas).toEqual([]);
    expect(plan.pagos).toEqual([]);
    expect(cambiosDelPlan(plan)).toBe(0);
  });
});
