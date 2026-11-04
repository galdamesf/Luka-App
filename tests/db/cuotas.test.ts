import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import { crearDeuda, listarPagosDelMes, pagarCuota } from "@/datos/deudas";
import { eliminarGasto, listarGastosDelMes } from "@/datos/gastos";

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

async function deudaRipley() {
  return crearDeuda(
    HOGAR_INICIAL,
    { nombre: "Ripley", montoCuota: 45000, cuotasTotales: 6, primeraCuota: "2026-09", nota: null },
    prisma,
  );
}

describe("la boleta de una cuota", () => {
  test("se guarda en el gasto del pago y el pago la trae", async () => {
    const deuda = await deudaRipley();

    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, "boleta-ripley.jpg", prisma);

    const [pago] = await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma);
    expect(pago?.boletaArchivo).toBe("boleta-ripley.jpg");
    expect(pago?.gastoId).not.toBeNull();

    const gasto = await prisma.gasto.findUniqueOrThrow({ where: { id: pago!.gastoId! } });
    expect(gasto.boletaArchivo).toBe("boleta-ripley.jpg");
  });

  test("sin boleta, el pago queda con el gasto y sin foto", async () => {
    const deuda = await deudaRipley();

    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, null, prisma);

    const [pago] = await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma);
    expect(pago?.gastoId).not.toBeNull();
    expect(pago?.boletaArchivo).toBeNull();
  });

  test("adjuntarla despues al gasto la deja visible en el pago", async () => {
    const deuda = await deudaRipley();
    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, null, prisma);
    const [antes] = await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma);

    await prisma.gasto.update({
      where: { id: antes!.gastoId! },
      data: { boletaArchivo: "despues.pdf" },
    });

    const [despues] = await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma);
    expect(despues?.boletaArchivo).toBe("despues.pdf");
  });
});

describe("el pago de una cuota en Movimientos", () => {
  test("aparece entre los gastos del mes, marcado como cuota", async () => {
    const deuda = await deudaRipley();
    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, null, prisma);

    const gastos = await listarGastosDelMes(HOGAR_INICIAL, "2026-10", prisma);
    expect(gastos).toHaveLength(1);
    expect(gastos[0]?.cuota).toEqual({ deudaId: deuda.id, deudaNombre: "Ripley" });
  });

  test("borrar ese gasto deja la cuota pendiente otra vez", async () => {
    const deuda = await deudaRipley();
    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, null, prisma);
    const [pago] = await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma);

    await eliminarGasto(HOGAR_INICIAL, pago!.gastoId!, prisma);

    expect(await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma)).toEqual([]);
    expect(await prisma.gasto.count()).toBe(0);
    // Y se puede volver a pagar: no quedo un registro huerfano bloqueando.
    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-31", 45000, null, prisma);
    expect(await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma)).toHaveLength(1);
  });

  test("borrar un gasto comun no toca las cuotas pagadas", async () => {
    const deuda = await deudaRipley();
    await pagarCuota(HOGAR_INICIAL, deuda.id, "2026-11", "2026-10-30", 45000, null, prisma);
    const categoria = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Café", color: "#ea580c", icono: "coffee", esencial: false },
    });
    const comun = await prisma.gasto.create({
      data: { hogarId: HOGAR_INICIAL, fecha: new Date("2026-10-30T00:00:00.000Z"), descripcion: "Café", monto: 3000, categoriaId: categoria.id },
    });

    await eliminarGasto(HOGAR_INICIAL, comun.id, prisma);

    expect(await listarPagosDelMes(HOGAR_INICIAL, "2026-11", prisma)).toHaveLength(1);
  });
});
