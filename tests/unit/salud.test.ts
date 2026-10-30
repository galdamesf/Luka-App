import { describe, expect, test } from "vitest";
import { calcularBalance, type DeudaPlana } from "@/dominio/balance";
import { resumirCuentas, type CuentaPlana } from "@/dominio/cuentas";
import { armarResumenPanel } from "@/dominio/panel";
import { armarPresupuestos, type PresupuestoPlano } from "@/dominio/presupuestos";
import { resumirMes, type GastoPlano } from "@/dominio/resumen";
import { bandaDe, calcularSalud, puntajeDeSalud, type EntradaSalud } from "@/dominio/salud";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#15803d", icono: "shopping-cart", esencial: true };
const CAFE = { id: "c2", nombre: "Café", color: "#c2410c", icono: "coffee", esencial: false };
const LUZ = { id: "c3", nombre: "Cuentas", color: "#0891b2", icono: "zap", esencial: true };

let n = 0;
const gasto = (fecha: string, monto: number, categoria = SUPER): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: "x", monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota: null, categoria,
});
const cuenta = (c: Partial<CuentaPlana>): CuentaPlana => ({
  id: `q${++n}`, nombre: `Cuenta ${n}`, monto: 30_000, mes: "2026-10", diaVencimiento: null,
  categoria: LUZ, pagadaEn: null, gastoId: null, mensual: false, boletaArchivo: null, nota: null, ...c,
});
const techo = (categoria: typeof SUPER, monto: number): PresupuestoPlano => ({
  id: `p${++n}`, categoria, mes: "2026-10", monto, creadoEn: "2026-10-01",
});
const deuda = (montoCuota: number): DeudaPlana => ({
  id: `d${++n}`, nombre: "Crédito", montoCuota, cuotasTotales: 12, primeraCuota: "2026-06", activa: true,
});

type Escenario = {
  mes?: string;
  hoy?: string;
  sueldo?: number | null;
  gastos?: GastoPlano[];
  cuentas?: CuentaPlana[];
  techos?: PresupuestoPlano[];
  deudas?: DeudaPlana[];
};

function entrada({
  mes = "2026-10", hoy = "2026-10-29", sueldo = 2_000_000,
  gastos = [], cuentas = [], techos = [], deudas = [],
}: Escenario = {}): EntradaSalud {
  const resumen = resumirMes(gastos, mes, new Date(`${hoy}T15:00:00.000Z`));
  const balance = calcularBalance({ mes, sueldo, resumen, deudas });
  const panel = armarResumenPanel({
    mes, hoy, diasDelMes: 31, balance, resumen,
    cuentas: resumirCuentas(cuentas, mes, 31, hoy), gastosMesAnterior: [],
  });
  return { panel, presupuestos: armarPresupuestos(techos, gastos, mes), cuotasDelMes: balance.cuotasComprometidas };
}

describe("bandaDe", () => {
  test("cortes en 85, 70 y 40", () => {
    expect(bandaDe(100)).toBe("excelente");
    expect(bandaDe(85)).toBe("excelente");
    expect(bandaDe(84)).toBe("buena");
    expect(bandaDe(70)).toBe("buena");
    expect(bandaDe(69)).toBe("regular");
    expect(bandaDe(40)).toBe("regular");
    expect(bandaDe(39)).toBe("critica");
  });
});

describe("un mes ordenado saca 100", () => {
  const s = calcularSalud(entrada({ gastos: [gasto("2026-10-05", 800_000)] }));

  test("todos los factores completos", () => {
    expect(s.puntaje).toBe(100);
    expect(s.banda).toBe("excelente");
  });

  test("sin presupuestos, ese factor no aplica en vez de valer cero", () => {
    expect(s.factores.map((f) => f.clave)).toEqual(["ahorro", "cuentas", "deuda", "ritmo"]);
  });

  test("la recomendacion felicita", () => {
    expect(s.recomendacion?.titulo).toMatch(/muy bien/);
  });
});

