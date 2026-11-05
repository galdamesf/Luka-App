import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDeLaNube, clienteDePrueba, limpiar } from "./base";
import { TABLAS, contar, loQueSePierde } from "@/dominio/subir-a-la-nube";
import { copiarDatos, leerTodo, migracionesAplicadas, tablasDistintas } from "@/datos/subir-a-la-nube";
import { fechaDesdeISO } from "@/lib/fecha";

/**
 * Copiar tu Mac a la nube (npm run nube:subir), con dos bases de pruebas de
 * verdad: la _test hace de tu Mac y la _nube_test de la nube.
 */

let mac: PrismaClient;
let nube: PrismaClient;

beforeAll(async () => {
  mac = clienteDePrueba();
  nube = clienteDeLaNube();
  await Promise.all([mac.$connect(), nube.$connect()]);
});

afterAll(async () => {
  await Promise.all([mac.$disconnect(), nube.$disconnect()]);
});

beforeEach(async () => {
  await limpiar(mac);
  await limpiar(nube);
});

const YO = "yo@gmail.com";
const MES = fechaDesdeISO("2026-11-01");

/** Un poco de todo en tu Mac: dos hogares, una invitacion y cada tabla con algo. */
async function llenarMac() {
  const dueno = await mac.miembro.create({
    data: { id: "m-yo", hogarId: HOGAR_INICIAL, correo: YO, nombre: "Yo", rol: "DUENO", entroEn: new Date("2026-11-01T12:00:00Z") },
  });
  await mac.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "pareja@gmail.com" } });
  await mac.ajustes.create({ data: { hogarId: HOGAR_INICIAL, diaInicioMes: 27 } });

  const super_ = await mac.categoria.create({
    data: { hogarId: HOGAR_INICIAL, nombre: "Supermercado", color: "#15803D", icono: "shopping-cart", esencial: true, orden: 1 },
  });
  const luz = await mac.categoria.create({
    data: { hogarId: HOGAR_INICIAL, nombre: "Luz", color: "#CA8A04", icono: "zap", activa: false },
  });

  const conBoleta = await mac.gasto.create({
    data: {
      hogarId: HOGAR_INICIAL,
      fecha: fechaDesdeISO("2026-11-03"),
      descripcion: "Feria",
      monto: 12_000,
      medioPago: "EFECTIVO",
      notas: "con ñ y tildes: café",
      categoriaId: super_.id,
      boletaArchivo: `${"a".repeat(32)}.jpg`,
      anotadoPorId: dueno.id,
    },
  });
  const pagoLuz = await mac.gasto.create({
    data: { hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-05"), descripcion: "Luz", monto: 30_000, categoriaId: luz.id },
  });
  await mac.cuenta.create({
    data: {
      hogarId: HOGAR_INICIAL,
      nombre: "Luz",
      monto: 30_000,
      mes: MES,
      diaVencimiento: 10,
      categoriaId: luz.id,
      pagadaEn: fechaDesdeISO("2026-11-05"),
      gastoId: pagoLuz.id,
      mensual: true,
      boletaArchivo: `${"b".repeat(32)}.pdf`,
    },
  });

  const deuda = await mac.deuda.create({
    data: { hogarId: HOGAR_INICIAL, nombre: "Notebook", montoCuota: 50_000, cuotasTotales: 12, primeraCuota: fechaDesdeISO("2026-09-01") },
  });
  const cuota = await mac.gasto.create({
    data: { hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-02"), descripcion: "Cuota", monto: 50_000, categoriaId: super_.id },
  });
  await mac.cuotaPagada.create({
    data: { deudaId: deuda.id, mes: MES, pagadaEn: fechaDesdeISO("2026-11-02"), monto: 50_000, gastoId: cuota.id },
  });

  await mac.presupuesto.create({ data: { hogarId: HOGAR_INICIAL, categoriaId: super_.id, mes: MES, monto: 400_000 } });
  await mac.sueldo.create({ data: { hogarId: HOGAR_INICIAL, miembroId: dueno.id, monto: 1_000_000, vigenteDesde: MES } });
  // El sueldo cerrado de alguien que ya salio del hogar: sin miembro, con su ultimo mes.
  await mac.sueldo.create({ data: { hogarId: HOGAR_INICIAL, monto: 300_000, vigenteDesde: fechaDesdeISO("2026-09-01"), vigenteHasta: fechaDesdeISO("2026-10-01") } });
  await mac.ahorro.create({ data: { hogarId: HOGAR_INICIAL, mes: MES, monto: 100_000, nota: "Vacaciones" } });

  // Otro hogar, con su dueno y una categoria.
  await mac.hogar.create({
    data: {
      id: "h-amigo",
      nombre: "Casa de un amigo",
      miembros: { create: { correo: "amigo@gmail.com", rol: "DUENO", entroEn: new Date() } },
      categorias: { create: { nombre: "Supermercado", color: "#15803D", icono: "shopping-cart" } },
    },
  });

  return { conBoleta };
}

/** La nube como queda despues del primer deploy y de entrar una vez con tu Gmail. */
async function nubeRecienEstrenada() {
  const yo = await nube.miembro.create({
    data: { hogarId: HOGAR_INICIAL, correo: YO, nombre: "Yo", rol: "DUENO", entroEn: new Date() },
  });
  // Un codigo para borrar el hogar pedido alla: no se copia, se va.
  await nube.codigoDeBorrado.create({
    data: { hogarId: HOGAR_INICIAL, miembroId: yo.id, huella: "f".repeat(64), expiraEn: new Date(Date.now() + 600_000) },
  });
  return yo;
}

describe("migracionesAplicadas", () => {
  test("las dos bases de prueba tienen las mismas, y son las de prisma/migrations", async () => {
    const enMac = await migracionesAplicadas(mac);
    expect(enMac.length).toBeGreaterThan(10);
    expect(enMac).toContain("20261104050000_codigo_de_borrado");
    expect(await migracionesAplicadas(nube)).toEqual(enMac);
  });
});

describe("copiarDatos", () => {
  test("la nube queda identica a tu Mac, fila por fila, con los mismos ids y fechas", async () => {
    const { conBoleta } = await llenarMac();
    const yoEnLaNube = await nubeRecienEstrenada();

    const datos = await leerTodo(mac);
    expect(loQueSePierde(datos, await leerTodo(nube)).filas).toEqual([]);

    await copiarDatos(datos, nube, { lote: 2 }); // de a 2, para probar los lotes
    expect(await tablasDistintas(datos, nube)).toEqual([]);

    const conteo = contar(await leerTodo(nube));
    expect(conteo).toEqual(contar(datos));
    expect(conteo.hogar).toBe(2);
    expect(conteo.gasto).toBe(3);

    // Eres el mismo de tu Mac, no el que se creo al entrar a la nube.
    const yo = await nube.miembro.findUniqueOrThrow({ where: { correo: YO } });
    expect(yo.id).toBe("m-yo");
    expect(yo.id).not.toBe(yoEnLaNube.id);
    expect(await nube.codigoDeBorrado.count()).toBe(0);

    // Las fechas de modificacion no se reescriben con la hora de la copia.
    const gasto = await nube.gasto.findUniqueOrThrow({ where: { id: conBoleta.id } });
    expect(gasto.actualizadoEn).toEqual(conBoleta.actualizadoEn);
    expect(gasto.creadoEn).toEqual(conBoleta.creadoEn);
    expect(gasto.notas).toBe("con ñ y tildes: café");
  });

  test("copiar dos veces da lo mismo", async () => {
    await llenarMac();
    const datos = await leerTodo(mac);
    await copiarDatos(datos, nube);
    await copiarDatos(datos, nube);
    expect(await tablasDistintas(datos, nube)).toEqual([]);
  });

  test("tu Mac no se toca", async () => {
    await llenarMac();
    const antes = await leerTodo(mac);
    await copiarDatos(antes, nube);
    expect(await leerTodo(mac)).toEqual(antes);
  });

  test("si algo falla a mitad, la nube queda exactamente como estaba", async () => {
    await llenarMac();
    await nubeRecienEstrenada();
    const nubeAntes = await leerTodo(nube);

    // Una regla que solo tiene la nube hace fallar el ultimo INSERT de gastos,
    // cuando ya se borro todo y se copiaron hogares, miembros y categorias.
    await nube.$executeRawUnsafe('ALTER TABLE "gastos" ADD CONSTRAINT "prueba_monto_chico" CHECK (monto < 40000)');
    try {
      await expect(copiarDatos(await leerTodo(mac), nube)).rejects.toThrow();
    } finally {
      await nube.$executeRawUnsafe('ALTER TABLE "gastos" DROP CONSTRAINT "prueba_monto_chico"');
    }

    expect(await leerTodo(nube)).toEqual(nubeAntes);
    expect(await nube.codigoDeBorrado.count()).toBe(1);
  });
});

describe("tablasDistintas", () => {
  test("detecta una sola columna distinta en una sola fila", async () => {
    const { conBoleta } = await llenarMac();
    const datos = await leerTodo(mac);
    await copiarDatos(datos, nube);

    await nube.$executeRaw`UPDATE "gastos" SET "monto" = "monto" + 1 WHERE "id" = ${conBoleta.id}`;
    expect(await tablasDistintas(datos, nube)).toEqual(["gasto"]);
  });
});

describe("loQueSePierde, con lo que de verdad hay en la nube", () => {
  test("alguien que ya entro a la nube y no esta en tu Mac aparece, con su correo", async () => {
    await llenarMac();
    await nubeRecienEstrenada();
    await nube.hogar.create({
      data: { nombre: "Su hogar", miembros: { create: { correo: "otra@gmail.com", rol: "DUENO", entroEn: new Date() } } },
    });

    const perdida = loQueSePierde(await leerTodo(mac), await leerTodo(nube));
    expect(perdida.correos).toEqual(["otra@gmail.com"]);
    expect(perdida.filas.map((f) => f.tabla)).toEqual(["hogar", "miembro"]);
  });

  test("lee las once tablas", async () => {
    const datos = await leerTodo(nube);
    expect(Object.keys(datos).sort()).toEqual([...TABLAS].sort());
  });
});
