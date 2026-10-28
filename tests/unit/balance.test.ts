import { describe, expect, test } from "vitest";
import {
  calcularBalance,
  cuotaEnMes,
  saldoDesde,
  sueldoVigente,
  ultimoMesDe,
  type DeudaPlana,
} from "@/dominio/balance";
import { resumirMes, type GastoPlano } from "@/dominio/resumen";

const ESENCIAL = { id: "c1", nombre: "Arriendo", color: "#0d9488", icono: "house", esencial: true };
const DISCRECIONAL = { id: "c2", nombre: "Restaurantes", color: "#ea580c", icono: "utensils", esencial: false };

let n = 0;
const gasto = (fecha: string, monto: number, categoria = ESENCIAL): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto,
  medioPago: "DEBITO", notas: null, boletaArchivo: null,
  cuota: null, categoria,
});

const NOVIEMBRE = new Date("2026-11-15T12:00:00.000Z");

function deuda(cambios: Partial<DeudaPlana> = {}): DeudaPlana {
  return {
    id: "d1",
    nombre: "Crédito de consumo",
    montoCuota: 85000,
    cuotasTotales: 12,
    primeraCuota: "2026-08",
    activa: true,
    ...cambios,
  };
}

describe("ultimoMesDe", () => {
  test("doce cuotas desde agosto terminan en julio del año siguiente", () => {
    expect(ultimoMesDe(deuda())).toBe("2027-07");
  });

  test("una sola cuota empieza y termina el mismo mes", () => {
    expect(ultimoMesDe(deuda({ cuotasTotales: 1 }))).toBe("2026-08");
  });

  test("veinticuatro cuotas cruzan dos años", () => {
    expect(ultimoMesDe(deuda({ cuotasTotales: 24 }))).toBe("2028-07");
  });
});

describe("cuotaEnMes", () => {
  test("el mes de partida es la cuota 1", () => {
    const c = cuotaEnMes(deuda(), "2026-08");
    expect(c?.numero).toBe(1);
    expect(c?.restantes).toBe(11);
    expect(c?.saldoPendiente).toBe(11 * 85000);
  });

  test("tres meses después va en la cuota 4", () => {
    const c = cuotaEnMes(deuda(), "2026-11");
    expect(c?.numero).toBe(4);
    expect(c?.restantes).toBe(8);
  });

  test("la última cuota no deja restantes", () => {
    const c = cuotaEnMes(deuda(), "2027-07");
    expect(c?.numero).toBe(12);
    expect(c?.restantes).toBe(0);
    expect(c?.saldoPendiente).toBe(0);
  });

  test("antes de empezar no hay cuota", () => {
    expect(cuotaEnMes(deuda(), "2026-07")).toBeNull();
    expect(cuotaEnMes(deuda(), "2025-12")).toBeNull();
  });

  test("después de terminar no hay cuota", () => {
    expect(cuotaEnMes(deuda(), "2027-08")).toBeNull();
    expect(cuotaEnMes(deuda(), "2030-01")).toBeNull();
  });

  test("una deuda marcada inactiva no cobra aunque esté en rango", () => {
    expect(cuotaEnMes(deuda({ activa: false }), "2026-11")).toBeNull();
  });

  test("cruza el fin de año sin perder la cuenta", () => {
    expect(cuotaEnMes(deuda(), "2026-12")?.numero).toBe(5);
    expect(cuotaEnMes(deuda(), "2027-01")?.numero).toBe(6);
  });

  test("informa el último mes para poder decir cuándo se acaba", () => {
    expect(cuotaEnMes(deuda(), "2026-11")?.ultimoMes).toBe("2027-07");
  });
});

describe("saldoDesde", () => {
  test("antes de partir se debe el total", () => {
    expect(saldoDesde(deuda(), "2026-07")).toBe(12 * 85000);
  });

  test("en la primera cuota todavía se debe todo", () => {
    expect(saldoDesde(deuda(), "2026-08")).toBe(12 * 85000);
  });

  test("va bajando cuota a cuota", () => {
    expect(saldoDesde(deuda(), "2026-11")).toBe(9 * 85000);
  });

  test("terminada no se debe nada", () => {
    expect(saldoDesde(deuda(), "2027-08")).toBe(0);
    expect(saldoDesde(deuda(), "2030-01")).toBe(0);
  });

  test("una deuda inactiva no debe nada", () => {
    expect(saldoDesde(deuda({ activa: false }), "2026-11")).toBe(0);
  });
});

