import { describe, expect, test } from "vitest";
import { calcularBalance, type DeudaPlana, type PagoCuota } from "@/dominio/balance";
import { resumirCuentas, type CuentaPlana } from "@/dominio/cuentas";
import { armarResumenPanel, tonoDeUso, type EntradaPanel } from "@/dominio/panel";
import { resumirMes, type GastoPlano } from "@/dominio/resumen";
import { diasEnMesISO } from "@/lib/fecha";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#15803d", icono: "shopping-cart", esencial: true };
const RESTO = { id: "c2", nombre: "Restaurantes", color: "#c2410c", icono: "utensils", esencial: false };
const CUENTAS = { id: "c3", nombre: "Cuentas", color: "#0891b2", icono: "zap", esencial: true };

let n = 0;
function gasto(fecha: string, monto: number, cambios: Partial<GastoPlano> = {}): GastoPlano {
  n += 1;
  return {
    id: `g${n}`, fecha, descripcion: `Gasto ${n}`, monto,
    medioPago: "DEBITO", notas: null, boletaArchivo: null, cuota: null, categoria: SUPER,
    ...cambios,
  };
}

function cuenta(cambios: Partial<CuentaPlana> = {}): CuentaPlana {
  n += 1;
  return {
    id: `q${n}`, nombre: `Cuenta ${n}`, monto: 30000, mes: "2026-10", diaVencimiento: null,
    categoria: CUENTAS, pagadaEn: null, gastoId: null, mensual: false, boletaArchivo: null, nota: null,
    ...cambios,
  };
}

const deuda = (cambios: Partial<DeudaPlana>): DeudaPlana => ({
  id: "d1", nombre: "Crédito", montoCuota: 85000, cuotasTotales: 12, primeraCuota: "2026-08", activa: true,
  ...cambios,
});

type Escenario = {
  mes?: string;
  hoy?: string;
  sueldo?: number | null;
  gastos?: GastoPlano[];
  deudas?: DeudaPlana[];
  pagos?: PagoCuota[];
  cuentas?: CuentaPlana[];
  anterior?: GastoPlano[];
};

/** Arma la entrada con las funciones reales del dominio, como lo hace la pagina. */
function entrada({
  mes = "2026-10",
  hoy = "2026-10-29",
  sueldo = 1_000_000,
  gastos = [],
  deudas = [],
  pagos = [],
  cuentas = [],
  anterior = [],
}: Escenario = {}): EntradaPanel {
  const diasDelMes = diasEnMesISO(mes);
  const resumen = resumirMes(gastos, mes, new Date(`${hoy}T15:00:00.000Z`));
  const balance = calcularBalance({ mes, sueldo, resumen, deudas, pagos });
  return {
    mes, hoy, diasDelMes, balance, resumen,
    cuentas: resumirCuentas(cuentas, mes, diasDelMes, hoy),
    gastosMesAnterior: anterior,
  };
}

describe("tonoDeUso", () => {
  test("verde bajo 80, ambar de 80 a 99, rojo desde 100", () => {
    expect(tonoDeUso(0)).toBe("exito");
    expect(tonoDeUso(79.9)).toBe("exito");
    expect(tonoDeUso(80)).toBe("alerta");
    expect(tonoDeUso(99.9)).toBe("alerta");
    expect(tonoDeUso(100)).toBe("peligro");
    expect(tonoDeUso(140)).toBe("peligro");
  });
});

describe("un mes con de todo", () => {
  const e = entrada({
    gastos: [
      gasto("2026-10-05", 300_000),
      gasto("2026-10-20", 100_000, { categoria: RESTO }),
      // El gasto que dejo el pago de la cuota: no entra al total de gastos.
      gasto("2026-10-10", 85_000, { cuota: { deudaId: "d1", deudaNombre: "Crédito" } }),
    ],
    deudas: [deuda({ id: "d1" }), deuda({ id: "d2", nombre: "Notebook", montoCuota: 50_000 })],
    pagos: [{ deudaId: "d1", mes: "2026-10", pagadaEn: "2026-10-10", monto: 85_000 }],
    cuentas: [
      cuenta({ diaVencimiento: 25, monto: 40_000 }), // vencida
      cuenta({ diaVencimiento: 31, monto: 20_000 }), // vence en 2 dias
      cuenta({ monto: 10_000 }), // sin fecha
      cuenta({ diaVencimiento: 5, monto: 99_000, pagadaEn: "2026-10-05", gastoId: "gx" }),
    ],
    anterior: [
      gasto("2026-09-10", 200_000),
      gasto("2026-09-29", 50_000),
      gasto("2026-09-30", 100_000), // despues del dia 29: no se compara
    ],
  });
  const r = armarResumenPanel(e);

  test("lo gastado suma los gastos y las cuotas ya pagadas", () => {
    expect(r.gastado).toBe(485_000);
    expect(r.cuotasPagadas).toBe(85_000);
  });

  test("el disponible es el mismo 'Te queda' de la secuencia del balance", () => {
    expect(r.disponible).toBe(515_000);
    expect(r.disponible).toBe(e.balance.saldo);
  });

  test("por pagar junta cuentas pendientes y cuotas sin pagar", () => {
    expect(r.porPagar).toBe(40_000 + 20_000 + 10_000 + 50_000);
    expect(r.trasPagar).toBe(515_000 - 120_000);
  });

  test("separa lo pendiente en vencido, por vencer y programado", () => {
    expect(r.cuentasVencidas).toBe(1);
    expect(r.montoVencido).toBe(40_000);
    expect(r.porVencer).toBe(1);
    // La cuenta sin fecha y la cuota del notebook.
    expect(r.programadas).toBe(2);
  });

  test("compara con el mes anterior hasta el mismo dia", () => {
    expect(r.diaComparado).toBe(29);
    expect(r.variacion).toBeCloseTo(((485_000 - 250_000) / 250_000) * 100, 6);
  });

  test("la barra reparte el sueldo en gastado, comprometido y libre", () => {
    expect(r.barra.gastadoPct).toBeCloseTo(48.5, 6);
    expect(r.barra.comprometidoPct).toBeCloseTo(12, 6);
    expect(r.barra.librePct).toBeCloseTo(39.5, 6);
    expect(r.barra.libre).toBe(395_000);
    expect(r.barra.tono).toBe("exito");
  });

  test("marca el dia de hoy y reparte lo libre en los dias que quedan, contando hoy", () => {
    expect(r.barra.diaDeHoy).toBe(29);
    expect(r.barra.marcadorDia).toBeCloseTo((29 / 31) * 100, 6);
    expect(r.barra.diasRestantes).toBe(3);
    expect(r.barra.librePorDia).toBe(Math.floor(395_000 / 3));
    expect(r.barra.ritmo).toBeCloseTo((29 / 31) * 100 - 48.5, 6);
  });
});

