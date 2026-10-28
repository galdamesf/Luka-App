import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import { fechaDesdeISO, isoDesdeFecha, rangoDelMesISO } from "@/lib/fecha";

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

async function crearCategoria(nombre = "Supermercado") {
  return prisma.categoria.create({
    data: { nombre, color: "#15803D", icono: "shopping-cart", esencial: true },
  });
}

describe("categorias", () => {
  test("se crea con los valores por omision esperados", async () => {
    const categoria = await crearCategoria();
    expect(categoria.activa).toBe(true);
    expect(categoria.orden).toBe(0);
    expect(categoria.esencial).toBe(true);
  });

  test("el nombre es unico", async () => {
    await crearCategoria("Transporte");
    await expect(crearCategoria("Transporte")).rejects.toThrow();
  });
});

describe("gastos", () => {
  test("se guarda y se lee con el medio de pago por omision", async () => {
    const categoria = await crearCategoria();
    const gasto = await prisma.gasto.create({
      data: {
        fecha: fechaDesdeISO("2026-10-15"),
        descripcion: "Feria del martes",
        monto: 23450,
        categoriaId: categoria.id,
      },
    });

    expect(gasto.monto).toBe(23450);
    expect(gasto.medioPago).toBe("DEBITO");
    expect(gasto.notas).toBeNull();
    expect(typeof gasto.monto).toBe("number");
  });

  test("la fecha vuelve de Postgres sin correrse de dia", async () => {
    const categoria = await crearCategoria();
    // El primero del mes es el caso que revienta: en Chile la medianoche UTC
    // del 1 cae el 30 o 31 del mes anterior.
    for (const iso of ["2026-10-01", "2026-10-31", "2027-01-01", "2026-12-31"]) {
      const gasto = await prisma.gasto.create({
        data: {
          fecha: fechaDesdeISO(iso),
          descripcion: `Prueba ${iso}`,
          monto: 1000,
          categoriaId: categoria.id,
        },
      });
      const leido = await prisma.gasto.findUniqueOrThrow({ where: { id: gasto.id } });
      expect(isoDesdeFecha(leido.fecha)).toBe(iso);
    }
  });

  test("rechaza monto cero o negativo", async () => {
    const categoria = await crearCategoria();
    for (const monto of [0, -1, -45990]) {
      await expect(
        prisma.gasto.create({
          data: {
            fecha: fechaDesdeISO("2026-10-15"),
            descripcion: "Monto malo",
            monto,
            categoriaId: categoria.id,
          },
        }),
      ).rejects.toThrow();
    }
  });

  test("rechaza una descripcion mas larga que el campo", async () => {
    const categoria = await crearCategoria();
    await expect(
      prisma.gasto.create({
        data: {
          fecha: fechaDesdeISO("2026-10-15"),
          descripcion: "x".repeat(121),
          monto: 1000,
          categoriaId: categoria.id,
        },
      }),
    ).rejects.toThrow();
  });

  test("no se puede apuntar a una categoria que no existe", async () => {
    await expect(
      prisma.gasto.create({
        data: {
          fecha: fechaDesdeISO("2026-10-15"),
          descripcion: "Huerfano",
          monto: 1000,
          categoriaId: "categoria-que-no-existe",
        },
      }),
    ).rejects.toThrow();
  });

  test("no se puede borrar una categoria con gastos", async () => {
    const categoria = await crearCategoria();
    await prisma.gasto.create({
      data: {
        fecha: fechaDesdeISO("2026-10-15"),
        descripcion: "Compra",
        monto: 5000,
        categoriaId: categoria.id,
      },
    });

    await expect(
      prisma.categoria.delete({ where: { id: categoria.id } }),
    ).rejects.toThrow();

    // El camino correcto es desactivarla.
    const desactivada = await prisma.categoria.update({
      where: { id: categoria.id },
      data: { activa: false },
    });
    expect(desactivada.activa).toBe(false);
  });
});

describe("consulta mensual", () => {
  test("el rango semiabierto toma el mes completo y nada mas", async () => {
    const super_ = await crearCategoria("Supermercado");
    const transporte = await crearCategoria("Transporte");

    await prisma.gasto.createMany({
      data: [
        // Septiembre: no debe aparecer.
        { fecha: fechaDesdeISO("2026-09-30"), descripcion: "Mes anterior", monto: 99999, categoriaId: super_.id },
        // Octubre: los tres bordes y el medio.
        { fecha: fechaDesdeISO("2026-10-01"), descripcion: "Primero", monto: 10000, categoriaId: super_.id },
        { fecha: fechaDesdeISO("2026-10-15"), descripcion: "Medio", monto: 20000, categoriaId: super_.id },
        { fecha: fechaDesdeISO("2026-10-31"), descripcion: "Ultimo", monto: 5000, categoriaId: transporte.id },
        // Noviembre: no debe aparecer.
        { fecha: fechaDesdeISO("2026-11-01"), descripcion: "Mes siguiente", monto: 88888, categoriaId: super_.id },
      ],
    });

    const { desde, hasta } = rangoDelMesISO("2026-10");

    const total = await prisma.gasto.aggregate({
      where: { fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
      _count: true,
    });

    expect(total._count).toBe(3);
    expect(total._sum.monto).toBe(35000);

    const porCategoria = await prisma.gasto.groupBy({
      by: ["categoriaId"],
      where: { fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    });

    type FilaAgrupada = { categoriaId: string; _sum: { monto: number | null } };
    const mapa = new Map(
      (porCategoria as FilaAgrupada[]).map((fila) => [fila.categoriaId, fila._sum.monto]),
    );
    expect(mapa.get(super_.id)).toBe(30000);
    expect(mapa.get(transporte.id)).toBe(5000);
  });

  test("un mes sin gastos suma null, no cero", async () => {
    const { desde, hasta } = rangoDelMesISO("2026-07");
    const total = await prisma.gasto.aggregate({
      where: { fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
      _count: true,
    });
    // Postgres devuelve NULL en SUM() sin filas: la capa de dominio de la
    // seccion 2 tiene que normalizarlo a 0.
    expect(total._count).toBe(0);
    expect(total._sum.monto).toBeNull();
  });
});
