import { describe, expect, test } from "vitest";
import { aPlano, resumenVacio, resumirMes, type GastoPlano } from "@/dominio/resumen";
import { fechaDesdeISO } from "@/lib/fecha";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#15803D", icono: "cart", esencial: true };
const ARRIENDO = { id: "c2", nombre: "Arriendo", color: "#0F766E", icono: "house", esencial: true };
const RESTO = { id: "c3", nombre: "Restaurantes", color: "#C2410C", icono: "utensils", esencial: false };

let contador = 0;
function gasto(fecha: string, monto: number, categoria = SUPER): GastoPlano {
  contador += 1;
  return {
    id: `g${contador}`,
    fecha,
    descripcion: `Gasto ${contador}`,
    monto,
    medioPago: "DEBITO",
    notas: null,
    boletaArchivo: null,
    cuota: null,
    categoria,
  };
}

// Un dia cualquiera de noviembre: asi octubre NO es el mes en curso.
const NOVIEMBRE = new Date("2026-11-15T12:00:00.000Z");

describe("mes sin gastos", () => {
  const r = resumirMes([], "2026-10", NOVIEMBRE);

  test("no divide por cero ni devuelve NaN", () => {
    expect(r.total).toBe(0);
    expect(r.promedioDiario).toBe(0);
    expect(Number.isNaN(r.promedioDiario)).toBe(false);
  });

  test("las colecciones vienen vacias, no indefinidas", () => {
    expect(r.porCategoria).toEqual([]);
    expect(r.cantidad).toBe(0);
    expect(r.diasConGasto).toBe(0);
    expect(r.mayorGasto).toBeNull();
  });

  test("resumenVacio da lo mismo", () => {
    expect(resumenVacio("2026-10", NOVIEMBRE)).toEqual(r);
  });
});

describe("totales", () => {
  const gastos = [
    gasto("2026-10-01", 10000, SUPER),
    gasto("2026-10-15", 20000, SUPER),
    gasto("2026-10-31", 5000, RESTO),
    gasto("2026-10-20", 400000, ARRIENDO),
  ];
  const r = resumirMes(gastos, "2026-10", NOVIEMBRE);

  test("suma todo el mes", () => {
    expect(r.total).toBe(435000);
    expect(r.cantidad).toBe(4);
  });

  test("separa esenciales de discrecionales", () => {
    expect(r.esenciales).toBe(430000);
    expect(r.discrecionales).toBe(5000);
  });

  test("esenciales + discrecionales siempre da el total", () => {
    expect(r.esenciales + r.discrecionales).toBe(r.total);
  });

  test("encuentra el mayor gasto", () => {
    expect(r.mayorGasto?.monto).toBe(400000);
    expect(r.mayorGasto?.categoria.nombre).toBe("Arriendo");
  });

  test("cuenta dias distintos con gasto, no gastos", () => {
    expect(r.diasConGasto).toBe(4);
  });
});

describe("filtrado por mes", () => {
  test("ignora lo que cae fuera del mes pedido", () => {
    const r = resumirMes(
      [
        gasto("2026-09-30", 99999),
        gasto("2026-10-01", 10000),
        gasto("2026-10-31", 5000),
        gasto("2026-11-01", 88888),
      ],
      "2026-10",
      NOVIEMBRE,
    );
    expect(r.total).toBe(15000);
    expect(r.cantidad).toBe(2);
  });

  test("los bordes del mes quedan dentro", () => {
    const r = resumirMes([gasto("2026-10-01", 1), gasto("2026-10-31", 1)], "2026-10", NOVIEMBRE);
    expect(r.cantidad).toBe(2);
  });
});

