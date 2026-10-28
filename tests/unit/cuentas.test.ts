import { describe, expect, test } from "vitest";
import {
  estaPagada,
  fechaDeVencimiento,
  mensualesQueFaltan,
  resumirCuentas,
  type CuentaPlana,
} from "@/dominio/cuentas";

const CUENTAS_CAT = { id: "c1", nombre: "Cuentas", color: "#0891b2", icono: "zap", esencial: true };
const INTERNET = { id: "c2", nombre: "Internet", color: "#3b82f6", icono: "wifi", esencial: true };

let n = 0;
function cuenta(cambios: Partial<CuentaPlana> = {}): CuentaPlana {
  n += 1;
  return {
    id: `q${n}`,
    nombre: `Cuenta ${n}`,
    monto: 30000,
    mes: "2026-10",
    diaVencimiento: null,
    categoria: CUENTAS_CAT,
    pagadaEn: null,
    gastoId: null,
    mensual: false,
    boletaArchivo: null,
    nota: null,
    ...cambios,
  };
}

const pagada = (cambios: Partial<CuentaPlana> = {}) =>
  cuenta({ pagadaEn: "2026-10-09", gastoId: "g1", ...cambios });

describe("estaPagada", () => {
  test("distingue por la fecha de pago, no por el gasto", () => {
    expect(estaPagada(cuenta())).toBe(false);
    expect(estaPagada(pagada())).toBe(true);
    // Si se borro el gasto a mano, la cuenta sigue pagada.
    expect(estaPagada(cuenta({ pagadaEn: "2026-10-09", gastoId: null }))).toBe(true);
  });
});

describe("fechaDeVencimiento", () => {
  test("arma la fecha con el dia indicado", () => {
    expect(fechaDeVencimiento(cuenta({ diaVencimiento: 20 }), 31)).toBe("2026-10-20");
    expect(fechaDeVencimiento(cuenta({ diaVencimiento: 5 }), 31)).toBe("2026-10-05");
  });

  test("sin dia no hay vencimiento", () => {
    expect(fechaDeVencimiento(cuenta(), 31)).toBeNull();
  });

  test("un vencimiento el 31 en febrero se corre al ultimo dia", () => {
    const febrero = cuenta({ mes: "2026-02", diaVencimiento: 31 });
    expect(fechaDeVencimiento(febrero, 28)).toBe("2026-02-28");
    expect(fechaDeVencimiento(cuenta({ mes: "2028-02", diaVencimiento: 31 }), 29)).toBe("2028-02-29");
  });

  test("un vencimiento el 31 en un mes de 30 se corre al 30", () => {
    expect(fechaDeVencimiento(cuenta({ mes: "2026-04", diaVencimiento: 31 }), 30)).toBe("2026-04-30");
  });
});

