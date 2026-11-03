import { describe, expect, test } from "vitest";
import { armarReporteSemanal } from "@/dominio/reporte-semanal";
import type { GastoPlano } from "@/dominio/resumen";

const ARRIENDO = { id: "c1", nombre: "Arriendo", color: "#009993", icono: "house", esencial: true };
const CAFE = { id: "c2", nombre: "Café", color: "#c38409", icono: "coffee", esencial: false };
const REGALOS = { id: "c3", nombre: "Regalos", color: "#9c5ac9", icono: "gift", esencial: false };
const TRANSPORTE = { id: "c4", nombre: "Transporte", color: "#0963ff", icono: "bus", esencial: true };

let n = 0;
const gasto = (
  fecha: string,
  monto: number,
  categoria = CAFE,
  extra: Partial<GastoPlano> = {},
): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota: null, categoria, ...extra,
});

const gastos = [
  gasto("2026-10-01", 650_000, ARRIENDO, { medioPago: "TRANSFERENCIA" }),
  gasto("2026-10-24", 12_000, CAFE),
  gasto("2026-10-26", 30_000, REGALOS),
  gasto("2026-10-29", 58_388, REGALOS, { medioPago: "CREDITO", boletaArchivo: "a.jpg", notas: "Cumpleaños de la Angelina" }),
  gasto("2026-10-29", 9_350, CAFE),
  gasto("2026-10-30", 8_378, TRANSPORTE, { boletaArchivo: "b.jpg" }),
  gasto("2026-10-30", 158_400, ARRIENDO, { cuota: { deudaId: "d1", deudaNombre: "Crédito de consumo" } }),
  // De otro mes: no entra.
  gasto("2026-09-30", 99_999, CAFE),
];

describe("armarReporteSemanal", () => {
  const r = armarReporteSemanal(gastos, "2026-10", 5, "2026-10-30");
  if (r === null) throw new Error("la semana 5 de octubre existe");

  test("cubre los dias del bloque y dice si va en curso", () => {
    expect(r.fechaDesde).toBe("2026-10-29");
    expect(r.fechaHasta).toBe("2026-10-31");
    expect(r.estado).toBe("en-curso");
    expect(r.diasTranscurridos).toBe(2);
    expect(r.totalDias).toBe(3);
    expect(r.semanasDelMes).toBe(5);
  });

  test("suma la semana sin las cuotas, que van aparte", () => {
    expect(r.total).toBe(58_388 + 9_350 + 8_378);
    expect(r.cantidad).toBe(3);
    expect(r.esenciales).toBe(8_378);
    expect(r.discrecionales).toBe(58_388 + 9_350);
    expect(r.cuotas.map((c) => c.monto)).toEqual([158_400]);
    expect(r.totalCuotas).toBe(158_400);
  });

  test("todos los dias del bloque, con los que vienen marcados", () => {
    expect(r.dias.map((d) => [d.fecha, d.transcurrido, d.total])).toEqual([
      ["2026-10-29", true, 67_738],
      ["2026-10-30", true, 8_378],
      ["2026-10-31", false, 0],
    ]);
    expect(r.dias[0]?.gastos.map((g) => g.monto)).toEqual([58_388, 9_350]);
    expect(r.diaMasAlto).toEqual({ fecha: "2026-10-29", total: 67_738 });
  });

  test("las categorias van de mayor a menor, con su parte y lo de la semana anterior", () => {
    expect(r.categorias.map((c) => [c.categoria.nombre, c.cantidad, c.total, c.anterior])).toEqual([
      ["Regalos", 1, 58_388, 30_000],
      ["Café", 1, 9_350, 12_000],
      ["Transporte", 1, 8_378, 0],
    ]);
    expect(r.categorias.reduce((s, c) => s + c.porcentaje, 0)).toBeCloseTo(100, 9);
  });

  test("los medios de pago, solo los usados", () => {
    expect(r.medios.map((m) => [m.nombre, m.cantidad, m.total])).toEqual([
      ["Crédito", 1, 58_388],
      ["Débito", 2, 17_728],
    ]);
  });

  test("destaca el mayor gasto y cuenta las boletas", () => {
    expect(r.mayorGasto?.monto).toBe(58_388);
    expect(r.conBoleta).toBe(2);
  });

  test("compara con la semana anterior y con el mes", () => {
    expect(r.anterior).toEqual({ semana: 4, total: 42_000, discrecionales: 42_000, diasTranscurridos: 7 });
    expect(r.tendencia).toBeCloseTo(((67_738 / 2 - 42_000 / 7) / (42_000 / 7)) * 100, 6);
    expect(r.totalDelMes).toBe(650_000 + 12_000 + 30_000 + 58_388 + 9_350 + 8_378);
    expect(r.porcentajeDelMes).toBeCloseTo((r.total / r.totalDelMes) * 100, 9);
    expect(r.nivel?.nivel).toBe("muy-alto");
  });

  test("la semana 1 no tiene anterior: las categorias no comparan", () => {
    const s1 = armarReporteSemanal(gastos, "2026-10", 1, "2026-10-30");
    expect(s1?.anterior).toBeNull();
    expect(s1?.categorias[0]?.anterior).toBeNull();
    expect(s1?.estado).toBe("cerrada");
  });

  test("una semana sin gastos sale en cero, sin mayor gasto ni dia mas alto", () => {
    const s2 = armarReporteSemanal(gastos, "2026-10", 2, "2026-10-30");
    expect(s2?.total).toBe(0);
    expect(s2?.mayorGasto).toBeNull();
    expect(s2?.diaMasAlto).toBeNull();
    expect(s2?.dias).toHaveLength(7);
  });

  test("una semana que no existe en el mes da null", () => {
    expect(armarReporteSemanal([], "2027-02", 5, "2027-02-10")).toBeNull();
    expect(armarReporteSemanal([], "2026-10", 0, "2026-10-10")).toBeNull();
  });

  test("en un mes futuro la semana esta por venir", () => {
    expect(armarReporteSemanal([], "2026-12", 1, "2026-10-30")?.estado).toBe("por-venir");
  });
});