describe("saldoDesde vs saldoPendiente: la diferencia es la cuota de este mes", () => {
  test("saldoDesde cuenta la cuota del mes en curso, que aún no se paga", () => {
    const d = deuda({ primeraCuota: "2026-08", cuotasTotales: 12, montoCuota: 85000 });
    const c = cuotaEnMes(d, "2026-11");

    expect(c?.numero).toBe(4);
    // Quedan 9 por pagar contando la de este mes; 8 si no se cuenta.
    expect(saldoDesde(d, "2026-11")).toBe(9 * 85000);
    expect(c?.saldoPendiente).toBe(8 * 85000);
    expect(saldoDesde(d, "2026-11") - (c?.saldoPendiente ?? 0)).toBe(d.montoCuota);
  });

  test("REGRESIÓN: la suma por deuda cuadra con el total que se muestra arriba", () => {
    // La pantalla muestra un total de deuda arriba y un "faltan" por fila.
    // Si usaran cuentas distintas, las filas no sumarían el total y el numero
    // se veria roto. Las dos tienen que ser saldoDesde.
    const deudas = [
      deuda({ id: "d1", montoCuota: 118000, cuotasTotales: 24, primeraCuota: "2025-11" }),
      deuda({ id: "d2", montoCuota: 54990, cuotasTotales: 12, primeraCuota: "2026-06" }),
      deuda({ id: "d3", montoCuota: 45000, cuotasTotales: 6, primeraCuota: "2026-09" }),
    ];
    const mes = "2026-10";

    const porFila = deudas.map((d) => saldoDesde(d, mes));
    expect(porFila).toEqual([13 * 118000, 8 * 54990, 5 * 45000]);

    const total = porFila.reduce((a, b) => a + b, 0);
    expect(total).toBe(2_198_920);
  });

  test("las deudas inactivas no entran en el total", () => {
    const total = [
      deuda({ id: "a", montoCuota: 50000, cuotasTotales: 10, primeraCuota: "2026-10" }),
      deuda({ id: "b", montoCuota: 99999, cuotasTotales: 10, primeraCuota: "2026-10", activa: false }),
    ].reduce((s, d) => s + saldoDesde(d, "2026-10"), 0);

    expect(total).toBe(10 * 50000);
  });
});

