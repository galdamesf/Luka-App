import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import { miembroDeSesion, registrarEntrada } from "@/datos/hogares";
import { refrescarCategoriasBase } from "@/datos/categorias";
import { CATEGORIAS_BASE } from "@/dominio/categorias-base";
import type { ReglasDeEntrada } from "@/dominio/entrada";

/**
 * Lo que pasa en la base cuando alguien entra con Google: a que hogar va, que
 * se crea y que queda guardado para revisar la sesion en cada visita.
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

const CERRADA: ReglasDeEntrada = { listaDeAntes: ["fernando@gmail.com", "ana@gmail.com"], puertaAbierta: false };
const ABIERTA: ReglasDeEntrada = { ...CERRADA, puertaAbierta: true };

const entrar = (correo: string, nombre: string | null = null, reglas = CERRADA) =>
  registrarEntrada({ correo, nombre }, reglas, prisma);

describe("registrarEntrada con la puerta cerrada", () => {
  test("el primero de la lista entra al hogar inicial como su dueno", async () => {
    const hogar = await entrar("Fernando@Gmail.com", "Fernando Galdames");
    expect(hogar).toMatchObject({ hogarId: HOGAR_INICIAL, rol: "DUENO" });

    const miembro = await prisma.miembro.findUniqueOrThrow({ where: { correo: "fernando@gmail.com" } });
    expect(miembro.nombre).toBe("Fernando Galdames");
    expect(miembro.entroEn).toBeInstanceOf(Date);
    expect(miembro.id).toBe(hogar?.miembroId);
  });

  test("los demas de la lista entran al mismo hogar, como miembros", async () => {
    await entrar("fernando@gmail.com");
    const ana = await entrar("ana@gmail.com", "Ana");
    expect(ana).toMatchObject({ hogarId: HOGAR_INICIAL, rol: "MIEMBRO" });
    expect(await prisma.miembro.count({ where: { hogarId: HOGAR_INICIAL } })).toBe(2);
  });

  test("entrar de nuevo no crea otro miembro y devuelve el mismo hogar", async () => {
    const primera = await entrar("fernando@gmail.com");
    const segunda = await entrar("fernando@gmail.com");
    expect(segunda).toEqual(primera);
    expect(await prisma.miembro.count()).toBe(1);
  });

  test("alguien que no esta en la lista no entra y no deja nada en la base", async () => {
    expect(await entrar("desconocido@gmail.com", "Desconocido")).toBeNull();
    expect(await prisma.miembro.count()).toBe(0);
    expect(await prisma.hogar.count()).toBe(1);
  });

  test("una invitacion pendiente entra a su hogar aunque la puerta este cerrada", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Pedro" } });
    await prisma.miembro.create({ data: { hogarId: otro.id, correo: "pedro@gmail.com" } });

    const hogar = await entrar("pedro@gmail.com", "Pedro Soto");
    expect(hogar).toMatchObject({ hogarId: otro.id, rol: "MIEMBRO" });

    const miembro = await prisma.miembro.findUniqueOrThrow({ where: { correo: "pedro@gmail.com" } });
    expect(miembro.entroEn).toBeInstanceOf(Date);
    expect(miembro.nombre).toBe("Pedro Soto");
  });

  test("la primera entrada no se pisa al volver, y el nombre se refresca", async () => {
    await entrar("fernando@gmail.com", "Fernando");
    const { entroEn } = await prisma.miembro.findUniqueOrThrow({ where: { correo: "fernando@gmail.com" } });
    await entrar("fernando@gmail.com", "Fernando Galdames");
    const despues = await prisma.miembro.findUniqueOrThrow({ where: { correo: "fernando@gmail.com" } });
    expect(despues.entroEn).toEqual(entroEn);
    expect(despues.nombre).toBe("Fernando Galdames");
  });

  test("si Google no entrega nombre, se conserva el que habia", async () => {
    await entrar("fernando@gmail.com", "Fernando");
    await entrar("fernando@gmail.com", null);
    const miembro = await prisma.miembro.findUniqueOrThrow({ where: { correo: "fernando@gmail.com" } });
    expect(miembro.nombre).toBe("Fernando");
  });

  test("sin correo, o sin forma de correo, no entra nadie", async () => {
    expect(await registrarEntrada({ correo: null, nombre: "X" }, ABIERTA, prisma)).toBeNull();
    expect(await registrarEntrada({ correo: "sin-arroba", nombre: "X" }, ABIERTA, prisma)).toBeNull();
    expect(await prisma.miembro.count()).toBe(0);
  });
});

describe("registrarEntrada con la puerta abierta", () => {
  test("alguien nuevo tiene su propio hogar, con su nombre, y queda de dueno", async () => {
    const hogar = await entrar("pedro@gmail.com", "Pedro Soto", ABIERTA);
    expect(hogar?.rol).toBe("DUENO");
    expect(hogar?.hogarId).not.toBe(HOGAR_INICIAL);

    const fila = await prisma.hogar.findUniqueOrThrow({ where: { id: hogar!.hogarId } });
    expect(fila.nombre).toBe("Hogar de Pedro");
  });

  test("el hogar nuevo nace con las categorias de partida, en su orden", async () => {
    const hogar = await entrar("pedro@gmail.com", "Pedro", ABIERTA);
    const categorias = await prisma.categoria.findMany({
      where: { hogarId: hogar!.hogarId },
      orderBy: { orden: "asc" },
    });
    expect(categorias.map((c) => c.nombre)).toEqual(CATEGORIAS_BASE.map((c) => c.nombre));
    expect(categorias.every((c) => c.activa)).toBe(true);
  });

  test("dos hogares nuevos tienen cada uno sus categorias, sin chocar", async () => {
    const pedro = await entrar("pedro@gmail.com", "Pedro", ABIERTA);
    const sofia = await entrar("sofia@gmail.com", "Sofía", ABIERTA);
    expect(pedro!.hogarId).not.toBe(sofia!.hogarId);
    const n = CATEGORIAS_BASE.length;
    expect(await prisma.categoria.count({ where: { hogarId: pedro!.hogarId } })).toBe(n);
    expect(await prisma.categoria.count({ where: { hogarId: sofia!.hogarId } })).toBe(n);
  });

  test("quien esta en la lista de antes sigue yendo al hogar inicial, no a uno nuevo", async () => {
    const hogar = await entrar("fernando@gmail.com", null, ABIERTA);
    expect(hogar?.hogarId).toBe(HOGAR_INICIAL);
    expect(await prisma.hogar.count()).toBe(1);
  });

  test("volver a entrar no crea un segundo hogar", async () => {
    await entrar("pedro@gmail.com", "Pedro", ABIERTA);
    await entrar("pedro@gmail.com", "Pedro", ABIERTA);
    expect(await prisma.hogar.count()).toBe(2); // el inicial y el de Pedro
  });

  test("dos ingresos del mismo correo a la vez terminan en un solo hogar", async () => {
    const [uno, dos] = await Promise.all([
      entrar("pedro@gmail.com", "Pedro", ABIERTA),
      entrar("pedro@gmail.com", "Pedro", ABIERTA),
    ]);
    expect(uno).toEqual(dos);
    expect(await prisma.miembro.count({ where: { correo: "pedro@gmail.com" } })).toBe(1);
    expect(await prisma.hogar.count()).toBe(2);
  });
});

describe("miembroDeSesion", () => {
  test("devuelve el hogar de quien ya entro", async () => {
    const hogar = await entrar("fernando@gmail.com");
    expect(await miembroDeSesion("FERNANDO@gmail.com ", prisma)).toEqual(hogar);
  });

  test("una invitacion pendiente todavia no tiene sesion", async () => {
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "pedro@gmail.com" } });
    expect(await miembroDeSesion("pedro@gmail.com", prisma)).toBeNull();
  });

  test("quien ya no es miembro no tiene hogar", async () => {
    const hogar = await entrar("fernando@gmail.com");
    await prisma.miembro.delete({ where: { id: hogar!.miembroId } });
    expect(await miembroDeSesion("fernando@gmail.com", prisma)).toBeNull();
  });

  test("sin correo no hay a quien buscar", async () => {
    expect(await miembroDeSesion(undefined, prisma)).toBeNull();
  });
});

describe("refrescarCategoriasBase (el seed)", () => {
  test("pone las categorias de partida en cada hogar, sin duplicar al repetirse", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    const n = CATEGORIAS_BASE.length;

    expect(await refrescarCategoriasBase(prisma)).toEqual({ hogares: 2, creadas: 2 * n, actualizadas: 0 });
    expect(await refrescarCategoriasBase(prisma)).toEqual({ hogares: 2, creadas: 0, actualizadas: 2 * n });
    expect(await prisma.categoria.count({ where: { hogarId: HOGAR_INICIAL } })).toBe(n);
    expect(await prisma.categoria.count({ where: { hogarId: otro.id } })).toBe(n);
  });

  test("vuelve a poner la paleta en cada hogar y no crea de mas", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    await refrescarCategoriasBase(prisma);
    const nombre = CATEGORIAS_BASE[0]!.nombre;
    await prisma.categoria.update({
      where: { hogarId_nombre: { hogarId: otro.id, nombre } },
      data: { color: "#000000" },
    });

    await refrescarCategoriasBase(prisma);

    const suya = await prisma.categoria.findUniqueOrThrow({ where: { hogarId_nombre: { hogarId: otro.id, nombre } } });
    expect(suya.color).not.toBe("#000000");
    expect(await prisma.categoria.count()).toBe(2 * CATEGORIAS_BASE.length);
  });
});
