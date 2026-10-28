import { describe, expect, test } from "vitest";
import {
  armarInforme,
  compararConMesAnterior,
  mayoresGastos,
  porMedioDePago,
  porSemana,
} from "@/dominio/informe";
import type { GastoPlano } from "@/dominio/resumen";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#16a34a", icono: "shopping-cart", esencial: true };
const RESTO = { id: "c2", nombre: "Restaurantes", color: "#ea580c", icono: "utensils", esencial: false };
const ARRIENDO = { id: "c3", nombre: "Arriendo", color: "#0d9488", icono: "house", esencial: true };

let n = 0;
const g = (
  fecha: string, monto: number, categoria = SUPER, medioPago: GastoPlano["medioPago"] = "DEBITO",
): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto,
  medioPago, notas: null, boletaArchivo: null,
  cuota: null, categoria,
});

const NOVIEMBRE = new Date("2026-11-15T12:00:00.000Z");

describe("compararConMesAnterior", () => {
  test("calcula diferencia y variacion por categoria", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 120000, SUPER)],
      [g("2026-09-05", 100000, SUPER)],
      "2026-10", NOVIEMBRE,
    );
    const linea = c.lineas[0];
    expect(linea?.actual).toBe(120000);
    expect(linea?.anterior).toBe(100000);
    expect(linea?.diferencia).toBe(20000);
    expect(linea?.variacion).toBeCloseTo(20, 6);
  });

  test("marca como nueva la categoria que no existia antes", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 50000, RESTO)],
      [g("2026-09-05", 100000, SUPER)],
      "2026-10", NOVIEMBRE,
    );
    const resto = c.lineas.find((l) => l.categoria.id === "c2");
    expect(resto?.nueva).toBe(true);
    expect(resto?.variacion).toBeNull();
  });

  test("marca como desaparecida la que estaba y ya no", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 50000, RESTO)],
      [g("2026-09-05", 100000, SUPER)],
      "2026-10", NOVIEMBRE,
    );
    const sup = c.lineas.find((l) => l.categoria.id === "c1");
    expect(sup?.desaparecida).toBe(true);
    expect(sup?.actual).toBe(0);
    expect(sup?.anterior).toBe(100000);
  });

  test("no divide por cero: sin mes anterior la variacion es null", () => {
    const c = compararConMesAnterior([g("2026-10-05", 50000)], [], "2026-10", NOVIEMBRE);
    expect(c.variacion).toBeNull();
    expect(c.hayAnterior).toBe(false);
    expect(Number.isNaN(c.variacion as unknown as number)).toBe(false);
  });

  test("ordena del mayor aumento a la mayor baja", () => {
    const c = compararConMesAnterior(
      [g("2026-10-01", 200000, SUPER), g("2026-10-02", 10000, RESTO)],
      [g("2026-09-01", 100000, SUPER), g("2026-09-02", 90000, RESTO)],
      "2026-10", NOVIEMBRE,
    );
    expect(c.lineas.map((l) => l.categoria.nombre)).toEqual(["Supermercado", "Restaurantes"]);
    expect(c.lineas[0]?.diferencia).toBe(100000);
    expect(c.lineas[1]?.diferencia).toBe(-80000);
  });

  test("una baja da variacion negativa", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 50000, SUPER)],
      [g("2026-09-05", 100000, SUPER)],
      "2026-10", NOVIEMBRE,
    );
    expect(c.lineas[0]?.variacion).toBeCloseTo(-50, 6);
  });

  test("gastar lo mismo da diferencia cero", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 100000, SUPER)],
      [g("2026-09-05", 100000, SUPER)],
      "2026-10", NOVIEMBRE,
    );
    expect(c.diferencia).toBe(0);
    expect(c.variacion).toBeCloseTo(0, 6);
  });

  test("ignora gastos que caen fuera de cada mes", () => {
    const c = compararConMesAnterior(
      [g("2026-10-05", 50000), g("2026-11-01", 999999)],
      [g("2026-09-05", 40000), g("2026-08-01", 888888)],
      "2026-10", NOVIEMBRE,
    );
    expect(c.totalActual).toBe(50000);
    expect(c.totalAnterior).toBe(40000);
  });

  test("calcula bien el mes anterior cruzando el anio", () => {
    const c = compararConMesAnterior([], [], "2027-01", NOVIEMBRE);
    expect(c.mesAnterior).toBe("2026-12");
  });
});

