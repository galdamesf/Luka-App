import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  listarGastosDelMes,
  mesesConGastos,
  obtenerGasto,
} from "@/datos/gastos";
import { desactivarCategoria, listarCategoriasActivas, reactivarCategoria } from "@/datos/categorias";
import {
  actualizarPresupuesto,
  crearPresupuesto,
  eliminarPresupuesto,
  listarPresupuestosDelMes,
} from "@/datos/presupuestos";
import { crearDeuda, pagarCuota } from "@/datos/deudas";

/**
 * Dos hogares en la misma base, y ninguno ve ni toca lo del otro.
 *
 * Para cada funcion de gastos, categorias y presupuestos: lo que lista un
 * hogar es solo suyo, y un id del otro hogar se comporta como si no
 * existiera (no se lee, no se cambia, no se borra). Y la base rechaza un
 * gasto o un presupuesto con la categoria de otro hogar.
 */

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const A = HOGAR_INICIAL;
const B = "hogar-de-ana";

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.hogar.create({ data: { id: B, nombre: "Casa de Ana" } });
});

async function categoria(hogarId: string, nombre = "Supermercado") {
  return prisma.categoria.create({
    data: { hogarId, nombre, color: "#15803D", icono: "shopping-cart", esencial: true },
  });
}

async function gasto(hogarId: string, categoriaId: string, fecha = "2026-11-03", descripcion = "Feria") {
  return crearGasto(
    hogarId,
    { fecha, descripcion, monto: 12_000, categoriaId, medioPago: "DEBITO", notas: null },
    prisma,
  );
}