describe("por vencer", () => {
  test("cuenta hasta siete dias desde hoy, hoy incluido", () => {
    const r = armarResumenPanel(
      entrada({
        hoy: "2026-10-10",
        cuentas: [
          cuenta({ diaVencimiento: 10 }), // vence hoy
          cuenta({ diaVencimiento: 17 }), // justo a siete dias
          cuenta({ diaVencimiento: 18 }), // a ocho: programada
        ],
      }),
    );
    expect(r.cuentasVencidas).toBe(0);
    expect(r.porVencer).toBe(2);
    expect(r.programadas).toBe(1);
  });
});

describe("cuando no alcanza", () => {
  const r = armarResumenPanel(
    entrada({
      sueldo: 500_000,
      gastos: [gasto("2026-10-03", 450_000)],
      cuentas: [cuenta({ monto: 120_000 })],
    }),
  );

  test("lo libre queda negativo y la barra no muestra libre", () => {
    expect(r.barra.libre).toBe(-70_000);
    expect(r.barra.librePct).toBe(0);
    expect(r.barra.librePorDia).toBeNull();
    expect(r.trasPagar).toBe(-70_000);
  });

  test("el tono avisa por lo que va a pasar, no solo por lo gastado", () => {
    expect(r.barra.tonoGastado).toBe("alerta");
    expect(r.barra.tono).toBe("peligro");
    expect(r.barra.comprometidoPct).toBeCloseTo(24, 6);
  });

  test("pasarse del sueldo se ve: el porcentaje no tiene tope", () => {
    const pasado = armarResumenPanel(entrada({ sueldo: 300_000, gastos: [gasto("2026-10-03", 450_000)] }));
    expect(pasado.barra.gastadoPct).toBeCloseTo(150, 6);
    expect(pasado.barra.tono).toBe("peligro");
  });
});

describe("meses que no son el en curso", () => {
  test("un mes cerrado compara el mes entero y no tiene ritmo", () => {
    const r = armarResumenPanel(
      entrada({
        mes: "2026-09",
        hoy: "2026-10-29",
        gastos: [gasto("2026-09-15", 100_000)],
        anterior: [gasto("2026-08-31", 80_000)],
      }),
    );
    expect(r.diaComparado).toBe(30);
    expect(r.variacion).toBeCloseTo(25, 6);
    expect(r.barra.marcadorDia).toBeNull();
    expect(r.barra.diaDeHoy).toBeNull();
    expect(r.barra.diasRestantes).toBe(0);
    expect(r.barra.librePorDia).toBeNull();
    expect(r.barra.ritmo).toBeNull();
  });

  test("un mes futuro no compara con nada", () => {
    const r = armarResumenPanel(
      entrada({ mes: "2026-11", hoy: "2026-10-29", anterior: [gasto("2026-10-05", 50_000)] }),
    );
    expect(r.diaComparado).toBe(0);
    expect(r.variacion).toBeNull();
    expect(r.barra.diasRestantes).toBe(30);
  });
});

describe("sin datos", () => {
  test("sin gastos en el mes anterior la variacion es null, no infinito", () => {
    const r = armarResumenPanel(entrada({ gastos: [gasto("2026-10-02", 10_000)] }));
    expect(r.variacion).toBeNull();
  });

  test("sin sueldo definido no divide por cero", () => {
    const r = armarResumenPanel(entrada({ sueldo: null, gastos: [gasto("2026-10-02", 10_000)] }));
    expect(r.sinSueldo).toBe(true);
    expect(r.barra.gastadoPct).toBe(0);
    expect(r.barra.librePct).toBe(0);
    expect(r.barra.ritmo).toBeNull();
    expect(Number.isNaN(r.barra.comprometidoPct)).toBe(false);
  });
});
