import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import {
  ErrorDeHogar,
  hacerDueno,
  invitarMiembro,
  leerHogar,
  miembrosQueEntraron,
  quitarMiembro,
  registrarEntrada,
  renombrarHogar,
  salirDelHogar,
} from "@/datos/hogares";
import { fechaDesdeISO } from "@/lib/fecha";

/**
 * La pagina Hogar contra la base: invitar, sacar, pasar el hogar, salir y
 * cambiarle el nombre. Con el rol que dice la base, y siempre dentro del
 * hogar de quien lo hace.
 */

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const OTRO = "hogar-de-ana";
let dueno: string;
let miembro: string;

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  dueno = (
    await prisma.miembro.create({
      data: { hogarId: HOGAR_INICIAL, correo: "fernando@gmail.com", nombre: "Fernando", rol: "DUENO", entroEn: new Date() },
    })
  ).id;
  miembro = (
    await prisma.miembro.create({
      data: { hogarId: HOGAR_INICIAL, correo: "angelina@gmail.com", nombre: "Angelina", rol: "MIEMBRO", entroEn: new Date() },
    })
  ).id;
});

const rechaza = (promesa: Promise<unknown>, motivo: RegExp) =>
  expect(promesa).rejects.toSatisfy((e: unknown) => e instanceof ErrorDeHogar && motivo.test(e.message));

describe("leerHogar", () => {
  test("trae el hogar con sus miembros: el dueno primero y las invitaciones al final", async () => {
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "abuela@gmail.com" } });
    const hogar = await leerHogar(HOGAR_INICIAL, prisma);
    expect(hogar.nombre).toBe("Mi hogar");
    expect(hogar.miembros.map((m) => m.correo)).toEqual(["fernando@gmail.com", "angelina@gmail.com", "abuela@gmail.com"]);
    expect(hogar.miembros[2]?.entroEn).toBeNull();
  });

  test("no trae miembros de otro hogar", async () => {
    await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    expect((await leerHogar(HOGAR_INICIAL, prisma)).miembros).toHaveLength(2);
  });

  test("cuenta solo a los que ya entraron", async () => {
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "abuela@gmail.com" } });
    expect(await miembrosQueEntraron(HOGAR_INICIAL, prisma)).toBe(2);
  });
});

describe("invitar", () => {
  test("el dueno invita un correo: queda pendiente, como miembro", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, " Abuela@Gmail.com ", prisma);
    expect(invitado).toMatchObject({ correo: "abuela@gmail.com", rol: "MIEMBRO", entroEn: null });
  });

  test("al entrar con ese Google, la invitacion se acepta y cae en el hogar", async () => {
    await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    const hogar = await registrarEntrada(
      { correo: "abuela@gmail.com", nombre: "Abuela" },
      { listaDeAntes: [], puertaAbierta: false },
      prisma,
    );
    expect(hogar).toMatchObject({ hogarId: HOGAR_INICIAL, rol: "MIEMBRO" });
  });

  test("un miembro que no es dueno no invita", async () => {
    await rechaza(invitarMiembro(HOGAR_INICIAL, miembro, "abuela@gmail.com", prisma), /dueño/);
  });

  test("un correo que ya es parte de un hogar no se puede invitar", async () => {
    await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "ana@gmail.com", prisma), /ya es parte de un hogar/);
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "angelina@gmail.com", prisma), /ya es parte de un hogar/);
  });

  test("algo que no es correo no se invita", async () => {
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "abuela", prisma), /no parece un correo/);
  });

  test("el dueno de otro hogar no invita a este", async () => {
    const ana = await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(invitarMiembro(HOGAR_INICIAL, ana.id, "abuela@gmail.com", prisma), /Ya no eres parte/);
  });
});

