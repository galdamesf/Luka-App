import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import { ordenarBoletasSueltas } from "@/datos/boletas";
import { fechaDesdeISO } from "@/lib/fecha";

/**
 * Las boletas de antes de los hogares estaban todas sueltas en boletas/. Al
 * arrancar, cada una pasa a la carpeta del hogar que la usa, segun la base.
 */

let prisma: PrismaClient;
let raiz: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const OTRO = "hogar-de-ana";
const nombre = (n: number) => `${String(n).padStart(32, "0")}.jpg`;

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  raiz = await mkdtemp(join(tmpdir(), "boletas-orden-"));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

async function categoria(hogarId: string) {
  return prisma.categoria.create({
    data: { hogarId, nombre: "Supermercado", color: "#15803D", icono: "shopping-cart" },
  });
}

async function gastoConBoleta(hogarId: string, boletaArchivo: string) {
  const cat = await categoria(hogarId);
  return prisma.gasto.create({
    data: { hogarId, fecha: fechaDesdeISO("2026-10-10"), descripcion: "Feria", monto: 1_000, categoriaId: cat.id, boletaArchivo },
  });
}

describe("ordenarBoletasSueltas", () => {
  test("cada boleta pasa a la carpeta del hogar del gasto o la cuenta que la usa", async () => {
    await writeFile(join(raiz, nombre(1)), "del gasto");
    await writeFile(join(raiz, nombre(2)), "de la cuenta del otro hogar");
    await gastoConBoleta(HOGAR_INICIAL, nombre(1));
    const cat = await categoria(OTRO);
    await prisma.cuenta.create({
      data: { hogarId: OTRO, nombre: "Luz", monto: 1, mes: fechaDesdeISO("2026-10-01"), categoriaId: cat.id, boletaArchivo: nombre(2) },
    });

    expect(await ordenarBoletasSueltas(raiz, prisma)).toEqual({ movidas: 2, sinDueno: [] });

    expect(await readdir(join(raiz, HOGAR_INICIAL))).toEqual([nombre(1)]);
    expect(await readdir(join(raiz, OTRO))).toEqual([nombre(2)]);
    expect(await readFile(join(raiz, OTRO, nombre(2)), "utf8")).toBe("de la cuenta del otro hogar");
  });

  test("la que nadie usa se queda donde esta, y se avisa", async () => {
    await writeFile(join(raiz, nombre(3)), "huerfana");
    expect(await ordenarBoletasSueltas(raiz, prisma)).toEqual({ movidas: 0, sinDueno: [nombre(3)] });
    expect(await readdir(raiz)).toEqual([nombre(3)]);
  });

  test("repetirla no mueve nada mas", async () => {
    await writeFile(join(raiz, nombre(1)), "x");
    await gastoConBoleta(HOGAR_INICIAL, nombre(1));
    await ordenarBoletasSueltas(raiz, prisma);
    expect(await ordenarBoletasSueltas(raiz, prisma)).toEqual({ movidas: 0, sinDueno: [] });
  });

  test("no pisa un archivo que ya este en la carpeta del hogar", async () => {
    await mkdir(join(raiz, HOGAR_INICIAL));
    await writeFile(join(raiz, HOGAR_INICIAL, nombre(1)), "el que ya estaba");
    await writeFile(join(raiz, nombre(1)), "el suelto");
    await gastoConBoleta(HOGAR_INICIAL, nombre(1));

    expect((await ordenarBoletasSueltas(raiz, prisma)).movidas).toBe(0);
    expect(await readFile(join(raiz, HOGAR_INICIAL, nombre(1)), "utf8")).toBe("el que ya estaba");
    expect(await readFile(join(raiz, nombre(1)), "utf8")).toBe("el suelto");
  });

  test("ignora lo que no es una boleta nuestra", async () => {
    await writeFile(join(raiz, "notas.txt"), "no es boleta");
    await mkdir(join(raiz, "otra-carpeta"));
    expect(await ordenarBoletasSueltas(raiz, prisma)).toEqual({ movidas: 0, sinDueno: [] });
    expect((await readdir(raiz)).sort()).toEqual(["notas.txt", "otra-carpeta"]);
  });

  test("sin carpeta de boletas no hay nada que ordenar", async () => {
    expect(await ordenarBoletasSueltas(join(raiz, "no-existe"), prisma)).toEqual({ movidas: 0, sinDueno: [] });
  });
});
