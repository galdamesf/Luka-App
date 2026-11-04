import { describe, expect, test } from "vitest";
import { periodoDe } from "@/lib/periodo";
import { resumirMes } from "@/dominio/resumen";
import { armarPresupuestos, detalleDeCategoria } from "@/dominio/presupuestos";
import { ritmoSemanal } from "@/dominio/semanas";
import { fechaDeVencimiento, resumirCuentas, agruparPendientes, type CuentaPlana } from "@/dominio/cuentas";
import { armarResumenPanel } from "@/dominio/panel";
import { calcularBalance } from "@/dominio/balance";
import { porSemana, compararConMesAnterior } from "@/dominio/informe";
import { armarReporteSemanal } from "@/dominio/reporte-semanal";
import { armarSerie } from "@/dominio/historico";
import type { GastoPlano } from "@/dominio/resumen";

/**
 * Los calculos con un mes que empieza el dia 27: noviembre va del 27 de
 * octubre al 26 de noviembre. Los tests de cada modulo ya cubren el mes
 * calendario; aca se prueba que el corte se mueve con el dia de inicio.
 */

const CAFE = { id: "c1", nombre: "Café", color: "#c38409", icono: "coffee", esencial: false };
const LUZ = { id: "c2", nombre: "Cuentas", color: "#009993", icono: "zap", esencial: true };

let n = 0;
const gasto = (fecha: string, monto: number, categoria = CAFE): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota: null, categoria,
});

const NOVIEMBRE = periodoDe("2026-11", 27);
const HOY = "2026-11-02";
// Del 26 de octubre (periodo de octubre) al 27 de noviembre (diciembre): solo los del medio son de noviembre.
const gastos = [
  gasto("2026-10-26", 99_000),
  gasto("2026-10-27", 10_000),
  gasto("2026-10-31", 20_000),
  gasto("2026-11-02", 5_000, LUZ),
  gasto("2026-11-26", 7_000),
  gasto("2026-11-27", 88_000),
];

describe("resumirMes con dia 27", () => {
  const r = resumirMes(gastos, NOVIEMBRE, new Date("2026-11-02T15:00:00Z"));

  test("cuenta los gastos del 27 de octubre al 26 de noviembre, nada mas", () => {
    expect(r.mes).toBe("2026-11");
    expect(r.total).toBe(10_000 + 20_000 + 5_000 + 7_000);
    expect(r.cantidad).toBe(4);
  });

  test("el 2 de noviembre es el septimo dia del mes en curso", () => {
    expect(r.mesEnCurso).toBe(true);
    expect(r.diasConsiderados).toBe(7);
  });
});

describe("presupuestos con dia 27", () => {
  test("lo gastado sale del periodo, y el presupuesto es el de noviembre", () => {
    const r = armarPresupuestos(
      [{ id: "p1", categoria: CAFE, mes: "2026-11", monto: 50_000, creadoEn: "2026-10-27" }],
      gastos,
      NOVIEMBRE,
    );
    expect(r.lineas[0]?.gastado).toBe(10_000 + 20_000 + 7_000);
  });

  test("el desglose por semana parte el 27", () => {
    const d = detalleDeCategoria(gastos, CAFE.id, NOVIEMBRE);
    expect(d.semanas.map((s) => [s.fechaDesde, s.fechaHasta, s.total])).toEqual([
      ["2026-10-27", "2026-11-02", 30_000],
      ["2026-11-03", "2026-11-09", 0],
      ["2026-11-10", "2026-11-16", 0],
      ["2026-11-17", "2026-11-23", 0],
      ["2026-11-24", "2026-11-26", 7_000],
    ]);
  });
});

describe("ritmoSemanal con dia 27", () => {
  const r = ritmoSemanal(gastos, NOVIEMBRE, HOY);

  test("la semana 1 va del 27 de octubre al 2 de noviembre y es la en curso", () => {
    expect(r.semanas[0]).toMatchObject({ fechaDesde: "2026-10-27", fechaHasta: "2026-11-02", enCurso: true, total: 35_000 });
    expect(r.semanas[0]?.diasTranscurridos).toBe(7);
    expect(r.semanas[1]?.diasTranscurridos).toBe(0);
    expect(r.semanaInicial).toBe(1);
  });

  test("el promedio diario divide lo del periodo por los 7 dias que van", () => {
    expect(r.promedioDiario).toBeCloseTo(42_000 / 7, 9);
  });
});

