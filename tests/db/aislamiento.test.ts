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
import {
  actualizarDeuda,
  crearDeuda,
  desactivarDeuda,
  eliminarDeuda,
  listarDeudas,
  listarPagosDelMes,
  pagarCuota,
  reactivarDeuda,
  revertirCuota,
} from "@/datos/deudas";
import {
  actualizarCuenta,
  adjuntarBoletaACuenta,
  adjuntarBoletaAGasto,
  crearCuenta,
  eliminarCuenta,
  listarCuentasDelMes,
  pagarCuenta,
  regenerarMensuales,
  revertirPago,
} from "@/datos/cuentas";
import { definirSueldo, eliminarSueldo, listarSueldos, sueldoDelMes } from "@/datos/sueldos";
import { crearAhorro, eliminarAhorro, listarAhorrosHasta } from "@/datos/ahorros";
import { definirDiaInicioMes, leerAjustes } from "@/datos/ajustes";
import { serieHistorica } from "@/datos/historico";
import { aplicarMovimiento, leerDeudasParaMover, leerParaMover } from "@/datos/mover-mes";
import { planearMovimiento } from "@/dominio/mover-mes";
import { CATEGORIA_CUOTAS } from "@/dominio/categorias-base";

/**
 * Dos hogares en la misma base, y ninguno ve ni toca lo del otro.
 *
 * Para cada funcion de datos: lo que lista un hogar es solo suyo, y un id
 * del otro hogar se comporta como si no existiera (no se lee, no se cambia,
 * no se borra). Y la base rechaza un gasto, una cuenta o un presupuesto con
 * la categoria de otro hogar.
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
      B,
      { nombre: "Notebook", montoCuota: 50_000, cuotasTotales: 12, primeraCuota: "2026-11", nota: null },
      prisma,
    );
    await pagarCuota(B, deuda.id, "2026-11", "2026-11-05", 50_000, null, prisma);
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

describe("cuentas", () => {
  const MES = "2026-11";
  const cuenta = (hogarId: string, categoriaId: string, nombre = "Luz", mensual = false) =>
    crearCuenta(
      hogarId,
      { nombre, monto: 30_000, mes: MES, diaVencimiento: 10, categoriaId, mensual, nota: null },
      prisma,
    );

  test("cada hogar lista solo sus cuentas, aunque se llamen igual el mismo mes", async () => {
    const cA = await cuenta(A, (await categoria(A)).id);
    const cB = await cuenta(B, (await categoria(B)).id);
    expect((await listarCuentasDelMes(A, MES, prisma)).map((c) => c.id)).toEqual([cA.id]);
    expect((await listarCuentasDelMes(B, MES, prisma)).map((c) => c.id)).toEqual([cB.id]);
  });

  test("no se puede crear una cuenta con la categoria de otro hogar", async () => {
    const deB = await categoria(B);
    await expect(cuenta(A, deB.id)).rejects.toThrow();
    expect(await prisma.cuenta.count()).toBe(0);
  });

  test("una cuenta de otro hogar no se edita, no se paga, no se borra ni recibe boleta", async () => {
    const cB = await cuenta(B, (await categoria(B)).id);
    await expect(
      actualizarCuenta(
        A,
        { id: cB.id, nombre: "Otra", monto: 1, diaVencimiento: null, categoriaId: cB.categoria.id, mensual: false, nota: null },
        prisma,
      ),
    ).rejects.toThrow(/ya no existe/);
    await expect(pagarCuenta(A, cB.id, "2026-11-05", 30_000, null, prisma)).rejects.toThrow();
    await expect(eliminarCuenta(A, cB.id, prisma)).rejects.toThrow();
    await expect(adjuntarBoletaACuenta(A, cB.id, "x.jpg", prisma)).rejects.toThrow();

    const intacta = await prisma.cuenta.findUniqueOrThrow({ where: { id: cB.id } });
    expect(intacta).toMatchObject({ nombre: "Luz", pagadaEn: null, boletaArchivo: null });
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("el pago de una cuenta de otro hogar no se deshace", async () => {
    const cB = await cuenta(B, (await categoria(B)).id);
    await pagarCuenta(B, cB.id, "2026-11-05", 31_000, null, prisma);
    await expect(revertirPago(A, cB.id, prisma)).rejects.toThrow();
    expect((await prisma.cuenta.findUniqueOrThrow({ where: { id: cB.id } })).pagadaEn).not.toBeNull();
  });

  test("pagar una cuenta crea el gasto en su mismo hogar", async () => {
    const cB = await cuenta(B, (await categoria(B)).id);
    const pagada = await pagarCuenta(B, cB.id, "2026-11-05", 31_000, null, prisma);
    const gasto = await prisma.gasto.findUniqueOrThrow({ where: { id: pagada.gastoId! } });
    expect(gasto.hogarId).toBe(B);
  });

  test("la boleta de un gasto de otro hogar no se cambia", async () => {
    const gB = await gasto(B, (await categoria(B)).id);
    await expect(adjuntarBoletaAGasto(A, gB.id, "x.jpg", prisma)).rejects.toThrow();
    expect((await prisma.gasto.findUniqueOrThrow({ where: { id: gB.id } })).boletaArchivo).toBeNull();
  });

  test("las mensuales se copian dentro de cada hogar, nunca de un hogar a otro", async () => {
    await crearCuenta(
      B,
      { nombre: "Arriendo", monto: 400_000, mes: "2026-10", diaVencimiento: 5, categoriaId: (await categoria(B)).id, mensual: true, nota: null },
      prisma,
    );
    expect(await regenerarMensuales(A, MES, prisma)).toBe(0);
    expect(await listarCuentasDelMes(A, MES, prisma)).toEqual([]);

    expect(await regenerarMensuales(B, MES, prisma)).toBe(1);
    const copia = await prisma.cuenta.findFirstOrThrow({ where: { nombre: "Arriendo", mes: new Date("2026-11-01") } });
    expect(copia.hogarId).toBe(B);
  });
});

describe("deudas y cuotas", () => {
  const MES = "2026-11";
  const deuda = (hogarId: string, nombre = "Notebook") =>
    crearDeuda(hogarId, { nombre, montoCuota: 50_000, cuotasTotales: 12, primeraCuota: MES, nota: null }, prisma);

  test("cada hogar lista solo sus deudas", async () => {
    const dA = await deuda(A);
    const dB = await deuda(B);
    expect((await listarDeudas(A, prisma)).map((d) => d.id)).toEqual([dA.id]);
    expect((await listarDeudas(B, prisma)).map((d) => d.id)).toEqual([dB.id]);
  });

  test("una deuda de otro hogar no se desactiva, reactiva, edita ni borra", async () => {
    const dB = await deuda(B);
    await expect(desactivarDeuda(A, dB.id, prisma)).rejects.toThrow();
    await expect(reactivarDeuda(A, dB.id, prisma)).rejects.toThrow();
    await expect(
      actualizarDeuda(A, { id: dB.id, nombre: "X", montoCuota: 1, cuotasTotales: 1, primeraCuota: MES, nota: null }, prisma),
    ).rejects.toThrow(/ya no existe/);
    await expect(eliminarDeuda(A, dB.id, prisma)).rejects.toThrow();
    expect(await prisma.deuda.findUniqueOrThrow({ where: { id: dB.id } })).toMatchObject({ nombre: "Notebook", activa: true });
  });

  test("la cuota de una deuda de otro hogar no se paga", async () => {
    const dB = await deuda(B);
    await expect(pagarCuota(A, dB.id, MES, "2026-11-05", 50_000, null, prisma)).rejects.toThrow();
    expect(await prisma.cuotaPagada.count()).toBe(0);
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("pagar una cuota deja el gasto y la categoria de deudas en el hogar de la deuda", async () => {
    const dB = await deuda(B);
    await pagarCuota(B, dB.id, MES, "2026-11-05", 50_000, null, prisma);
    const gastoB = await prisma.gasto.findFirstOrThrow({ include: { categoria: true } });
    expect(gastoB.hogarId).toBe(B);
    expect(gastoB.categoria).toMatchObject({ hogarId: B, nombre: CATEGORIA_CUOTAS });
    expect(await prisma.categoria.count({ where: { hogarId: A } })).toBe(0);
  });

  test("el pago de otro hogar no se lista ni se deshace", async () => {
    const dB = await deuda(B);
    await pagarCuota(B, dB.id, MES, "2026-11-05", 50_000, null, prisma);
    expect(await listarPagosDelMes(A, MES, prisma)).toEqual([]);
    expect(await listarPagosDelMes(B, MES, prisma)).toHaveLength(1);

    await revertirCuota(A, dB.id, MES, prisma);
    expect(await prisma.cuotaPagada.count()).toBe(1);
    expect(await prisma.gasto.count()).toBe(1);
  });
});

describe("sueldos", () => {
  test("cada hogar tiene su sueldo, y borrar el de uno no toca el del otro", async () => {
    await definirSueldo(A, "2026-11", 1_000_000, null, prisma);
    await definirSueldo(B, "2026-11", 800_000, null, prisma);
    expect(await sueldoDelMes(A, "2026-11", prisma)).toBe(1_000_000);
    expect(await sueldoDelMes(B, "2026-11", prisma)).toBe(800_000);
    expect((await listarSueldos(A, prisma)).map((s) => s.monto)).toEqual([1_000_000]);

    await eliminarSueldo(A, "2026-11", prisma);
    expect(await sueldoDelMes(A, "2026-11", prisma)).toBeNull();
    expect(await sueldoDelMes(B, "2026-11", prisma)).toBe(800_000);
  });
});

describe("ahorros", () => {
  test("cada hogar lista solo sus ahorros, y un ahorro de otro hogar no se borra", async () => {
    const aA = await crearAhorro(A, { mes: "2026-11", monto: 40_000, nota: null }, prisma);
    const aB = await crearAhorro(B, { mes: "2026-11", monto: 70_000, nota: null }, prisma);
    expect((await listarAhorrosHasta(A, "2026-11", prisma)).map((a) => a.id)).toEqual([aA.id]);

    await eliminarAhorro(A, aB.id, prisma);
    expect(await prisma.ahorro.count({ where: { id: aB.id } })).toBe(1);
  });
});

describe("ajustes", () => {
  test("cada hogar tiene su dia de inicio", async () => {
    await definirDiaInicioMes(A, 27, prisma);
    expect(await leerAjustes(A, prisma)).toEqual({ diaInicioMes: 27 });
    expect(await leerAjustes(B, prisma)).toEqual({ diaInicioMes: 1 });

    await definirDiaInicioMes(B, 5, prisma);
    expect(await leerAjustes(A, prisma)).toEqual({ diaInicioMes: 27 });
  });
});

describe("el historico de Informes", () => {
  test("suma solo los gastos y el sueldo del hogar", async () => {
    await gasto(A, (await categoria(A)).id, "2026-10-10");
    await gasto(B, (await categoria(B)).id, "2026-10-11");
    await definirSueldo(A, "2026-10", 1_000_000, null, prisma);
    await definirSueldo(B, "2026-10", 5_000_000, null, prisma);

    const [octubre] = (await serieHistorica(A, "2026-10", 1, prisma)).slice(-1);
    expect(octubre).toEqual({ mes: "2026-10", gastos: 12_000, ingresos: 1_000_000 });
  });
});

describe("mover lo de un mes a otro", () => {
  test("lee solo lo del hogar, y con ids de otro hogar no mueve nada", async () => {
    const catB = await categoria(B);
    await crearCuenta(
      B,
      { nombre: "Luz", monto: 30_000, mes: "2026-10", diaVencimiento: 10, categoriaId: catB.id, mensual: false, nota: null },
      prisma,
    );
    await crearAhorro(B, { mes: "2026-10", monto: 10_000, nota: null }, prisma);

    const deA = await leerParaMover(A, "2026-10", prisma);
    expect(deA).toEqual({ cuentas: [], presupuestos: [], ahorros: [] });

    // Un plan armado con lo de B, aplicado como si fuera de A: no mueve nada.
    const planDeB = planearMovimiento(
      await leerParaMover(B, "2026-10", prisma),
      await leerParaMover(B, "2026-11", prisma),
      { desde: "2026-10", hasta: "2026-11" },
      await leerDeudasParaMover(B, prisma),
    );
    await aplicarMovimiento(A, planDeB, "2026-11", prisma);
    expect(await prisma.cuenta.count({ where: { hogarId: B, mes: new Date("2026-10-01") } })).toBe(1);
    expect(await prisma.ahorro.count({ where: { hogarId: B, mes: new Date("2026-10-01") } })).toBe(1);
  });
});
