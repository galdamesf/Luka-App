import { describe, expect, test } from "vitest";
import { repartirGastos, type GastoPlano } from "@/dominio/resumen";

const SUPER = { id: "c1", nombre: "Supermercado", color: "#009993", icono: "cart", esencial: true };
const RESTO = { id: "c2", nombre: "Restaurantes", color: "#c38409", icono: "utensils", esencial: false };
const SUSCRIPCIONES = { id: "c3", nombre: "Suscripciones", color: "#9c5ac9", icono: "tv", esencial: false };

let contador = 0;
function gasto(
  fecha: string,
  monto: number,
  categoria = SUPER,
  extra: Partial<GastoPlano> = {},
): GastoPlano {
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
    ...extra,
  };
}

describe("reparte por categoria esencial", () => {
  const { esenciales, resto } = repartirGastos(
    [gasto("2026-10-05", 10_000, SUPER), gasto("2026-10-06", 20_000, RESTO)],
    "2026-10",
  );

  test("lo esencial va a su linea", () => {
    expect(esenciales.map((g) => g.monto)).toEqual([10_000]);
  });

  test("lo demas va a la otra", () => {
    expect(resto.map((g) => g.monto)).toEqual([20_000]);
  });

  test("ningun gasto queda en las dos ni se pierde", () => {
    expect(esenciales.length + resto.length).toBe(2);
  });
});

describe("una cuenta pagada aparece como gasto de su categoria", () => {
  // Esto es lo que hacia dudar del total: pagar "Internet Movil" crea un
  // gasto con la categoria de la cuenta, y si esa categoria no es esencial
  // cae en "lo demas" sin que nadie lo haya cargado a mano.
  const { esenciales, resto } = repartirGastos(
    [gasto("2026-10-27", 29_980, SUSCRIPCIONES, { descripcion: "Internet Móvil" })],
    "2026-10",
  );

  test("queda visible en la linea que corresponde", () => {
    expect(resto.map((g) => g.descripcion)).toEqual(["Internet Móvil"]);
    expect(esenciales).toEqual([]);
  });
});

describe("las cuotas de deuda quedan fuera", () => {
  const cuota = gasto("2026-10-10", 50_000, RESTO, {
    cuota: { deudaId: "d1", deudaNombre: "Notebook" },
  });
  const { esenciales, resto } = repartirGastos(
    [cuota, gasto("2026-10-11", 7_000, RESTO)],
    "2026-10",
  );

  test("no se cuelan en ninguna de las dos lineas", () => {
    expect(resto.map((g) => g.monto)).toEqual([7_000]);
    expect(esenciales).toEqual([]);
  });

  test("un gasto sin el campo cuota NO se confunde con una cuota", () => {
    // El filtro usa != null, no === null, a proposito: un gasto que viene
    // sin el campo (undefined) es un gasto normal y tiene que aparecer. Con
    // === null se escapaba de las dos lineas y vaciaba los totales.
    const { resto: r } = repartirGastos(
      [{ ...gasto("2026-10-12", 8_000, RESTO), cuota: undefined } as never],
      "2026-10",
    );
    expect(r.map((g) => g.monto)).toEqual([8_000]);
  });
});

describe("solo el mes pedido", () => {
  const { esenciales, resto } = repartirGastos(
    [
      gasto("2026-09-30", 1_000, SUPER),
      gasto("2026-10-01", 2_000, SUPER),
      gasto("2026-11-01", 3_000, RESTO),
      gasto("2026-10-02", 4_000, RESTO),
    ],
    "2026-10",
  );

  test("deja fuera el mes anterior y el siguiente", () => {
    expect(esenciales.map((g) => g.monto)).toEqual([2_000]);
    expect(resto.map((g) => g.monto)).toEqual([4_000]);
  });
});

describe("orden", () => {
  const { resto } = repartirGastos(
    [
      gasto("2026-10-03", 1_000, RESTO),
      gasto("2026-10-20", 2_000, RESTO),
      gasto("2026-10-11", 3_000, RESTO),
    ],
    "2026-10",
  );

  test("del mas nuevo al mas viejo", () => {
    expect(resto.map((g) => g.fecha)).toEqual(["2026-10-20", "2026-10-11", "2026-10-03"]);
  });

  test("con empate de fecha, primero el mas caro", () => {
    const { resto: r } = repartirGastos(
      [
        gasto("2026-10-07", 5_000, RESTO),
        gasto("2026-10-07", 90_000, RESTO),
        gasto("2026-10-07", 30_000, RESTO),
      ],
      "2026-10",
    );
    expect(r.map((g) => g.monto)).toEqual([90_000, 30_000, 5_000]);
  });

  test("no muta la lista que recibe", () => {
    const original = [gasto("2026-10-01", 1_000, RESTO), gasto("2026-10-28", 2_000, RESTO)];
    const copia = [...original];
    repartirGastos(original, "2026-10");
    expect(original).toEqual(copia);
  });
});

describe("mes sin nada", () => {
  test("devuelve dos listas vacias, no undefined", () => {
    const { esenciales, resto } = repartirGastos([], "2026-10");
    expect(esenciales).toEqual([]);
    expect(resto).toEqual([]);
  });
});