describe("agrupacion por categoria", () => {
  const gastos = [
    gasto("2026-10-01", 10000, SUPER),
    gasto("2026-10-02", 20000, SUPER),
    gasto("2026-10-03", 70000, RESTO),
  ];
  const r = resumirMes(gastos, "2026-10", NOVIEMBRE);

  test("acumula varios gastos de la misma categoria", () => {
    const sup = r.porCategoria.find((l) => l.categoria.id === "c1");
    expect(sup?.total).toBe(30000);
    expect(sup?.cantidad).toBe(2);
  });

  test("ordena de mayor a menor", () => {
    expect(r.porCategoria.map((l) => l.categoria.nombre)).toEqual(["Restaurantes", "Supermercado"]);
  });

  test("conserva color e icono para los graficos", () => {
    const sup = r.porCategoria.find((l) => l.categoria.id === "c1");
    expect(sup?.categoria.color).toBe("#15803D");
    expect(sup?.categoria.icono).toBe("cart");
  });

  test("los porcentajes suman 100", () => {
    const suma = r.porCategoria.reduce((s, l) => s + l.porcentaje, 0);
    expect(suma).toBeCloseTo(100, 10);
  });

  test("el porcentaje corresponde al monto", () => {
    const resto = r.porCategoria.find((l) => l.categoria.id === "c3");
    expect(resto?.porcentaje).toBeCloseTo(70, 10);
  });

  test("a igual monto ordena por nombre, para que no baile entre recargas", () => {
    const empate = resumirMes(
      [gasto("2026-10-01", 5000, RESTO), gasto("2026-10-02", 5000, ARRIENDO)],
      "2026-10",
      NOVIEMBRE,
    );
    expect(empate.porCategoria.map((l) => l.categoria.nombre)).toEqual([
      "Arriendo",
      "Restaurantes",
    ]);
  });
});

describe("promedio diario", () => {
  test("mes pasado: divide por los dias del mes completo", () => {
    const r = resumirMes([gasto("2026-10-10", 310000)], "2026-10", NOVIEMBRE);
    expect(r.mesEnCurso).toBe(false);
    expect(r.diasConsiderados).toBe(31);
    expect(r.promedioDiario).toBeCloseTo(10000, 6);
  });

  test("febrero no bisiesto divide por 28", () => {
    const r = resumirMes([gasto("2026-02-10", 28000)], "2026-02", NOVIEMBRE);
    expect(r.diasConsiderados).toBe(28);
    expect(r.promedioDiario).toBeCloseTo(1000, 6);
  });

  test("febrero bisiesto divide por 29", () => {
    const enMarzo = new Date("2028-03-10T12:00:00.000Z");
    const r = resumirMes([gasto("2028-02-10", 29000)], "2028-02", enMarzo);
    expect(r.diasConsiderados).toBe(29);
  });

  test("mes en curso: divide por los dias transcurridos, no por el mes entero", () => {
    // 5 de octubre en Chile.
    const cinco = new Date("2026-10-05T15:00:00.000Z");
    const r = resumirMes([gasto("2026-10-01", 50000)], "2026-10", cinco);
    expect(r.mesEnCurso).toBe(true);
    expect(r.diasConsiderados).toBe(5);
    expect(r.promedioDiario).toBeCloseTo(10000, 6);
  });

  test("el dia transcurrido se lee en zona de Chile, no en UTC", () => {
    // 01:00 UTC del 1 de noviembre es todavia 31 de octubre en Chile.
    const borde = new Date("2026-11-01T01:00:00.000Z");
    const r = resumirMes([gasto("2026-10-15", 31000)], "2026-10", borde);
    expect(r.mesEnCurso).toBe(true);
    expect(r.diasConsiderados).toBe(31);
  });
});