describe("calcularBalance", () => {
  const resumen = resumirMes(
    [gasto("2026-10-01", 450000), gasto("2026-10-10", 120000), gasto("2026-10-15", 80000, DISCRECIONAL)],
    "2026-10",
    NOVIEMBRE,
  );

  test("la secuencia descuenta básicos y cuotas PAGADAS del sueldo", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [deuda({ id: "d1", primeraCuota: "2026-08" })],
      pagos: [{ deudaId: "d1", mes: "2026-10", pagadaEn: "2026-10-05", monto: 85000 }],
    });

    expect(b.sueldo).toBe(1200000);
    expect(b.gastosBasicos).toBe(570000);
    expect(b.cuotas).toBe(85000);
    expect(b.disponible).toBe(1200000 - 570000 - 85000);
    expect(b.gastosDiscrecionales).toBe(80000);
    expect(b.saldo).toBe(1200000 - 570000 - 85000 - 80000);
    expect(b.enRojo).toBe(false);
  });

  /**
   * El cambio de criterio: antes toda cuota del mes se descontaba estuviera
   * pagada o no. Ahora el disponible solo baja cuando se confirma el pago,
   * porque hasta ese momento esa plata sigue en la cuenta.
   */
  test("una cuota sin pagar NO baja el disponible, pero se muestra aparte", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [deuda({ id: "d1", primeraCuota: "2026-08" })],
    });

    expect(b.cuotas).toBe(0);
    expect(b.cuotasPorPagar).toBe(85000);
    expect(b.cuotasComprometidas).toBe(85000);
    expect(b.disponible).toBe(1200000 - 570000);
    expect(b.cuotasDelMes[0]!.pagada).toBe(false);
  });

  test("se descuenta el monto REAL pagado, no el pactado", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [deuda({ id: "d1", primeraCuota: "2026-08" })],
      // Llegó con interés: 92.000 en vez de los 85.000 pactados.
      pagos: [{ deudaId: "d1", mes: "2026-10", pagadaEn: "2026-10-05", monto: 92000 }],
    });

    expect(b.cuotas).toBe(92000);
    expect(b.cuotasComprometidas).toBe(85000);
    expect(b.cuotasPorPagar).toBe(0);
    expect(b.cuotasDelMes[0]!.montoPagado).toBe(92000);
    expect(b.cuotasDelMes[0]!.pagadaEn).toBe("2026-10-05");
  });

  test("un pago de otro mes no cuenta en este", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [deuda({ id: "d1", primeraCuota: "2026-08" })],
      pagos: [{ deudaId: "d1", mes: "2026-09", pagadaEn: "2026-09-05", monto: 85000 }],
    });

    expect(b.cuotas).toBe(0);
    expect(b.cuotasDelMes[0]!.pagada).toBe(false);
  });

  test("un pago repetido de la misma deuda no se suma dos veces", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [deuda({ id: "d1", primeraCuota: "2026-08" })],
      pagos: [
        { deudaId: "d1", mes: "2026-10", pagadaEn: "2026-10-05", monto: 85000 },
        { deudaId: "d1", mes: "2026-10", pagadaEn: "2026-10-06", monto: 85000 },
      ],
    });

    expect(b.cuotas).toBe(85000);
  });

  test("suma varias deudas vigentes y deja fuera las que no", () => {
    const b = calcularBalance({
      mes: "2026-10",
      sueldo: 1200000,
      resumen,
      deudas: [
        deuda({ id: "d1", nombre: "Crédito", montoCuota: 85000, primeraCuota: "2026-08" }),
        deuda({ id: "d2", nombre: "Notebook", montoCuota: 45000, primeraCuota: "2026-10", cuotasTotales: 6 }),
        deuda({ id: "d3", nombre: "Terminada", montoCuota: 999999, primeraCuota: "2025-01", cuotasTotales: 3 }),
        deuda({ id: "d4", nombre: "Futura", montoCuota: 777777, primeraCuota: "2027-01", cuotasTotales: 6 }),
      ],
    });

    expect(b.cuotasDelMes).toHaveLength(2);
    // Ninguna pagada todavia: comprometido 130.000, descontado 0.
    expect(b.cuotasComprometidas).toBe(130000);
    expect(b.cuotas).toBe(0);
    expect(b.cuotasPorPagar).toBe(130000);
    expect(b.cuotasDelMes.map((c) => c.deuda.nombre)).toEqual(["Crédito", "Notebook"]);
  });

  test("ordena las cuotas de mayor a menor", () => {
    const b = calcularBalance({
      mes: "2026-10", sueldo: 1000000, resumen,
      deudas: [
        deuda({ id: "a", nombre: "Chica", montoCuota: 20000, primeraCuota: "2026-10" }),
        deuda({ id: "b", nombre: "Grande", montoCuota: 200000, primeraCuota: "2026-10" }),
      ],
    });
    expect(b.cuotasDelMes.map((c) => c.deuda.nombre)).toEqual(["Grande", "Chica"]);
  });

  test("a igual cuota ordena por nombre, para que no baile entre recargas", () => {
    const b = calcularBalance({
      mes: "2026-10", sueldo: 1000000, resumen,
      deudas: [
        deuda({ id: "a", nombre: "Zapatos", montoCuota: 50000, primeraCuota: "2026-10" }),
        deuda({ id: "b", nombre: "Auto", montoCuota: 50000, primeraCuota: "2026-10" }),
      ],
    });
    expect(b.cuotasDelMes.map((c) => c.deuda.nombre)).toEqual(["Auto", "Zapatos"]);
  });

  test("marca el rojo cuando se gastó más de lo que entró", () => {
    const b = calcularBalance({
      mes: "2026-10", sueldo: 600000, resumen, deudas: [deuda()],
    });
    expect(b.saldo).toBeLessThan(0);
    expect(b.enRojo).toBe(true);
  });

  test("sin sueldo definido lo señala en vez de asumir cero en silencio", () => {
    const b = calcularBalance({ mes: "2026-10", sueldo: null, resumen, deudas: [] });
    expect(b.sinSueldo).toBe(true);
    expect(b.sueldo).toBe(0);
    expect(b.porcentajeComprometido).toBe(0);
  });

  test("sueldo definido en cero no es lo mismo que sin sueldo", () => {
    const b = calcularBalance({ mes: "2026-10", sueldo: 0, resumen, deudas: [] });
    expect(b.sinSueldo).toBe(false);
  });

  test("calcula qué parte del sueldo está comprometida antes de gastar nada", () => {
    const b = calcularBalance({
      mes: "2026-10", sueldo: 1000000, resumen,
      deudas: [deuda({ montoCuota: 130000, primeraCuota: "2026-10" })],
    });
    // 570.000 de básicos + 130.000 de cuota sobre 1.000.000.
    expect(b.porcentajeComprometido).toBeCloseTo(70, 6);
  });

  test("un mes sin gastos ni deudas deja el sueldo entero", () => {
    const vacio = resumirMes([], "2026-10", NOVIEMBRE);
    const b = calcularBalance({ mes: "2026-10", sueldo: 1200000, resumen: vacio, deudas: [] });
    expect(b.disponible).toBe(1200000);
    expect(b.saldo).toBe(1200000);
    expect(b.enRojo).toBe(false);
  });
});

describe("sueldoVigente", () => {
  const sueldos = [
    { monto: 900000, vigenteDesde: "2026-01" },
    { monto: 1200000, vigenteDesde: "2026-06" },
    { monto: 1350000, vigenteDesde: "2027-01" },
  ];

  test("toma el más reciente que ya esté rigiendo", () => {
    expect(sueldoVigente(sueldos, "2026-03")).toBe(900000);
    expect(sueldoVigente(sueldos, "2026-06")).toBe(1200000);
    expect(sueldoVigente(sueldos, "2026-12")).toBe(1200000);
    expect(sueldoVigente(sueldos, "2027-05")).toBe(1350000);
  });

  test("un aumento no reescribe los meses anteriores", () => {
    // El historial de febrero sigue mostrando el sueldo viejo.
    expect(sueldoVigente(sueldos, "2026-02")).toBe(900000);
  });

  test("antes del primer sueldo registrado no hay sueldo", () => {
    expect(sueldoVigente(sueldos, "2025-12")).toBeNull();
  });

  test("sin ningún sueldo cargado devuelve null", () => {
    expect(sueldoVigente([], "2026-10")).toBeNull();
  });

  test("no depende del orden en que vengan", () => {
    const desordenados = [sueldos[2]!, sueldos[0]!, sueldos[1]!];
    expect(sueldoVigente(desordenados, "2026-12")).toBe(1200000);
  });
});
