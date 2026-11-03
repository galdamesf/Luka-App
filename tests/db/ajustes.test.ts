import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import { definirDiaInicioMes, leerAjustes } from "@/datos/ajustes";

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

describe("ajustes", () => {
  test("sin fila guardada, el mes es el calendario", async () => {
    expect(await leerAjustes(prisma)).toEqual({ diaInicioMes: 1 });
  });

  test("guardar el dia lo deja leido, y guardarlo de nuevo no crea otra fila", async () => {
    await definirDiaInicioMes(27, prisma);
    await definirDiaInicioMes(15, prisma);
    expect(await leerAjustes(prisma)).toEqual({ diaInicioMes: 15 });
    expect(await prisma.ajustes.count()).toBe(1);
  });

  test("la base rechaza un dia fuera de 1 a 31 y una segunda fila", async () => {
    await expect(prisma.ajustes.create({ data: { id: "app", diaInicioMes: 32 } })).rejects.toThrow();
    await expect(prisma.ajustes.create({ data: { id: "otra", diaInicioMes: 5 } })).rejects.toThrow();
  });
});