describe("resumirCuentas", () => {
  test("separa pendientes de pagadas y suma cada grupo", () => {
    const r = resumirCuentas(
      [
        cuenta({ nombre: "Luz", monto: 38400 }),
        cuenta({ nombre: "Agua", monto: 22000 }),
        pagada({ nombre: "Internet", monto: 24990 }),
      ],
      "2026-10", 31, "2026-10-27",
    );

    expect(r.pendientes.map((c) => c.nombre).sort()).toEqual(["Agua", "Luz"]);
    expect(r.pagadas.map((c) => c.nombre)).toEqual(["Internet"]);
    expect(r.totalPendiente).toBe(60400);
    expect(r.totalPagado).toBe(24990);
    expect(r.total).toBe(85390);
  });

  test("deja fuera las de otros meses", () => {
    const r = resumirCuentas(
      [cuenta({ monto: 10000 }), cuenta({ mes: "2026-09", monto: 99999 }), cuenta({ mes: "2026-11", monto: 88888 })],
      "2026-10", 31, "2026-10-27",
    );
    expect(r.total).toBe(10000);
  });

  test("ordena las pendientes por vencimiento mas cercano", () => {
    const r = resumirCuentas(
      [
        cuenta({ nombre: "Tarde", diaVencimiento: 28 }),
        cuenta({ nombre: "Temprano", diaVencimiento: 5 }),
        cuenta({ nombre: "Medio", diaVencimiento: 15 }),
      ],
      "2026-10", 31, "2026-10-01",
    );
    expect(r.pendientes.map((c) => c.nombre)).toEqual(["Temprano", "Medio", "Tarde"]);
  });

  test("las sin fecha de vencimiento van al final, no al principio", () => {
    const r = resumirCuentas(
      [cuenta({ nombre: "Sin fecha" }), cuenta({ nombre: "Con fecha", diaVencimiento: 20 })],
      "2026-10", 31, "2026-10-01",
    );
    expect(r.pendientes.map((c) => c.nombre)).toEqual(["Con fecha", "Sin fecha"]);
  });

  test("las pagadas se ordenan por lo ultimo pagado primero", () => {
    const r = resumirCuentas(
      [
        pagada({ nombre: "Primera", pagadaEn: "2026-10-03" }),
        pagada({ nombre: "Ultima", pagadaEn: "2026-10-25" }),
        pagada({ nombre: "Media", pagadaEn: "2026-10-14" }),
      ],
      "2026-10", 31, "2026-10-27",
    );
    expect(r.pagadas.map((c) => c.nombre)).toEqual(["Ultima", "Media", "Primera"]);
  });

  test("marca vencida la pendiente cuya fecha ya paso", () => {
    const r = resumirCuentas(
      [
        cuenta({ nombre: "Vencida", diaVencimiento: 5 }),
        cuenta({ nombre: "Por vencer", diaVencimiento: 28 }),
        cuenta({ nombre: "Justo hoy", diaVencimiento: 27 }),
      ],
      "2026-10", 31, "2026-10-27",
    );
    // El dia del vencimiento todavia no esta vencida: tienes hasta hoy.
    expect(r.vencidas.map((c) => c.nombre)).toEqual(["Vencida"]);
  });

  test("una pagada no cuenta como vencida aunque la fecha haya pasado", () => {
    const r = resumirCuentas(
      [pagada({ nombre: "Pague tarde", diaVencimiento: 5, pagadaEn: "2026-10-20" })],
      "2026-10", 31, "2026-10-27",
    );
    expect(r.vencidas).toEqual([]);
  });

  test("en un mes futuro nada esta vencido", () => {
    const r = resumirCuentas(
      [cuenta({ mes: "2026-12", diaVencimiento: 5 })],
      "2026-12", 31, "2026-10-27",
    );
    expect(r.vencidas).toEqual([]);
    expect(r.pendientes).toHaveLength(1);
  });

  test("un mes sin cuentas no explota", () => {
    const r = resumirCuentas([], "2026-10", 31, "2026-10-27");
    expect(r.total).toBe(0);
    expect(r.pendientes).toEqual([]);
    expect(r.pagadas).toEqual([]);
    expect(r.vencidas).toEqual([]);
  });
});

describe("mensualesQueFaltan", () => {
  test("propone las mensuales del mes anterior que aun no estan", () => {
    const faltan = mensualesQueFaltan(
      [
        cuenta({ nombre: "Luz", mensual: true, monto: 38400, diaVencimiento: 10 }),
        cuenta({ nombre: "Internet", mensual: true, monto: 24990, categoria: INTERNET }),
      ],
      [],
    );
    expect(faltan.map((f) => f.nombre).sort()).toEqual(["Internet", "Luz"]);
    expect(faltan.find((f) => f.nombre === "Luz")?.diaVencimiento).toBe(10);
    expect(faltan.find((f) => f.nombre === "Internet")?.categoriaId).toBe("c2");
  });

  test("no propone las que no son mensuales", () => {
    const faltan = mensualesQueFaltan(
      [cuenta({ nombre: "Una vez", mensual: false }), cuenta({ nombre: "Siempre", mensual: true })],
      [],
    );
    expect(faltan.map((f) => f.nombre)).toEqual(["Siempre"]);
  });

  test("no duplica lo que ya existe en el mes", () => {
    const faltan = mensualesQueFaltan(
      [cuenta({ nombre: "Luz", mensual: true }), cuenta({ nombre: "Agua", mensual: true })],
      [cuenta({ nombre: "Luz", mes: "2026-11" })],
    );
    expect(faltan.map((f) => f.nombre)).toEqual(["Agua"]);
  });

  test("llamarla dos veces no propone nada la segunda", () => {
    const anterior = [cuenta({ nombre: "Luz", mensual: true })];
    const primera = mensualesQueFaltan(anterior, []);
    expect(primera).toHaveLength(1);

    const yaCreadas = primera.map((f) => cuenta({ nombre: f.nombre, mes: "2026-11" }));
    expect(mensualesQueFaltan(anterior, yaCreadas)).toEqual([]);
  });

  test("propone el monto del mes anterior, que es la mejor referencia", () => {
    // Si la luz subio de 30.000 a 38.400, el mes siguiente parte de 38.400.
    const faltan = mensualesQueFaltan([cuenta({ nombre: "Luz", mensual: true, monto: 38400 })], []);
    expect(faltan[0]?.monto).toBe(38400);
  });

  test("sin mes anterior no propone nada", () => {
    expect(mensualesQueFaltan([], [])).toEqual([]);
  });
});