describe("cuentas con dia 27", () => {
  const cuenta = (nombre: string, diaVencimiento: number, pagadaEn: string | null = null): CuentaPlana => ({
    id: nombre, nombre, monto: 10_000, mes: "2026-11", diaVencimiento, categoria: LUZ, pagadaEn,
    gastoId: null, mensual: true, boletaArchivo: null, nota: null,
  });

  test("una cuenta de noviembre que vence el 5 vence el 5 de noviembre, y la del 30, el 30 de octubre", () => {
    expect(fechaDeVencimiento(cuenta("Luz", 5), 27)).toBe("2026-11-05");
    expect(fechaDeVencimiento(cuenta("Gas", 30), 27)).toBe("2026-10-30");
  });

  test("vencidas, por vencer y el orden van por fecha real, no por numero de dia", () => {
    const r = resumirCuentas([cuenta("Luz", 5), cuenta("Gas", 30), cuenta("Agua", 20)], NOVIEMBRE, HOY);
    expect(r.pendientes.map((c) => c.nombre)).toEqual(["Gas", "Luz", "Agua"]);
    expect(r.vencidas.map((c) => c.nombre)).toEqual(["Gas"]);
    const g = agruparPendientes(r, HOY);
    expect(g.porVencer.map((c) => c.nombre)).toEqual(["Luz"]);
    expect(g.programadas.map((c) => c.nombre)).toEqual(["Agua"]);
  });
});

describe("panel con dia 27", () => {
  const resumen = resumirMes(gastos, NOVIEMBRE, new Date("2026-11-02T15:00:00Z"));
  const balance = calcularBalance({ mes: "2026-11", sueldo: 1_000_000, resumen, deudas: [], pagos: [] });
  const panel = armarResumenPanel({
    mes: NOVIEMBRE,
    hoy: HOY,
    balance,
    resumen,
    cuentas: resumirCuentas([], NOVIEMBRE, HOY),
    // Octubre (27 sep - 26 oct): 4.000 en sus primeros 7 dias y 50.000 despues.
    gastosMesAnterior: [gasto("2026-09-27", 1_000), gasto("2026-10-03", 3_000), gasto("2026-10-10", 50_000)],
  });

  test("quedan 25 dias, contando hoy, y hoy es el dia 7", () => {
    expect(panel.barra.diaDeHoy).toBe(7);
    expect(panel.barra.diasRestantes).toBe(25);
    expect(panel.barra.fechaDeHoy).toBe(HOY);
    expect(panel.periodo).toEqual(NOVIEMBRE);
  });

  test("se compara con los primeros 7 dias del periodo anterior", () => {
    expect(panel.diaComparado).toBe(7);
    // Hasta hoy van 42.000 (sin cuotas) contra 4.000.
    expect(panel.variacion).toBeCloseTo(((42_000 - 4_000) / 4_000) * 100, 9);
  });
});

describe("informe, reporte y serie con dia 27", () => {
  test("las semanas del informe tienen sus fechas", () => {
    const s = porSemana(gastos, NOVIEMBRE);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ fechaDesde: "2026-10-27", fechaHasta: "2026-11-02", total: 35_000, cantidad: 3 });
  });

  test("la comparacion es contra el periodo anterior, no contra el mes calendario", () => {
    const c = compararConMesAnterior(gastos, [gasto("2026-10-26", 99_000), gasto("2026-10-01", 1_000)], NOVIEMBRE, new Date("2026-11-02T15:00:00Z"));
    expect(c.mesAnterior).toBe("2026-10");
    expect(c.totalAnterior).toBe(100_000);
  });

  test("el reporte de la semana 1 de noviembre cruza de octubre a noviembre", () => {
    const r = armarReporteSemanal(gastos, NOVIEMBRE, 1, HOY);
    expect(r).toMatchObject({ mes: "2026-11", fechaDesde: "2026-10-27", fechaHasta: "2026-11-02", total: 35_000 });
    expect(r?.dias.map((d) => d.fecha)).toEqual([
      "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
    ]);
  });

  test("la serie historica suma cada gasto en el periodo de su fecha", () => {
    const filas = gastos.map((g) => ({ fecha: new Date(`${g.fecha}T00:00:00Z`), monto: g.monto }));
    const serie = armarSerie("2026-12", 3, filas, [], 27);
    expect(serie.map((p) => [p.mes, p.gastos])).toEqual([
      ["2026-10", 99_000],
      ["2026-11", 42_000],
      ["2026-12", 88_000],
    ]);
  });
});