describe("gastos", () => {
  test("cada hogar lista solo sus gastos", async () => {
    const deA = await gasto(A, (await categoria(A)).id, "2026-11-03", "De A");
    const deB = await gasto(B, (await categoria(B)).id, "2026-11-04", "De B");

    expect((await listarGastosDelMes(A, "2026-11", prisma)).map((g) => g.id)).toEqual([deA.id]);
    expect((await listarGastosDelMes(B, "2026-11", prisma)).map((g) => g.id)).toEqual([deB.id]);
  });

  test("el gasto queda en su hogar y sabe quien lo anoto", async () => {
    const miembro = await prisma.miembro.create({ data: { hogarId: A, correo: "f@gmail.com", rol: "DUENO" } });
    const cat = await categoria(A);
    const nuevo = await crearGasto(
      A,
      {
        fecha: "2026-11-03",
        descripcion: "Pan",
        monto: 2_500,
        categoriaId: cat.id,
        medioPago: "EFECTIVO",
        notas: null,
        anotadoPorId: miembro.id,
      },
      prisma,
    );
    const fila = await prisma.gasto.findUniqueOrThrow({ where: { id: nuevo.id } });
    expect(fila.hogarId).toBe(A);
    expect(fila.anotadoPorId).toBe(miembro.id);
  });

  test("no se puede anotar un gasto con la categoria de otro hogar", async () => {
    const deB = await categoria(B);
    await expect(gasto(A, deB.id)).rejects.toThrow();
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("un gasto de otro hogar no se lee", async () => {
    const deB = await gasto(B, (await categoria(B)).id);
    expect(await obtenerGasto(A, deB.id, prisma)).toBeNull();
    expect(await obtenerGasto(B, deB.id, prisma)).not.toBeNull();
  });

  test("un gasto de otro hogar no se cambia", async () => {
    const deB = await gasto(B, (await categoria(B)).id);
    await expect(actualizarGasto(A, deB.id, { monto: 1 }, prisma)).rejects.toThrow();
    expect((await prisma.gasto.findUniqueOrThrow({ where: { id: deB.id } })).monto).toBe(12_000);
  });

  test("un gasto de otro hogar no se borra", async () => {
    const deB = await gasto(B, (await categoria(B)).id);
    await expect(eliminarGasto(A, deB.id, prisma)).rejects.toThrow();
    expect(await prisma.gasto.count({ where: { id: deB.id } })).toBe(1);
  });

  test("intentar borrar el pago de cuota de otro hogar no deshace su pago", async () => {
    const deuda = await crearDeuda(
      { nombre: "Notebook", montoCuota: 50_000, cuotasTotales: 12, primeraCuota: "2026-11", nota: null },
      prisma,
    );
    // La deuda se crea en el hogar inicial (A); se pasa a B para la prueba.
    await prisma.deuda.update({ where: { id: deuda.id }, data: { hogarId: B } });
    await pagarCuota(deuda.id, "2026-11", "2026-11-05", 50_000, null, prisma);
    const pago = await prisma.cuotaPagada.findFirstOrThrow({ where: { deudaId: deuda.id } });

    await expect(eliminarGasto(A, pago.gastoId!, prisma)).rejects.toThrow();

    expect(await prisma.cuotaPagada.count({ where: { id: pago.id } })).toBe(1);
    expect(await prisma.gasto.count({ where: { id: pago.gastoId!, hogarId: B } })).toBe(1);
  });

  test("dentro de su hogar, borrar sigue funcionando", async () => {
    const deA = await gasto(A, (await categoria(A)).id);
    await eliminarGasto(A, deA.id, prisma);
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("los meses con gastos son los del hogar", async () => {
    await gasto(A, (await categoria(A)).id, "2026-10-15");
    await gasto(B, (await categoria(B)).id, "2026-09-15");
    expect(await mesesConGastos(A, prisma)).toEqual(["2026-10"]);
    expect(await mesesConGastos(B, prisma)).toEqual(["2026-09"]);
  });
});

describe("categorias", () => {
  test("cada hogar lista solo sus categorias, aunque se llamen igual", async () => {
    const deA = await categoria(A);
    const deB = await categoria(B);
    expect((await listarCategoriasActivas(A, prisma)).map((c) => c.id)).toEqual([deA.id]);
    expect((await listarCategoriasActivas(B, prisma)).map((c) => c.id)).toEqual([deB.id]);
  });

  test("una categoria de otro hogar no se desactiva ni se reactiva", async () => {
    const deB = await categoria(B);
    await expect(desactivarCategoria(A, deB.id, prisma)).rejects.toThrow();
    expect((await prisma.categoria.findUniqueOrThrow({ where: { id: deB.id } })).activa).toBe(true);

    await desactivarCategoria(B, deB.id, prisma);
    await expect(reactivarCategoria(A, deB.id, prisma)).rejects.toThrow();
    expect((await prisma.categoria.findUniqueOrThrow({ where: { id: deB.id } })).activa).toBe(false);
  });
});

describe("presupuestos", () => {
  const MES = "2026-11";

  test("cada hogar lista solo sus presupuestos, aunque sean de la misma categoria y mes", async () => {
    const pA = await crearPresupuesto(A, { categoriaId: (await categoria(A)).id, mes: MES, monto: 100_000 }, prisma);
    const pB = await crearPresupuesto(B, { categoriaId: (await categoria(B)).id, mes: MES, monto: 200_000 }, prisma);
    expect((await listarPresupuestosDelMes(A, MES, prisma)).map((p) => p.id)).toEqual([pA.id]);
    expect((await listarPresupuestosDelMes(B, MES, prisma)).map((p) => p.id)).toEqual([pB.id]);
  });

  test("no se puede crear un presupuesto con la categoria de otro hogar", async () => {
    const deB = await categoria(B);
    await expect(crearPresupuesto(A, { categoriaId: deB.id, mes: MES, monto: 1_000 }, prisma)).rejects.toThrow();
    expect(await prisma.presupuesto.count()).toBe(0);
  });

  test("un presupuesto de otro hogar no se cambia: para este hogar no existe", async () => {
    const pB = await crearPresupuesto(B, { categoriaId: (await categoria(B)).id, mes: MES, monto: 200_000 }, prisma);
    await expect(actualizarPresupuesto(A, { id: pB.id, monto: 1 }, prisma)).rejects.toThrow(/ya no existe/);
    expect((await prisma.presupuesto.findUniqueOrThrow({ where: { id: pB.id } })).monto).toBe(200_000);
  });

  test("un presupuesto de otro hogar no se borra", async () => {
    const pB = await crearPresupuesto(B, { categoriaId: (await categoria(B)).id, mes: MES, monto: 200_000 }, prisma);
    await eliminarPresupuesto(A, pB.id, prisma);
    expect(await prisma.presupuesto.count({ where: { id: pB.id } })).toBe(1);
  });
});
