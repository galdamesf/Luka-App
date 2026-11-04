import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import { fechaDesdeISO } from "@/lib/fecha";

/**
 * Las reglas de los hogares que pone la base, no el codigo: valen aunque
 * alguien escriba a mano desde psql.
 */

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

const MES = fechaDesdeISO("2026-11-01");

async function crearCategoria(hogarId?: string, nombre = "Supermercado") {
  return prisma.categoria.create({
    data: { nombre, color: "#15803D", icono: "shopping-cart", esencial: true, ...(hogarId ? { hogarId } : {}) },
  });
}

async function crearGasto(categoriaId: string, datos: { hogarId?: string; anotadoPorId?: string } = {}) {
  return prisma.gasto.create({
    data: { fecha: fechaDesdeISO("2026-11-03"), descripcion: "Feria", monto: 12_000, categoriaId, ...datos },
  });
}

describe("mientras el codigo no pasa el hogar", () => {
  test("todo lo que se crea sin hogar cae en el hogar inicial", async () => {
    const categoria = await crearCategoria();
    const gasto = await crearGasto(categoria.id);
    const sueldo = await prisma.sueldo.create({ data: { monto: 1_000_000, vigenteDesde: MES } });
    const deuda = await prisma.deuda.create({
      data: { nombre: "Notebook", montoCuota: 50_000, cuotasTotales: 12, primeraCuota: MES },
    });
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Luz", monto: 30_000, mes: MES, categoriaId: categoria.id },
    });
    const presupuesto = await prisma.presupuesto.create({
      data: { categoriaId: categoria.id, mes: MES, monto: 200_000 },
    });
    const ahorro = await prisma.ahorro.create({ data: { mes: MES, monto: 40_000 } });
    const ajustes = await prisma.ajustes.create({ data: { diaInicioMes: 27 } });

    for (const fila of [categoria, gasto, sueldo, deuda, cuenta, presupuesto, ahorro, ajustes]) {
      expect(fila.hogarId).toBe(HOGAR_INICIAL);
    }
    expect(gasto.anotadoPorId).toBeNull();
  });
});

describe("hogares", () => {
  test("se crea con un id propio y la fecha de creacion", async () => {
    const hogar = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    expect(hogar.id).not.toBe(HOGAR_INICIAL);
    expect(hogar.creadoEn).toBeInstanceOf(Date);
  });

  test("no acepta un nombre vacio ni solo con espacios", async () => {
    await expect(prisma.hogar.create({ data: { nombre: "" } })).rejects.toThrow();
    await expect(prisma.hogar.create({ data: { nombre: "   " } })).rejects.toThrow();
  });

  test("un dato no puede apuntar a un hogar que no existe", async () => {
    await expect(crearCategoria("hogar-que-no-existe")).rejects.toThrow();
  });

  test("un hogar con datos no se borra de un tiron", async () => {
    const hogar = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    await crearCategoria(hogar.id);
    await expect(prisma.hogar.delete({ where: { id: hogar.id } })).rejects.toThrow();
    expect(await prisma.categoria.count({ where: { hogarId: hogar.id } })).toBe(1);
  });

  test("un hogar sin datos se borra, y sus miembros se van con el", async () => {
    const hogar = await prisma.hogar.create({
      data: { nombre: "Casa de Ana", miembros: { create: { correo: "ana@gmail.com", rol: "DUENO" } } },
    });
    await prisma.hogar.delete({ where: { id: hogar.id } });
    expect(await prisma.miembro.count()).toBe(0);
  });

  test("cada hogar tiene a lo mas un juego de ajustes", async () => {
    await prisma.ajustes.create({ data: { diaInicioMes: 27 } });
    // Otra fila para el mismo hogar choca (por el hogar o por el id 'app').
    await expect(prisma.ajustes.create({ data: { id: "otro", diaInicioMes: 1 } })).rejects.toThrow();
  });
});

describe("miembros", () => {
  test("una invitacion es un miembro que todavia no entra", async () => {
    const miembro = await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "ana@gmail.com" } });
    expect(miembro.rol).toBe("MIEMBRO");
    expect(miembro.entroEn).toBeNull();
    expect(miembro.nombre).toBeNull();
    expect(miembro.invitadoEn).toBeInstanceOf(Date);
  });

  test("una persona esta en un solo hogar: el correo no se repite", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "ana@gmail.com" } });
    await expect(prisma.miembro.create({ data: { hogarId: otro.id, correo: "ana@gmail.com" } })).rejects.toThrow();
  });

  test.each(["Ana@Gmail.com", " ana@gmail.com", "ana@gmail.com ", "sin-arroba", "@gmail.com", "ana@"])(
    "el correo %j se rechaza: va normalizado y con forma de correo",
    async (correo) => {
      await expect(prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo } })).rejects.toThrow();
    },
  );

  test("si quien anoto un gasto deja el hogar, el gasto se queda sin autor", async () => {
    const miembro = await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "ana@gmail.com" } });
    const categoria = await crearCategoria();
    const gasto = await crearGasto(categoria.id, { anotadoPorId: miembro.id });
    expect(gasto.anotadoPorId).toBe(miembro.id);

    await prisma.miembro.delete({ where: { id: miembro.id } });

    const despues = await prisma.gasto.findUniqueOrThrow({ where: { id: gasto.id } });
    expect(despues.anotadoPorId).toBeNull();
    expect(despues.hogarId).toBe(HOGAR_INICIAL);
  });

  test("el gasto sabe quien lo anoto", async () => {
    const miembro = await prisma.miembro.create({
      data: { hogarId: HOGAR_INICIAL, correo: "ana@gmail.com", nombre: "Ana" },
    });
    const categoria = await crearCategoria();
    const gasto = await crearGasto(categoria.id, { anotadoPorId: miembro.id });
    const leido = await prisma.gasto.findUniqueOrThrow({ where: { id: gasto.id }, include: { anotadoPor: true } });
    expect(leido.anotadoPor?.nombre).toBe("Ana");
  });
});