describe("cada factor", () => {
  test("ahorro: la mitad de la meta da la mitad de los puntos", () => {
    // Sueldo 2.000.000, queda libre 200.000 = 10%: la mitad de la meta del 20%.
    const s = calcularSalud(entrada({ gastos: [gasto("2026-10-05", 1_800_000)] }));
    expect(s.factores.find((f) => f.clave === "ahorro")?.puntos).toBe(15);
  });

  test("ahorro: lo que falta pagar tambien cuenta, porque ya esta comprometido", () => {
    const s = calcularSalud(
      entrada({ gastos: [gasto("2026-10-05", 1_600_000)], cuentas: [cuenta({ monto: 200_000 })] }),
    );
    expect(s.factores.find((f) => f.clave === "ahorro")?.puntos).toBe(15);
  });

  test("presupuestos: proporcional a los que van dentro del techo", () => {
    const s = calcularSalud(
      entrada({
        gastos: [gasto("2026-10-05", 100_000), gasto("2026-10-06", 60_000, CAFE)],
        techos: [techo(SUPER, 200_000), techo(CAFE, 50_000)],
      }),
    );
    const f = s.factores.find((x) => x.clave === "presupuestos");
    expect(f?.puntos).toBe(13); // 1 de 2: 12,5 redondea a 13
    expect(f?.detalle).toMatch(/1 de 2/);
  });

  test("cuentas: cada vencida resta 10 y no baja de cero", () => {
    const una = calcularSalud(entrada({ cuentas: [cuenta({ diaVencimiento: 20 })] }));
    expect(una.factores.find((f) => f.clave === "cuentas")?.puntos).toBe(10);
    const tres = calcularSalud(
      entrada({ cuentas: [20, 21, 22].map((dia) => cuenta({ diaVencimiento: dia })) }),
    );
    expect(tres.factores.find((f) => f.clave === "cuentas")?.puntos).toBe(0);
  });

  test("deuda: completo bajo 25% del sueldo, cero desde 40%", () => {
    const sana = calcularSalud(entrada({ deudas: [deuda(400_000)] })); // 20%
    expect(sana.factores.find((f) => f.clave === "deuda")?.puntos).toBe(15);
    const media = calcularSalud(entrada({ deudas: [deuda(650_000)] })); // 32,5%
    expect(media.factores.find((f) => f.clave === "deuda")?.puntos).toBe(8);
    const pesada = calcularSalud(entrada({ deudas: [deuda(800_000)] })); // 40%
    expect(pesada.factores.find((f) => f.clave === "deuda")?.puntos).toBe(0);
  });

  test("ritmo: gastar mas rapido de lo que pasa el mes resta", () => {
    // Dia 10 de 31 (32%) con 50% del sueldo gastado: va 1,55 veces mas rapido.
    const s = calcularSalud(entrada({ hoy: "2026-10-10", gastos: [gasto("2026-10-05", 1_000_000)] }));
    expect(s.factores.find((f) => f.clave === "ritmo")?.puntos).toBe(0);
  });

  test("ritmo: en un mes cerrado no aplica", () => {
    const s = calcularSalud(entrada({ mes: "2026-09", hoy: "2026-10-29" }));
    expect(s.factores.some((f) => f.clave === "ritmo")).toBe(false);
  });
});

describe("la recomendacion", () => {
  test("primero las cuentas vencidas, con el puntaje que tendrias al pagarlas", () => {
    const e = entrada({
      gastos: [gasto("2026-10-05", 800_000)],
      cuentas: [cuenta({ diaVencimiento: 20, monto: 18_630 }), cuenta({ diaVencimiento: 25, monto: 41_200 })],
    });
    const s = calcularSalud(e);
    // Ahorro 30 + cuentas 0 + deuda 15 + ritmo 10 = 55 de 75.
    expect(s.puntaje).toBe(73);
    expect(s.recomendacion?.titulo).toBe("Paga tus 2 cuentas vencidas");
    expect(s.recomendacion?.texto).toMatch(/de 73 a 100 puntos/);
    expect(s.recomendacion?.destino).toBe("#pagos");
  });

  test("despues, el presupuesto que mas se paso", () => {
    const s = calcularSalud(
      entrada({
        gastos: [gasto("2026-10-05", 260_000), gasto("2026-10-06", 70_000, CAFE)],
        techos: [techo(SUPER, 200_000), techo(CAFE, 50_000)],
      }),
    );
    expect(s.recomendacion?.titulo).toBe("Supermercado pasó su presupuesto");
    expect(s.recomendacion?.destino).toBe("#presupuestos");
  });

  test("despues, lo que vence esta semana", () => {
    const s = calcularSalud(entrada({ cuentas: [cuenta({ diaVencimiento: 31 })] }));
    expect(s.recomendacion?.titulo).toMatch(/vence esta semana/);
  });

  test("despues, cuanto falta para la meta de ahorro", () => {
    const s = calcularSalud(entrada({ gastos: [gasto("2026-10-05", 1_800_000)] }));
    expect(s.recomendacion?.titulo).toMatch(/Te faltan \$200\.000 para la meta/);
  });
});

describe("sin sueldo", () => {
  test("no hay puntaje: sin sueldo no se puede medir ahorro ni carga", () => {
    const e = entrada({ sueldo: null, gastos: [gasto("2026-10-05", 10_000)] });
    expect(calcularSalud(e)).toEqual({ puntaje: null, banda: null, factores: [], recomendacion: null });
    expect(puntajeDeSalud(e)).toBeNull();
  });
});
