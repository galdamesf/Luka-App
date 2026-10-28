import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import {
  actualizarCuenta,
  crearCuenta,
  eliminarCuenta,
  listarCuentasDelMes,
  pagarCuenta,
  regenerarMensuales,
  revertirPago,
} from "@/datos/cuentas";
import { listarGastosDelMes, obtenerGasto } from "@/datos/gastos";
import type { CuentaValidada } from "@/dominio/esquemas";

let prisma: PrismaClient;
let categoria: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  const c = await prisma.categoria.create({
    data: { nombre: "Cuentas", color: "#0891b2", icono: "zap", esencial: true },
  });
  categoria = c.id;
});

function datos(cambios: Partial<CuentaValidada> = {}): CuentaValidada {
  return {
    nombre: "Luz",
    monto: 38400,
    mes: "2026-10",
    diaVencimiento: 10,
    categoriaId: categoria,
    mensual: false,
    nota: null,
    ...cambios,
  };
}

describe("crear y listar", () => {
  test("se crea pendiente", async () => {
    const c = await crearCuenta(datos(), prisma);
    expect(c.nombre).toBe("Luz");
    expect(c.monto).toBe(38400);
    expect(c.mes).toBe("2026-10");
    expect(c.diaVencimiento).toBe(10);
    expect(c.pagadaEn).toBeNull();
    expect(c.gastoId).toBeNull();
  });

  test("el mes no se corre al leerlo de vuelta", async () => {
    for (const mes of ["2026-01", "2026-12", "2027-01"]) {
      const c = await crearCuenta(datos({ nombre: `Luz ${mes}`, mes }), prisma);
      expect(c.mes).toBe(mes);
    }
  });

  test("lista solo las del mes pedido", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10" }), prisma);
    await crearCuenta(datos({ nombre: "Agua", mes: "2026-10" }), prisma);
    await crearCuenta(datos({ nombre: "Gas", mes: "2026-11" }), prisma);

    const octubre = await listarCuentasDelMes("2026-10", prisma);
    expect(octubre.map((c) => c.nombre).sort()).toEqual(["Agua", "Luz"]);
  });

  test("no se repite el mismo nombre dentro del mes", async () => {
    await crearCuenta(datos({ nombre: "Luz" }), prisma);
    await expect(crearCuenta(datos({ nombre: "Luz" }), prisma)).rejects.toThrow();
  });

  test("el mismo nombre si vale en otro mes", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10" }), prisma);
    const noviembre = await crearCuenta(datos({ nombre: "Luz", mes: "2026-11" }), prisma);
    expect(noviembre.mes).toBe("2026-11");
  });

  test("la base rechaza monto cero y vencimiento fuera de rango", async () => {
    await expect(crearCuenta(datos({ nombre: "A", monto: 0 }), prisma)).rejects.toThrow();
    await expect(crearCuenta(datos({ nombre: "B", diaVencimiento: 32 }), prisma)).rejects.toThrow();
  });
});

describe("pagar", () => {
  test("crea el gasto con la fecha exacta de pago", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);

    expect(pagada.pagadaEn).toBe("2026-10-09");
    expect(pagada.gastoId).not.toBeNull();

    const gasto = await obtenerGasto(pagada.gastoId as string, prisma);
    expect(gasto?.fecha).toBe("2026-10-09");
    expect(gasto?.descripcion).toBe("Luz");
    expect(gasto?.monto).toBe(38400);
    expect(gasto?.categoria.nombre).toBe("Cuentas");
  });

  test("el gasto aparece en el mes del pago, no en el de la cuenta", async () => {
    // Una cuenta de septiembre que se pago en octubre.
    const cuenta = await crearCuenta(datos({ mes: "2026-09" }), prisma);
    await pagarCuenta(cuenta.id, "2026-10-02", 38400, null, prisma);

    expect((await listarGastosDelMes("2026-10", prisma))).toHaveLength(1);
    expect((await listarGastosDelMes("2026-09", prisma))).toHaveLength(0);
  });

  test("acepta un monto distinto al esperado y lo deja en los dos lados", async () => {
    // La cuenta de la luz nunca llega igual a lo presupuestado.
    const cuenta = await crearCuenta(datos({ monto: 38400 }), prisma);
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 41250, null, prisma);

    expect(pagada.monto).toBe(41250);
    const gasto = await obtenerGasto(pagada.gastoId as string, prisma);
    expect(gasto?.monto).toBe(41250);
  });

  test("guarda la boleta en la cuenta y en el gasto", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    const archivo = "0123456789abcdef0123456789abcdef.jpg";
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 38400, archivo, prisma);

    expect(pagada.boletaArchivo).toBe(archivo);
    const gasto = await obtenerGasto(pagada.gastoId as string, prisma);
    expect(gasto?.boletaArchivo).toBe(archivo);
  });

  test("no se puede pagar dos veces", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);
    await expect(
      pagarCuenta(cuenta.id, "2026-10-10", 38400, null, prisma),
    ).rejects.toThrow(/ya está pagada/i);
  });

  test("si el pago falla no queda ni cuenta pagada ni gasto suelto", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    // Monto cero: la base lo rechaza dentro de la transaccion.
    await expect(pagarCuenta(cuenta.id, "2026-10-09", 0, null, prisma)).rejects.toThrow();

    const [despues] = await listarCuentasDelMes("2026-10", prisma);
    expect(despues?.pagadaEn).toBeNull();
    expect(despues?.gastoId).toBeNull();
    expect(await listarGastosDelMes("2026-10", prisma)).toHaveLength(0);
  });
});

