import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import {
  definirSueldo,
  eliminarSueldo,
  listarSueldos,
  sueldoDelMes,
} from "@/datos/sueldos";
import {
  crearDeuda,
  desactivarDeuda,
  eliminarDeuda,
  listarDeudas,
  reactivarDeuda,
} from "@/datos/deudas";
import { crearGasto } from "@/datos/gastos";
import { listarGastosDelMes } from "@/datos/gastos";
import { resumirMes } from "@/dominio/resumen";
import { calcularBalance, cuotaEnMes, saldoDesde } from "@/dominio/balance";
import type { DeudaValidada } from "@/dominio/esquemas";

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

function datosDeuda(cambios: Partial<DeudaValidada> = {}): DeudaValidada {
  return {
    nombre: "Crédito de consumo",
    montoCuota: 85000,
    cuotasTotales: 12,
    primeraCuota: "2026-08",
    nota: null,
    ...cambios,
  };
}

describe("sueldos", () => {
  test("se guarda y vuelve como mes, no como fecha suelta", async () => {
    const s = await definirSueldo("2026-10", 1250000, null, prisma);
    expect(s.monto).toBe(1250000);
    expect(s.vigenteDesde).toBe("2026-10");
  });

  test("el mes no se corre al leerlo de vuelta", async () => {
    // Enero es el caso que revienta: la medianoche UTC del 1 cae el 31 de
    // diciembre en Chile, y ahi el AÑO tambien cambia.
    for (const mes of ["2026-01", "2026-12", "2027-01"]) {
      await definirSueldo(mes, 1000000, null, prisma);
      const guardados = await listarSueldos(prisma);
      expect(guardados.map((s) => s.vigenteDesde)).toContain(mes);
    }
  });

  test("definirlo dos veces para el mismo mes corrige, no duplica", async () => {
    await definirSueldo("2026-10", 1200000, null, prisma);
    await definirSueldo("2026-10", 1250000, "con el aumento", prisma);

    const todos = await listarSueldos(prisma);
    expect(todos).toHaveLength(1);
    expect(todos[0]?.monto).toBe(1250000);
    expect(todos[0]?.nota).toBe("con el aumento");
  });

  test("rechaza un sueldo negativo", async () => {
    await expect(definirSueldo("2026-10", -1, null, prisma)).rejects.toThrow();
  });

  test("acepta cero: un mes sin ingresos es un dato real", async () => {
    const s = await definirSueldo("2026-10", 0, null, prisma);
    expect(s.monto).toBe(0);
  });

  test("sueldoDelMes toma el vigente, no el ultimo cargado", async () => {
    await definirSueldo("2026-01", 900000, null, prisma);
    await definirSueldo("2026-06", 1200000, null, prisma);
    await definirSueldo("2027-01", 1350000, null, prisma);

    expect(await sueldoDelMes("2026-03", prisma)).toBe(900000);
    expect(await sueldoDelMes("2026-06", prisma)).toBe(1200000);
    expect(await sueldoDelMes("2026-12", prisma)).toBe(1200000);
    expect(await sueldoDelMes("2027-05", prisma)).toBe(1350000);
  });

  test("un aumento no reescribe los meses anteriores", async () => {
    await definirSueldo("2026-01", 900000, null, prisma);
    await definirSueldo("2026-06", 1200000, null, prisma);
    expect(await sueldoDelMes("2026-02", prisma)).toBe(900000);
  });

  test("antes del primer sueldo cargado devuelve null", async () => {
    await definirSueldo("2026-06", 1200000, null, prisma);
    expect(await sueldoDelMes("2026-01", prisma)).toBeNull();
  });

  test("sin ningun sueldo devuelve null", async () => {
    expect(await sueldoDelMes("2026-10", prisma)).toBeNull();
  });

  test("se puede borrar el de un mes", async () => {
    await definirSueldo("2026-10", 1200000, null, prisma);
    await eliminarSueldo("2026-10", prisma);
    expect(await listarSueldos(prisma)).toEqual([]);
  });
});