describe("porMedioDePago", () => {
  test("agrupa y ordena de mayor a menor", () => {
    const m = porMedioDePago(
      [
        g("2026-10-01", 50000, SUPER, "DEBITO"),
        g("2026-10-02", 30000, SUPER, "DEBITO"),
        g("2026-10-03", 100000, RESTO, "CREDITO"),
        g("2026-10-04", 5000, RESTO, "EFECTIVO"),
      ],
      "2026-10",
    );
    expect(m.map((l) => l.medio)).toEqual(["CREDITO", "DEBITO", "EFECTIVO"]);
    expect(m[0]?.total).toBe(100000);
    expect(m[1]?.total).toBe(80000);
    expect(m[1]?.cantidad).toBe(2);
  });

  test("los porcentajes suman 100", () => {
    const m = porMedioDePago(
      [g("2026-10-01", 60000, SUPER, "DEBITO"), g("2026-10-02", 40000, RESTO, "CREDITO")],
      "2026-10",
    );
    expect(m.reduce((s, l) => s + l.porcentaje, 0)).toBeCloseTo(100, 10);
  });

  test("sin gastos devuelve lista vacia, no NaN", () => {
    expect(porMedioDePago([], "2026-10")).toEqual([]);
  });
});

describe("porSemana", () => {
  test("octubre se reparte en cinco bloques de siete dias", () => {
    const s = porSemana([], "2026-10");
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ semana: 1, desde: 1, hasta: 7 });
    expect(s[3]).toMatchObject({ semana: 4, desde: 22, hasta: 28 });
    // El ultimo bloque se corta en el ultimo dia del mes.
    expect(s[4]).toMatchObject({ semana: 5, desde: 29, hasta: 31 });
  });

  test("febrero no bisiesto termina justo en el dia 28", () => {
    const s = porSemana([], "2026-02");
    expect(s).toHaveLength(4);
    expect(s[3]).toMatchObject({ desde: 22, hasta: 28 });
  });

  test("febrero bisiesto agrega un bloque de un dia", () => {
    const s = porSemana([], "2028-02");
    expect(s).toHaveLength(5);
    expect(s[4]).toMatchObject({ desde: 29, hasta: 29 });
  });

  test("cada gasto cae en su bloque", () => {
    const s = porSemana(
      [
        g("2026-10-01", 1000), g("2026-10-07", 2000),
        g("2026-10-08", 4000), g("2026-10-15", 8000),
        g("2026-10-31", 16000),
      ],
      "2026-10",
    );
    expect(s[0]?.total).toBe(3000);
    expect(s[1]?.total).toBe(4000);
    expect(s[2]?.total).toBe(8000);
    expect(s[4]?.total).toBe(16000);
  });

  test("la suma de las semanas da el total del mes", () => {
    const gastos = [g("2026-10-03", 10000), g("2026-10-12", 20000), g("2026-10-28", 30000)];
    const s = porSemana(gastos, "2026-10");
    expect(s.reduce((a, b) => a + b.total, 0)).toBe(60000);
  });

  test("un mes sin gastos da todas las semanas en cero, no vacio", () => {
    const s = porSemana([], "2026-10");
    expect(s.every((x) => x.total === 0 && x.cantidad === 0)).toBe(true);
  });
});

describe("mayoresGastos", () => {
  test("trae los mas caros de mayor a menor", () => {
    const m = mayoresGastos(
      [g("2026-10-01", 5000), g("2026-10-02", 90000), g("2026-10-03", 30000)],
      "2026-10",
    );
    expect(m.map((x) => x.monto)).toEqual([90000, 30000, 5000]);
  });

  test("respeta el limite pedido", () => {
    const gastos = Array.from({ length: 10 }, (_, i) => g("2026-10-01", (i + 1) * 1000));
    expect(mayoresGastos(gastos, "2026-10", 3)).toHaveLength(3);
  });

  test("no trae de otros meses", () => {
    const m = mayoresGastos([g("2026-09-01", 999999), g("2026-10-01", 1000)], "2026-10");
    expect(m).toHaveLength(1);
    expect(m[0]?.monto).toBe(1000);
  });
});

describe("armarInforme", () => {
  test("junta todas las piezas con numeros coherentes entre si", () => {
    const actual = [
      g("2026-10-01", 450000, ARRIENDO, "TRANSFERENCIA"),
      g("2026-10-12", 28900, RESTO, "CREDITO"),
      g("2026-10-19", 64200, SUPER, "DEBITO"),
    ];
    const anterior = [g("2026-09-01", 450000, ARRIENDO), g("2026-09-10", 40000, SUPER)];

    const i = armarInforme(actual, anterior, "2026-10", NOVIEMBRE);

    expect(i.resumen.total).toBe(543100);
    expect(i.comparacion.totalAnterior).toBe(490000);
    expect(i.comparacion.diferencia).toBe(53100);
    // Las tres vistas tienen que sumar lo mismo que el resumen.
    expect(i.medios.reduce((s, m) => s + m.total, 0)).toBe(i.resumen.total);
    expect(i.semanas.reduce((s, w) => s + w.total, 0)).toBe(i.resumen.total);
    expect(i.mayores[0]?.monto).toBe(450000);
  });

  test("un mes vacio no rompe ninguna pieza", () => {
    const i = armarInforme([], [], "2026-10", NOVIEMBRE);
    expect(i.resumen.total).toBe(0);
    expect(i.comparacion.variacion).toBeNull();
    expect(i.medios).toEqual([]);
    expect(i.mayores).toEqual([]);
    expect(i.semanas).toHaveLength(5);
  });
});