describe("sacar", () => {
  test("el dueno saca a un miembro, y sus gastos se quedan sin autor", async () => {
    const cat = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Feria", color: "#15803D", icono: "x" },
    });
    const gasto = await prisma.gasto.create({
      data: {
        hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-03"), descripcion: "Pan", monto: 1_000,
        categoriaId: cat.id, anotadoPorId: miembro,
      },
    });

    await quitarMiembro(HOGAR_INICIAL, dueno, miembro, prisma);

    expect(await prisma.miembro.count({ where: { id: miembro } })).toBe(0);
    expect((await prisma.gasto.findUniqueOrThrow({ where: { id: gasto.id } })).anotadoPorId).toBeNull();
  });

  test("sacar una invitacion pendiente la cancela", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    await quitarMiembro(HOGAR_INICIAL, dueno, invitado.id, prisma);
    expect(await prisma.miembro.count({ where: { correo: "abuela@gmail.com" } })).toBe(0);
  });

  test("un miembro no saca a nadie, ni al dueno", async () => {
    await rechaza(quitarMiembro(HOGAR_INICIAL, miembro, dueno, prisma), /dueño/);
  });

  test("el dueno no se saca a si mismo: para eso esta salir", async () => {
    await rechaza(quitarMiembro(HOGAR_INICIAL, dueno, dueno, prisma), /Salir del hogar/);
  });

  test("no se saca a alguien de otro hogar", async () => {
    const ana = await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(quitarMiembro(HOGAR_INICIAL, dueno, ana.id, prisma), /ya no está en el hogar/);
    expect(await prisma.miembro.count({ where: { id: ana.id } })).toBe(1);
  });
});

describe("pasar el hogar", () => {
  test("el dueno le pasa el hogar a un miembro y queda como miembro", async () => {
    await hacerDueno(HOGAR_INICIAL, dueno, miembro, prisma);
    const roles = Object.fromEntries(
      (await prisma.miembro.findMany({ select: { id: true, rol: true } })).map((m) => [m.id, m.rol]),
    );
    expect(roles).toEqual({ [dueno]: "MIEMBRO", [miembro]: "DUENO" });
  });

  test("no se le pasa a una invitacion pendiente", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    await rechaza(hacerDueno(HOGAR_INICIAL, dueno, invitado.id, prisma), /ya entró/);
  });

  test("un miembro no le pasa el hogar a nadie", async () => {
    await rechaza(hacerDueno(HOGAR_INICIAL, miembro, miembro, prisma), /dueño/);
  });
});

describe("salir", () => {
  test("un miembro sale del hogar", async () => {
    await salirDelHogar(HOGAR_INICIAL, miembro, prisma);
    expect(await prisma.miembro.count({ where: { id: miembro } })).toBe(0);
  });

  test("el dueno no sale sin antes pasar el hogar", async () => {
    await rechaza(salirDelHogar(HOGAR_INICIAL, dueno, prisma), /pásale el hogar/);
    await hacerDueno(HOGAR_INICIAL, dueno, miembro, prisma);
    await salirDelHogar(HOGAR_INICIAL, dueno, prisma);
    expect(await prisma.miembro.count({ where: { id: dueno } })).toBe(0);
  });

  test("quien salio no vuelve a entrar solo, ni estando en la lista del .env", async () => {
    await salirDelHogar(HOGAR_INICIAL, miembro, prisma);
    const vuelve = await registrarEntrada(
      { correo: "angelina@gmail.com", nombre: "Angelina" },
      { listaDeAntes: ["angelina@gmail.com"], puertaAbierta: false },
      prisma,
    );
    expect(vuelve).toBeNull();
  });
});

describe("cambiar el nombre", () => {
  test("el dueno le cambia el nombre al hogar", async () => {
    await renombrarHogar(HOGAR_INICIAL, dueno, "  Casa Galdames  ", prisma);
    expect((await leerHogar(HOGAR_INICIAL, prisma)).nombre).toBe("Casa Galdames");
  });

  test("un miembro no, y un nombre vacio tampoco", async () => {
    await rechaza(renombrarHogar(HOGAR_INICIAL, miembro, "Otro", prisma), /dueño/);
    await rechaza(renombrarHogar(HOGAR_INICIAL, dueno, "   ", prisma), /Escribe un nombre/);
  });
});
