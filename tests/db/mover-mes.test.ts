import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import { fechaDesdeISO } from "@/lib/fecha";
import { planearMovimiento } from "@/dominio/mover-mes";
import { aplicarMovimiento, leerDeudasParaMover, leerParaMover } from "@/datos/mover-mes";

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

describe("mover lo de octubre a noviembre", () => {
  async function moverOctubreANoviembre() {
    const plan = planearMovimiento(
      await leerParaMover(HOGAR_INICIAL, "2026-10", prisma),
      await leerParaMover(HOGAR_INICIAL, "2026-11", prisma),
      { desde: "2026-10", hasta: "2026-11" },
      await leerDeudasParaMover(HOGAR_INICIAL, prisma),
    );
    await aplicarMovimiento(HOGAR_INICIAL, plan, "2026-11", prisma);
    return plan;
  }

  test("pasan cuentas, presupuesto y ahorro; la copia pendiente de noviembre se quita; la deuda se corre", async () => {
    const categoria = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Cuentas", color: "#009993", icono: "zap", esencial: true },
    });
    const deuda = await prisma.deuda.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Ripley", montoCuota: 95_000, cuotasTotales: 12, primeraCuota: fechaDesdeISO("2026-04-01") },
    });
    const octubre = fechaDesdeISO("2026-10-01");
    const noviembre = fechaDesdeISO("2026-11-01");

    await prisma.cuenta.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Luz", monto: 30_000, mes: octubre, categoriaId: categoria.id, mensual: true, pagadaEn: fechaDesdeISO("2026-10-28") } });
    await prisma.cuenta.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Agua", monto: 20_000, mes: octubre, categoriaId: categoria.id, mensual: true } });
    // La copia que la app crea sola al abrir noviembre.
    await prisma.cuenta.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Luz", monto: 30_000, mes: noviembre, categoriaId: categoria.id, mensual: true } });
    await prisma.cuotaPagada.create({ data: { deudaId: deuda.id, mes: octubre, pagadaEn: fechaDesdeISO("2026-10-28"), monto: 95_000 } });
    await prisma.presupuesto.create({ data: { hogarId: HOGAR_INICIAL, categoriaId: categoria.id, mes: octubre, monto: 70_000 } });
    await prisma.ahorro.create({ data: { hogarId: HOGAR_INICIAL, mes: octubre, monto: 50_000 } });

    await moverOctubreANoviembre();

    const enOctubre = await leerParaMover(HOGAR_INICIAL, "2026-10", prisma);
    const enNoviembre = await leerParaMover(HOGAR_INICIAL, "2026-11", prisma);
    expect(enOctubre).toEqual({ cuentas: [], presupuestos: [], ahorros: [] });
    expect(enNoviembre.cuentas.map((c) => [c.nombre, c.pagada])).toEqual([["Agua", false], ["Luz", true]]);
    expect(enNoviembre.presupuestos.map((p) => p.monto)).toEqual([70_000]);
    expect(enNoviembre.ahorros.map((a) => a.monto)).toEqual([50_000]);

    const [corrida] = await leerDeudasParaMover(HOGAR_INICIAL, prisma);
    expect(corrida?.primeraCuota).toBe("2026-05");
    expect(corrida?.pagos.map((p) => p.mes)).toEqual(["2026-11"]);
  });

  test("pagos en meses seguidos se corren sin chocar con el par unico (deuda, mes)", async () => {
    const categoria = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Cuentas", color: "#009993", icono: "zap", esencial: true },
    });
    await prisma.cuenta.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Agua", monto: 20_000, mes: fechaDesdeISO("2026-10-01"), categoriaId: categoria.id },
    });
    const deuda = await prisma.deuda.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Scotiabank", montoCuota: 168_000, cuotasTotales: 12, primeraCuota: fechaDesdeISO("2026-04-01") },
    });
    for (const mes of ["2026-09-01", "2026-10-01"]) {
      await prisma.cuotaPagada.create({
        data: { deudaId: deuda.id, mes: fechaDesdeISO(mes), pagadaEn: fechaDesdeISO(mes), monto: 168_000 },
      });
    }

    await moverOctubreANoviembre();

    const [corrida] = await leerDeudasParaMover(HOGAR_INICIAL, prisma);
    expect(corrida?.pagos.map((p) => p.mes)).toEqual(["2026-10", "2026-11"]);
  });

  test("repetirlo no corre las deudas otra vez", async () => {
    const categoria = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Cuentas", color: "#009993", icono: "zap", esencial: true },
    });
    await prisma.cuenta.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Agua", monto: 20_000, mes: fechaDesdeISO("2026-10-01"), categoriaId: categoria.id },
    });
    await prisma.deuda.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Ripley", montoCuota: 95_000, cuotasTotales: 2, primeraCuota: fechaDesdeISO("2026-10-01") },
    });

    await moverOctubreANoviembre();
    const segunda = await moverOctubreANoviembre();

    expect(segunda.deudas).toEqual([]);
    const [deuda] = await leerDeudasParaMover(HOGAR_INICIAL, prisma);
    expect(deuda?.primeraCuota).toBe("2026-11");
  });
});
