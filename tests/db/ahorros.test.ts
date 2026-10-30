import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import { crearAhorro, eliminarAhorro, listarAhorrosHasta } from "@/datos/ahorros";
import { fechaDesdeISO } from "@/lib/fecha";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
});

describe("ahorros", () => {
  test("se guarda en su mes y vuelve como YYYY-MM, con su nota", async () => {
    const ahorro = await crearAhorro({ mes: "2026-10", monto: 150_000, nota: "Fondo de emergencia" }, prisma);
    expect(ahorro).toMatchObject({ mes: "2026-10", monto: 150_000, nota: "Fondo de emergencia" });
  });

  test("varios en el mismo mes, y listar hasta un mes no trae los siguientes", async () => {
    await crearAhorro({ mes: "2026-09", monto: 100_000, nota: null }, prisma);
    await crearAhorro({ mes: "2026-10", monto: 150_000, nota: null }, prisma);
    await crearAhorro({ mes: "2026-10", monto: 50_000, nota: "Lo que sobró" }, prisma);
    await crearAhorro({ mes: "2026-11", monto: 70_000, nota: null }, prisma);

    const hastaOctubre = await listarAhorrosHasta("2026-10", prisma);
    expect(hastaOctubre.map((a) => a.mes)).toEqual(["2026-10", "2026-10", "2026-09"]);
    expect(hastaOctubre.reduce((s, a) => s + a.monto, 0)).toBe(300_000);
  });

  test("eliminar borra solo ese, y borrar uno que no existe no falla", async () => {
    const uno = await crearAhorro({ mes: "2026-10", monto: 10_000, nota: null }, prisma);
    await crearAhorro({ mes: "2026-10", monto: 20_000, nota: null }, prisma);

    await eliminarAhorro(uno.id, prisma);
    await eliminarAhorro(uno.id, prisma);

    expect((await listarAhorrosHasta("2026-10", prisma)).map((a) => a.monto)).toEqual([20_000]);
  });

  test("la base rechaza un monto de cero o negativo", async () => {
    for (const monto of [0, -5_000]) {
      await expect(prisma.ahorro.create({ data: { mes: fechaDesdeISO("2026-10-01"), monto } })).rejects.toThrow();
    }
  });

  test("la base rechaza un mes que no sea dia 1", async () => {
    await expect(prisma.ahorro.create({ data: { mes: fechaDesdeISO("2026-10-15"), monto: 1_000 } })).rejects.toThrow();
  });
});
