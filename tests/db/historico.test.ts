import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import { serieHistorica } from "@/datos/historico";
import { fechaDesdeISO } from "@/lib/fecha";

let prisma: PrismaClient;
let categoria: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  const c = await prisma.categoria.create({
    data: { nombre: "Supermercado", color: "#c38409", icono: "shopping-cart" },
  });
  categoria = c.id;
});

async function gasto(fechaISO: string, monto: number) {
  await prisma.gasto.create({
    data: {
      fecha: fechaDesdeISO(fechaISO),
      descripcion: `gasto ${fechaISO}`,
      monto,
      categoriaId: categoria,
    },
  });
}

async function sueldo(mes: string, monto: number) {
  await prisma.sueldo.create({
    data: { monto, vigenteDesde: fechaDesdeISO(`${mes}-01`) },
  });
}

describe("serieHistorica", () => {
  test("devuelve exactamente la cantidad de meses pedida, terminando en el final", async () => {
    const serie = await serieHistorica("2026-10", 4, prisma);
    expect(serie.map((p) => p.mes)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  test("suma los gastos de cada mes", async () => {
    await gasto("2026-09-03", 120_000);
    await gasto("2026-09-28", 80_000);
    await gasto("2026-10-05", 50_000);

    const serie = await serieHistorica("2026-10", 2, prisma);
    expect(serie).toEqual([
      { mes: "2026-09", ingresos: 0, gastos: 200_000 },
      { mes: "2026-10", ingresos: 0, gastos: 50_000 },
    ]);
  });

  test("un mes sin gastos aparece en 0, no se salta", async () => {
    await gasto("2026-08-10", 90_000);
    await gasto("2026-10-10", 70_000);

    const serie = await serieHistorica("2026-10", 3, prisma);
    expect(serie.map((p) => [p.mes, p.gastos])).toEqual([
      ["2026-08", 90_000],
      ["2026-09", 0],
      ["2026-10", 70_000],
    ]);
  });

  test("los ingresos salen del sueldo vigente en cada mes", async () => {
    await sueldo("2026-08", 1_000_000);
    await sueldo("2026-10", 1_200_000);

    const serie = await serieHistorica("2026-10", 3, prisma);
    expect(serie.map((p) => [p.mes, p.ingresos])).toEqual([
      ["2026-08", 1_000_000],
      ["2026-09", 1_000_000], // sigue rigiendo el de agosto
      ["2026-10", 1_200_000],
    ]);
  });

  test("un mes anterior al primer sueldo queda en 0, sin aplicar el sueldo hacia atras", async () => {
    await sueldo("2026-09", 1_000_000);

    const serie = await serieHistorica("2026-10", 3, prisma);
    expect(serie.map((p) => [p.mes, p.ingresos])).toEqual([
      ["2026-08", 0],
      ["2026-09", 1_000_000],
      ["2026-10", 1_000_000],
    ]);
  });

  /**
   * El riesgo real de este archivo. `fecha` es @db.Date y leerla con metodos
   * locales en Chile (UTC-3) corre el dia hacia atras; en el dia 1 eso cambia
   * el MES, y el gasto se contabiliza en el mes equivocado.
   */
  test("un gasto el dia 1 cuenta en su mes, no en el anterior", async () => {
    await gasto("2026-10-01", 333_000);

    const serie = await serieHistorica("2026-10", 2, prisma);
    expect(serie).toEqual([
      { mes: "2026-09", ingresos: 0, gastos: 0 },
      { mes: "2026-10", ingresos: 0, gastos: 333_000 },
    ]);
  });

  test("un gasto el ultimo dia del mes no se escapa al siguiente", async () => {
    await gasto("2026-09-30", 111_000);

    const serie = await serieHistorica("2026-10", 2, prisma);
    expect(serie).toEqual([
      { mes: "2026-09", ingresos: 0, gastos: 111_000 },
      { mes: "2026-10", ingresos: 0, gastos: 0 },
    ]);
  });

  test("un sueldo que empieza el dia 1 rige desde ese mes", async () => {
    await sueldo("2026-10", 900_000);
    const serie = await serieHistorica("2026-10", 1, prisma);
    expect(serie[0]).toEqual({ mes: "2026-10", ingresos: 900_000, gastos: 0 });
  });

  test("no arrastra gastos de fuera del rango", async () => {
    await gasto("2026-06-15", 999_999);
    await gasto("2026-10-15", 10_000);

    const serie = await serieHistorica("2026-10", 2, prisma);
    expect(serie.reduce((a, p) => a + p.gastos, 0)).toBe(10_000);
  });

  test("cruza el fin de ano sin perder meses", async () => {
    await gasto("2025-12-20", 60_000);
    await gasto("2026-01-05", 40_000);

    const serie = await serieHistorica("2026-01", 3, prisma);
    expect(serie.map((p) => [p.mes, p.gastos])).toEqual([
      ["2025-11", 0],
      ["2025-12", 60_000],
      ["2026-01", 40_000],
    ]);
  });

  test("pedir 0 meses no devuelve vacio: entrega al menos el mes final", async () => {
    const serie = await serieHistorica("2026-10", 0, prisma);
    expect(serie).toHaveLength(1);
    expect(serie[0]!.mes).toBe("2026-10");
  });
});
