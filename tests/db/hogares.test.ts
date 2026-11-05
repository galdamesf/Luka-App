import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
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

async function crearCategoria(hogarId: string = HOGAR_INICIAL, nombre = "Supermercado") {
  return prisma.categoria.create({
    data: { hogarId, nombre, color: "#15803D", icono: "shopping-cart", esencial: true },
  });
}

async function crearGasto(categoriaId: string, datos: { anotadoPorId?: string } = {}) {
  return prisma.gasto.create({
    data: {
      hogarId: HOGAR_INICIAL,
      fecha: fechaDesdeISO("2026-11-03"),
      descripcion: "Feria",
      monto: 12_000,
      categoriaId,
      ...datos,
    },
  });
}

describe("el hogar es obligatorio", () => {
  // Antes de que todo el codigo pasara el hogar, cada tabla ponia el hogar
  // inicial por omision. Ya no: una fila sin hogar se rechaza, en vez de caer
  // callada en «Mi hogar».
  const TABLAS = ["categorias", "gastos", "sueldos", "deudas", "cuentas", "presupuestos", "ahorros", "ajustes"];

  test("en cada tabla, hogar_id es obligatorio y no tiene valor por omision", async () => {
    const columnas = await prisma.$queryRaw<{ tabla: string; nula: string; omision: string | null }[]>`
      SELECT table_name::text AS tabla, is_nullable::text AS nula, column_default::text AS omision
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'hogar_id'
    `;
    for (const tabla of TABLAS) {
      const columna = columnas.find((c) => c.tabla === tabla);
      expect(columna, `${tabla} no tiene hogar_id`).toBeDefined();
      expect(columna, tabla).toMatchObject({ nula: "NO", omision: null });
    }
  });

  // El mensaje cambia segun el motor de Prisma: unos nombran la columna y
  // otros solo dan el codigo de Postgres para "falta un valor obligatorio"
  // (23502). Cualquiera de los dos dice lo mismo: la fila no entro.
  const FALTA_OBLIGATORIO = /23502|null value in column "hogar_id"/;

  test.each([
    ["categorias", `INSERT INTO categorias (id, nombre, color, icono) VALUES ('c', 'X', '#15803D', 'x')`],
    ["sueldos", `INSERT INTO sueldos (id, monto, vigente_desde, actualizado_en) VALUES ('s', 1, '2026-11-01', now())`],
    ["deudas", `INSERT INTO deudas (id, nombre, monto_cuota, cuotas_totales, primera_cuota, actualizado_en) VALUES ('d', 'X', 1, 1, '2026-11-01', now())`],
    ["ahorros", `INSERT INTO ahorros (id, mes, monto, actualizado_en) VALUES ('a', '2026-11-01', 1, now())`],
    ["ajustes", `INSERT INTO ajustes (dia_inicio_mes, actualizado_en) VALUES (1, now())`],
  ])("%s sin hogar no entra", async (_tabla, sql) => {
    await expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow(FALTA_OBLIGATORIO);
  });

  test("lo creado con su hogar queda en ese hogar", async () => {
    const categoria = await crearCategoria();
    const gasto = await crearGasto(categoria.id);
    expect(categoria.hogarId).toBe(HOGAR_INICIAL);
    expect(gasto.hogarId).toBe(HOGAR_INICIAL);
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

  test("cada hogar tiene a lo mas un juego de ajustes, y cada uno el suyo", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    await prisma.ajustes.create({ data: { hogarId: HOGAR_INICIAL, diaInicioMes: 27 } });
    await prisma.ajustes.create({ data: { hogarId: otro.id, diaInicioMes: 5 } });
    await expect(prisma.ajustes.create({ data: { hogarId: HOGAR_INICIAL, diaInicioMes: 1 } })).rejects.toThrow();
    expect(await prisma.ajustes.count()).toBe(2);
  });
});

describe("lo unico pasa a ser unico dentro de cada hogar", () => {
  test("dos hogares pueden tener cada uno su «Supermercado»; uno solo, no dos", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    await crearCategoria();
    await crearCategoria(otro.id);
    expect(await prisma.categoria.count({ where: { nombre: "Supermercado" } })).toBe(2);
    await expect(crearCategoria(otro.id)).rejects.toThrow();
  });

  test("cada persona tiene un sueldo por mes: dos en el mismo hogar, sí; dos de la misma, no", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    const yo = await miembroDePrueba(prisma);
    const ella = await miembroDePrueba(prisma, { rol: "MIEMBRO" });
    const ana = await miembroDePrueba(prisma, { hogarId: otro.id });
    await prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: yo, monto: 1_000_000, vigenteDesde: MES } });
    await prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: ella, monto: 700_000, vigenteDesde: MES } });
    await prisma.sueldo.create({ data: { hogarId: otro.id, miembroId: ana, monto: 800_000, vigenteDesde: MES } });
    await expect(
      prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: yo, monto: 5, vigenteDesde: MES } }),
    ).rejects.toThrow();
  });

  test("un sueldo cerrado no puede seguir siendo de alguien", async () => {
    const yo = await miembroDePrueba(prisma);
    await expect(
      prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: yo, monto: 1, vigenteDesde: MES, vigenteHasta: MES } }),
    ).rejects.toThrow(/sueldos_cerrado_sin_miembro/);
    await prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, monto: 1, vigenteDesde: MES, vigenteHasta: MES } });
  });

  test("el ultimo mes de un sueldo cerrado es el dia 1 y no queda antes del primero", async () => {
    const hasta = (iso: string) => ({ hogarId: HOGAR_INICIAL, monto: 1, vigenteDesde: MES, vigenteHasta: new Date(iso) });
    await expect(prisma.sueldo.create({ data: hasta("2026-12-15T00:00:00Z") })).rejects.toThrow(/sueldos_vigente_hasta_dia_uno/);
    await expect(prisma.sueldo.create({ data: hasta("2026-10-01T00:00:00Z") })).rejects.toThrow(/sueldos_hasta_no_antes_de_desde/);
  });

  test("no se puede borrar a alguien con su sueldo abierto: primero se cierra", async () => {
    const ella = await miembroDePrueba(prisma, { rol: "MIEMBRO" });
    await prisma.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: ella, monto: 1, vigenteDesde: MES } });
    await expect(prisma.miembro.delete({ where: { id: ella } })).rejects.toThrow();
  });

  test("la misma cuenta del mismo mes puede estar en dos hogares, no dos veces en uno", async () => {
    const otro = await prisma.hogar.create({ data: { nombre: "Casa de Ana" } });
    const mia = await crearCategoria();
    const suya = await crearCategoria(otro.id);
    await prisma.cuenta.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Luz", monto: 30_000, mes: MES, categoriaId: mia.id } });
    await prisma.cuenta.create({
      data: { hogarId: otro.id, nombre: "Luz", monto: 25_000, mes: MES, categoriaId: suya.id },
    });
    await expect(
      prisma.cuenta.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Luz", monto: 1, mes: MES, categoriaId: mia.id } }),
    ).rejects.toThrow();
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