describe("deshacer el pago", () => {
  test("borra el gasto y la cuenta vuelve a pendiente", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);
    const gastoId = pagada.gastoId as string;

    await revertirPago(cuenta.id, prisma);

    const [despues] = await listarCuentasDelMes("2026-10", prisma);
    expect(despues?.pagadaEn).toBeNull();
    expect(despues?.gastoId).toBeNull();
    expect(await obtenerGasto(gastoId, prisma)).toBeNull();
  });

  test("se puede volver a pagar despues de deshacer", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);
    await revertirPago(cuenta.id, prisma);

    const otraVez = await pagarCuenta(cuenta.id, "2026-10-15", 40000, null, prisma);
    expect(otraVez.pagadaEn).toBe("2026-10-15");
    expect(otraVez.monto).toBe(40000);
  });
});

describe("borrar el gasto a mano no se lleva la cuenta", () => {
  test("la cuenta sobrevive y queda pagada sin gasto enlazado", async () => {
    // Este caso rompia: ON DELETE SET NULL chocaba con un CHECK en las dos
    // direcciones y dejaba el gasto imposible de borrar.
    const cuenta = await crearCuenta(datos(), prisma);
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);

    await prisma.gasto.delete({ where: { id: pagada.gastoId as string } });

    const [despues] = await listarCuentasDelMes("2026-10", prisma);
    expect(despues).toBeDefined();
    expect(despues?.pagadaEn).toBe("2026-10-09");
    expect(despues?.gastoId).toBeNull();
  });
});

describe("regenerar las mensuales", () => {
  test("copia al mes siguiente solo las marcadas mensual", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", mensual: true }), prisma);
    await crearCuenta(datos({ nombre: "Agua", mes: "2026-10", mensual: true }), prisma);
    await crearCuenta(datos({ nombre: "Dentista", mes: "2026-10", mensual: false }), prisma);

    expect(await regenerarMensuales("2026-11", prisma)).toBe(2);

    const noviembre = await listarCuentasDelMes("2026-11", prisma);
    expect(noviembre.map((c) => c.nombre).sort()).toEqual(["Agua", "Luz"]);
    expect(noviembre.every((c) => c.mensual)).toBe(true);
    expect(noviembre.every((c) => c.pagadaEn === null)).toBe(true);
  });

  test("conserva vencimiento y categoria", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", mensual: true, diaVencimiento: 17 }), prisma);
    await regenerarMensuales("2026-11", prisma);

    const [copia] = await listarCuentasDelMes("2026-11", prisma);
    expect(copia?.diaVencimiento).toBe(17);
    expect(copia?.categoria.nombre).toBe("Cuentas");
  });

  test("arrastra el monto real del mes anterior, no el original", async () => {
    const cuenta = await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", monto: 38400, mensual: true }), prisma);
    // Llego mas cara de lo presupuestado.
    await pagarCuenta(cuenta.id, "2026-10-09", 44900, null, prisma);

    await regenerarMensuales("2026-11", prisma);
    const [copia] = await listarCuentasDelMes("2026-11", prisma);
    expect(copia?.monto).toBe(44900);
  });

  test("correrla dos veces no duplica", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", mensual: true }), prisma);

    expect(await regenerarMensuales("2026-11", prisma)).toBe(1);
    expect(await regenerarMensuales("2026-11", prisma)).toBe(0);
    expect(await listarCuentasDelMes("2026-11", prisma)).toHaveLength(1);
  });

  test("si ya existe una con ese nombre no la toca", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", mensual: true, monto: 38400 }), prisma);
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-11", monto: 99999 }), prisma);

    expect(await regenerarMensuales("2026-11", prisma)).toBe(0);
    const [existente] = await listarCuentasDelMes("2026-11", prisma);
    expect(existente?.monto).toBe(99999);
  });

  test("sin mes anterior no crea nada", async () => {
    expect(await regenerarMensuales("2026-11", prisma)).toBe(0);
  });

  test("la cadena se mantiene mes a mes", async () => {
    await crearCuenta(datos({ nombre: "Luz", mes: "2026-10", mensual: true }), prisma);
    await regenerarMensuales("2026-11", prisma);
    await regenerarMensuales("2026-12", prisma);

    expect(await listarCuentasDelMes("2026-12", prisma)).toHaveLength(1);
  });
});