describe("aPlano", () => {
  test("convierte una fila de Prisma sin correr el dia", () => {
    const plano = aPlano({
      id: "g1",
      fecha: fechaDesdeISO("2026-10-01"),
      descripcion: "Feria",
      monto: 23450,
      medioPago: "EFECTIVO",
      notas: null,
      categoria: SUPER,
    });
    expect(plano.fecha).toBe("2026-10-01");
    expect(plano.medioPago).toBe("EFECTIVO");
    expect(plano.monto).toBe(23450);
  });

  test("lo convertido entra directo al resumen", () => {
    const plano = aPlano({
      id: "g1",
      fecha: fechaDesdeISO("2026-10-31"),
      descripcion: "Feria",
      monto: 1000,
      medioPago: "DEBITO",
      notas: "con nota",
      categoria: SUPER,
    });
    const r = resumirMes([plano], "2026-10", NOVIEMBRE);
    expect(r.total).toBe(1000);
    expect(r.mayorGasto?.notas).toBe("con nota");
  });
});

/**
 * Los pagos de cuota se apartan del resto.
 *
 * Es la proteccion contra el doble descuento: el balance ya resta las cuotas
 * del sueldo por su lado. Si ademas entraran en `total`, en `esenciales` o en
 * el desglose por categoria, la misma plata se restaria dos veces y el
 * disponible mostraria menos de lo que hay.
 */
describe("los pagos de cuota van aparte", () => {
  const CAT_DEUDAS = {
    id: "cat-deudas",
    nombre: "Deudas y créditos",
    color: "#64748b",
    icono: "credit-card",
    esencial: true,
  };

  const conCuota = (monto: number, deudaId = "d1"): GastoPlano => ({
    ...gasto("2026-10-05", monto, CAT_DEUDAS),
    cuota: { deudaId, deudaNombre: "Crédito" },
  });

  test("no entran en el total del mes", () => {
    const r = resumirMes([gasto("2026-10-02", 50_000), conCuota(168_000)], "2026-10", NOVIEMBRE);

    expect(r.total).toBe(50_000);
    expect(r.totalCuotas).toBe(168_000);
    expect(r.cuotasPagadas).toHaveLength(1);
  });

  test("REGRESION: no entran en esenciales ni en discrecionales", () => {
    // La categoria de deudas esta marcada esencial a proposito. Si el filtro
    // se cayera, estos 168.000 se sumarian a esenciales y el balance los
    // restaria dos veces: una como cuota y otra como gasto basico.
    const r = resumirMes([gasto("2026-10-02", 50_000), conCuota(168_000)], "2026-10", NOVIEMBRE);

    expect(r.esenciales + r.discrecionales).toBe(r.total);
    expect(r.esenciales).not.toBe(218_000);
  });

  test("no aparecen en el desglose por categoría", () => {
    const r = resumirMes([gasto("2026-10-02", 50_000), conCuota(168_000)], "2026-10", NOVIEMBRE);
    expect(r.porCategoria.map((l) => l.categoria.nombre)).not.toContain("Deudas y créditos");
  });

  test("no inflan la cantidad de gastos", () => {
    const r = resumirMes([conCuota(168_000)], "2026-10", NOVIEMBRE);

    expect(r.cantidad).toBe(0);
    expect(r.total).toBe(0);
    expect(r.totalCuotas).toBe(168_000);
  });

  test("un mes sin cuotas deja la sección vacía, no en null", () => {
    const r = resumirMes([gasto("2026-10-02", 1000)], "2026-10", NOVIEMBRE);
    expect(r.cuotasPagadas).toEqual([]);
    expect(r.totalCuotas).toBe(0);
  });

  test("varias cuotas se suman entre ellas", () => {
    const r = resumirMes([conCuota(168_000, "d1"), conCuota(95_000, "d2")], "2026-10", NOVIEMBRE);
    expect(r.totalCuotas).toBe(263_000);
    expect(r.cuotasPagadas).toHaveLength(2);
  });

  test("una cuota de otro mes no entra", () => {
    const deSeptiembre: GastoPlano = {
      ...gasto("2026-09-05", 168_000, CAT_DEUDAS),
      cuota: { deudaId: "d1", deudaNombre: "Crédito" },
    };
    const r = resumirMes([deSeptiembre], "2026-10", NOVIEMBRE);

    expect(r.cuotasPagadas).toEqual([]);
    expect(r.totalCuotas).toBe(0);
  });
});