describe("deudas", () => {
  test("se crea y vuelve con la primera cuota como mes", async () => {
    const d = await crearDeuda(datosDeuda(), prisma);
    expect(d.nombre).toBe("Crédito de consumo");
    expect(d.montoCuota).toBe(85000);
    expect(d.cuotasTotales).toBe(12);
    expect(d.primeraCuota).toBe("2026-08");
    expect(d.activa).toBe(true);
  });

  test("el mes de la primera cuota no se corre", async () => {
    for (const mes of ["2026-01", "2026-12", "2027-01"]) {
      const d = await crearDeuda(datosDeuda({ primeraCuota: mes }), prisma);
      expect(d.primeraCuota).toBe(mes);
    }
  });

  test("la base rechaza cuota cero o negativa", async () => {
    await expect(crearDeuda(datosDeuda({ montoCuota: 0 }), prisma)).rejects.toThrow();
    await expect(crearDeuda(datosDeuda({ montoCuota: -5000 }), prisma)).rejects.toThrow();
  });

  test("la base rechaza un numero de cuotas absurdo", async () => {
    await expect(crearDeuda(datosDeuda({ cuotasTotales: 0 }), prisma)).rejects.toThrow();
    await expect(crearDeuda(datosDeuda({ cuotasTotales: 601 }), prisma)).rejects.toThrow();
  });

  test("desactivar la saca del calculo sin borrarla", async () => {
    const d = await crearDeuda(datosDeuda(), prisma);
    await desactivarDeuda(d.id, prisma);

    const todas = await listarDeudas(prisma);
    expect(todas).toHaveLength(1);
    expect(todas[0]?.activa).toBe(false);
    expect(cuotaEnMes(todas[0]!, "2026-10")).toBeNull();
    expect(saldoDesde(todas[0]!, "2026-10")).toBe(0);
  });

  test("se puede reactivar", async () => {
    const d = await crearDeuda(datosDeuda(), prisma);
    await desactivarDeuda(d.id, prisma);
    await reactivarDeuda(d.id, prisma);
    const todas = await listarDeudas(prisma);
    expect(todas[0]?.activa).toBe(true);
  });

  test("se puede borrar una creada por error", async () => {
    const d = await crearDeuda(datosDeuda(), prisma);
    await eliminarDeuda(d.id, prisma);
    expect(await listarDeudas(prisma)).toEqual([]);
  });

  test("lista activas primero y por cuota mas alta", async () => {
    await crearDeuda(datosDeuda({ nombre: "Chica", montoCuota: 20000 }), prisma);
    const grande = await crearDeuda(datosDeuda({ nombre: "Grande", montoCuota: 200000 }), prisma);
    const apagada = await crearDeuda(datosDeuda({ nombre: "Apagada", montoCuota: 999999 }), prisma);
    await desactivarDeuda(apagada.id, prisma);

    const todas = await listarDeudas(prisma);
    expect(todas.map((d) => d.nombre)).toEqual(["Grande", "Chica", "Apagada"]);
    expect(todas[0]?.id).toBe(grande.id);
  });
});

describe("de la base al balance, de punta a punta", () => {
  test("los numeros del mes salen correctos sobre datos reales", async () => {
    const esencial = await prisma.categoria.create({
      data: { nombre: "Arriendo", color: "#0d9488", icono: "house", esencial: true },
    });
    const discrecional = await prisma.categoria.create({
      data: { nombre: "Restaurantes", color: "#ea580c", icono: "utensils", esencial: false },
    });

    await definirSueldo("2026-10", 1250000, null, prisma);

    await crearGasto(
      { fecha: "2026-10-01", descripcion: "Arriendo", monto: 450000, categoriaId: esencial.id, medioPago: "TRANSFERENCIA", notas: null },
      prisma,
    );
    await crearGasto(
      { fecha: "2026-10-12", descripcion: "Almuerzo", monto: 28900, categoriaId: discrecional.id, medioPago: "CREDITO", notas: null },
      prisma,
    );

    await crearDeuda(datosDeuda({ nombre: "Crédito", montoCuota: 118000, cuotasTotales: 24, primeraCuota: "2025-11" }), prisma);
    await crearDeuda(datosDeuda({ nombre: "Notebook", montoCuota: 54990, cuotasTotales: 12, primeraCuota: "2026-06" }), prisma);
    // Terminada antes de octubre: no debe cobrar.
    await crearDeuda(datosDeuda({ nombre: "Vieja", montoCuota: 999999, cuotasTotales: 3, primeraCuota: "2025-01" }), prisma);

    const [gastos, sueldo, deudas] = await Promise.all([
      listarGastosDelMes("2026-10", prisma),
      sueldoDelMes("2026-10", prisma),
      listarDeudas(prisma),
    ]);

    const resumen = resumirMes(gastos, "2026-10", new Date("2026-11-15T12:00:00.000Z"));
    const balance = calcularBalance({ mes: "2026-10", sueldo, resumen, deudas });

    expect(balance.sueldo).toBe(1250000);
    expect(balance.gastosBasicos).toBe(450000);
    expect(balance.gastosDiscrecionales).toBe(28900);
    // Solo las dos vigentes: la vieja termino en marzo de 2025.
    expect(balance.cuotasDelMes).toHaveLength(2);
    expect(balance.cuotas).toBe(118000 + 54990);
    expect(balance.disponible).toBe(1250000 - 450000 - 172990);
    expect(balance.saldo).toBe(1250000 - 450000 - 172990 - 28900);
    expect(balance.enRojo).toBe(false);
    expect(balance.sinSueldo).toBe(false);

    // La cuota que toca en octubre de cada deuda.
    const porNombre = new Map(balance.cuotasDelMes.map((c) => [c.deuda.nombre, c]));
    expect(porNombre.get("Crédito")?.numero).toBe(12);
    expect(porNombre.get("Notebook")?.numero).toBe(5);
  });

  test("sin sueldo definido el balance lo señala", async () => {
    const resumen = resumirMes([], "2026-10", new Date("2026-11-15T12:00:00.000Z"));
    const balance = calcularBalance({
      mes: "2026-10",
      sueldo: await sueldoDelMes("2026-10", prisma),
      resumen,
      deudas: await listarDeudas(prisma),
    });

    expect(balance.sinSueldo).toBe(true);
  });
});