describe("eliminar", () => {
  test("borra la cuenta", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    await eliminarCuenta(cuenta.id, prisma);
    expect(await listarCuentasDelMes("2026-10", prisma)).toEqual([]);
  });

  test("borrar una pagada deja su gasto en pie", async () => {
    // El gasto ya ocurrio: borrar el recordatorio no deshace la plata gastada.
    const cuenta = await crearCuenta(datos(), prisma);
    const pagada = await pagarCuenta(cuenta.id, "2026-10-09", 38400, null, prisma);

    await eliminarCuenta(cuenta.id, prisma);

    expect(await obtenerGasto(pagada.gastoId as string, prisma)).not.toBeNull();
  });
});

/**
 * Edicion de una cuenta.
 *
 * Lo importante aqui no es que guarde: es que se NIEGUE a editar una cuenta
 * ya pagada. Al pagarla se creo un gasto con su monto y su categoria, y
 * dejarla editar despues desincroniza las dos cifras.
 */
describe("actualizarCuenta", () => {
  test("cambia los datos de una cuenta pendiente", async () => {
    const cuenta = await crearCuenta(datos(), prisma);

    const editada = await actualizarCuenta(
      {
        id: cuenta.id,
        nombre: "Luz de octubre",
        monto: 41_200,
        diaVencimiento: 15,
        categoriaId: categoria,
        mensual: true,
        nota: "subio la tarifa",
      },
      prisma,
    );

    expect(editada.nombre).toBe("Luz de octubre");
    expect(editada.monto).toBe(41_200);
    expect(editada.diaVencimiento).toBe(15);
    expect(editada.mensual).toBe(true);
    expect(editada.nota).toBe("subio la tarifa");
  });

  test("no mueve la cuenta de mes", async () => {
    const cuenta = await crearCuenta(datos({ mes: "2026-10" }), prisma);

    const editada = await actualizarCuenta(
      {
        id: cuenta.id,
        nombre: "Luz",
        monto: 1000,
        diaVencimiento: null,
        categoriaId: categoria,
        mensual: false,
        nota: null,
      },
      prisma,
    );

    expect(editada.mes).toBe("2026-10");
  });

  test("deja quitar el dia de vencimiento", async () => {
    const cuenta = await crearCuenta(datos({ diaVencimiento: 10 }), prisma);

    const editada = await actualizarCuenta(
      {
        id: cuenta.id,
        nombre: cuenta.nombre,
        monto: cuenta.monto,
        diaVencimiento: null,
        categoriaId: categoria,
        mensual: false,
        nota: null,
      },
      prisma,
    );

    expect(editada.diaVencimiento).toBeNull();
  });

  test("REGRESION: se niega a editar una cuenta ya pagada", async () => {
    const cuenta = await crearCuenta(datos(), prisma);
    await pagarCuenta(cuenta.id, "2026-10-12", 38_400, null, prisma);

    await expect(
      actualizarCuenta(
        {
          id: cuenta.id,
          nombre: "otro nombre",
          monto: 999_999,
          diaVencimiento: null,
          categoriaId: categoria,
          mensual: false,
          nota: null,
        },
        prisma,
      ),
    ).rejects.toThrow(/pagada/i);

    // Y no alcanzo a tocar nada.
    const sinCambios = await prisma.cuenta.findUnique({ where: { id: cuenta.id } });
    expect(sinCambios!.monto).toBe(38_400);
    expect(sinCambios!.nombre).toBe("Luz");
  });

  test("una cuenta que no existe da un error claro", async () => {
    await expect(
      actualizarCuenta(
        {
          id: "cuenta-que-no-existe",
          nombre: "x",
          monto: 1,
          diaVencimiento: null,
          categoriaId: categoria,
          mensual: false,
          nota: null,
        },
        prisma,
      ),
    ).rejects.toThrow(/no existe/i);
  });
});
