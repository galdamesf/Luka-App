import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clienteDePrueba, limpiar } from "./base";
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  listarGastosDelMes,
  mesesConGastos,
  obtenerGasto,
} from "@/datos/gastos";
import {
  desactivarCategoria,
  listarCategoriasActivas,
  reactivarCategoria,
} from "@/datos/categorias";
import { resumirMes } from "@/dominio/resumen";
import type { GastoValidado } from "@/dominio/esquemas";

let prisma: PrismaClient;
let supermercado: string;
let arriendo: string;
let restaurantes: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  const creadas = await Promise.all([
    prisma.categoria.create({
      data: { nombre: "Supermercado", color: "#15803D", icono: "cart", esencial: true, orden: 0 },
    }),
    prisma.categoria.create({
      data: { nombre: "Arriendo", color: "#0F766E", icono: "house", esencial: true, orden: 1 },
    }),
    prisma.categoria.create({
      data: { nombre: "Restaurantes", color: "#C2410C", icono: "utensils", esencial: false, orden: 2 },
    }),
  ]);
  supermercado = creadas[0].id;
  arriendo = creadas[1].id;
  restaurantes = creadas[2].id;
});

function datos(cambios: Partial<GastoValidado> = {}): GastoValidado {
  return {
    fecha: "2026-10-15",
    descripcion: "Feria del martes",
    monto: 23450,
    categoriaId: supermercado,
    medioPago: "DEBITO",
    notas: null,
    ...cambios,
  };
}

describe("crearGasto", () => {
  test("crea y devuelve el gasto ya aplanado", async () => {
    const gasto = await crearGasto(datos(), prisma);

    expect(gasto.id).toBeTruthy();
    expect(gasto.monto).toBe(23450);
    expect(gasto.descripcion).toBe("Feria del martes");
    expect(gasto.medioPago).toBe("DEBITO");
    expect(gasto.notas).toBeNull();
    expect(gasto.categoria.nombre).toBe("Supermercado");
    expect(gasto.categoria.esencial).toBe(true);
  });

  test("la fecha vuelve como el mismo dia que se mando", async () => {
    // El primero y el ultimo del mes son los que se corren si algo esta mal.
    for (const fecha of ["2026-10-01", "2026-10-31", "2027-01-01"]) {
      const gasto = await crearGasto(datos({ fecha }), prisma);
      expect(gasto.fecha).toBe(fecha);
    }
  });

  test("guarda las notas cuando vienen", async () => {
    const gasto = await crearGasto(datos({ notas: "pagado en dos cuotas" }), prisma);
    expect(gasto.notas).toBe("pagado en dos cuotas");
  });

  test("el CHECK de la base rechaza monto cero o negativo", async () => {
    // La validacion de Zod ya lo atrapa antes, pero esta es la red que no se
    // puede saltar ni llamando a la capa de datos directo.
    await expect(crearGasto(datos({ monto: 0 }), prisma)).rejects.toThrow();
    await expect(crearGasto(datos({ monto: -5000 }), prisma)).rejects.toThrow();
  });

  test("falla si la categoria no existe", async () => {
    await expect(
      crearGasto(datos({ categoriaId: "no-existe" }), prisma),
    ).rejects.toThrow();
  });
});

describe("listarGastosDelMes", () => {
  beforeEach(async () => {
    await crearGasto(datos({ fecha: "2026-09-30", monto: 99999 }), prisma);
    await crearGasto(datos({ fecha: "2026-10-01", monto: 10000 }), prisma);
    await crearGasto(datos({ fecha: "2026-10-31", monto: 5000, categoriaId: restaurantes }), prisma);
    await crearGasto(datos({ fecha: "2026-11-01", monto: 88888 }), prisma);
  });

  test("trae solo el mes pedido, con los bordes dentro", async () => {
    const octubre = await listarGastosDelMes("2026-10", prisma);
    expect(octubre).toHaveLength(2);
    expect(octubre.map((g) => g.fecha).sort()).toEqual(["2026-10-01", "2026-10-31"]);
  });

  test("ordena del mas reciente al mas antiguo", async () => {
    const octubre = await listarGastosDelMes("2026-10", prisma);
    expect(octubre[0]?.fecha).toBe("2026-10-31");
    expect(octubre[1]?.fecha).toBe("2026-10-01");
  });

  test("un mes sin gastos devuelve lista vacia, no error", async () => {
    expect(await listarGastosDelMes("2026-07", prisma)).toEqual([]);
  });

  test("incluye los datos de la categoria para los graficos", async () => {
    const octubre = await listarGastosDelMes("2026-10", prisma);
    expect(octubre[0]?.categoria.color).toBe("#C2410C");
    expect(octubre[0]?.categoria.icono).toBe("utensils");
  });

  test("rechaza un mes mal escrito", async () => {
    await expect(listarGastosDelMes("2026-1", prisma)).rejects.toThrow(/mes invalido/i);
  });
});

describe("obtenerGasto", () => {
  test("devuelve el gasto si existe", async () => {
    const creado = await crearGasto(datos(), prisma);
    const leido = await obtenerGasto(creado.id, prisma);
    expect(leido?.id).toBe(creado.id);
    expect(leido?.fecha).toBe("2026-10-15");
  });

  test("devuelve null si no existe, en vez de reventar", async () => {
    expect(await obtenerGasto("no-existe", prisma)).toBeNull();
  });
});

describe("actualizarGasto", () => {
  test("cambia solo los campos que se mandan", async () => {
    const creado = await crearGasto(datos({ notas: "original" }), prisma);

    const cambiado = await actualizarGasto(creado.id, { monto: 30000 }, prisma);

    expect(cambiado.monto).toBe(30000);
    expect(cambiado.descripcion).toBe("Feria del martes");
    expect(cambiado.notas).toBe("original");
    expect(cambiado.fecha).toBe("2026-10-15");
  });

  test("permite mover el gasto de categoria", async () => {
    const creado = await crearGasto(datos(), prisma);
    const cambiado = await actualizarGasto(creado.id, { categoriaId: arriendo }, prisma);
    expect(cambiado.categoria.nombre).toBe("Arriendo");
  });

  test("cambiar la fecha no corre el dia", async () => {
    const creado = await crearGasto(datos(), prisma);
    const cambiado = await actualizarGasto(creado.id, { fecha: "2026-11-01" }, prisma);
    expect(cambiado.fecha).toBe("2026-11-01");
  });

  test("tambien respeta el CHECK de monto", async () => {
    const creado = await crearGasto(datos(), prisma);
    await expect(actualizarGasto(creado.id, { monto: 0 }, prisma)).rejects.toThrow();
  });
});

describe("eliminarGasto", () => {
  test("lo saca de la base", async () => {
    const creado = await crearGasto(datos(), prisma);
    await eliminarGasto(creado.id, prisma);
    expect(await obtenerGasto(creado.id, prisma)).toBeNull();
  });

  test("falla si no existe", async () => {
    await expect(eliminarGasto("no-existe", prisma)).rejects.toThrow();
  });
});

describe("mesesConGastos", () => {
  test("lista los meses con gastos, del mas nuevo al mas viejo, sin repetir", async () => {
    await crearGasto(datos({ fecha: "2026-10-01" }), prisma);
    await crearGasto(datos({ fecha: "2026-10-20" }), prisma);
    await crearGasto(datos({ fecha: "2026-08-15" }), prisma);
    await crearGasto(datos({ fecha: "2026-12-25" }), prisma);

    expect(await mesesConGastos(prisma)).toEqual(["2026-12", "2026-10", "2026-08"]);
  });

  test("sin gastos devuelve lista vacia", async () => {
    expect(await mesesConGastos(prisma)).toEqual([]);
  });
});

describe("categorias", () => {
  test("lista las activas en el orden definido", async () => {
    const activas = await listarCategoriasActivas(prisma);
    expect(activas.map((c) => c.nombre)).toEqual(["Supermercado", "Arriendo", "Restaurantes"]);
  });

  test("desactivar la saca de la lista sin borrar los gastos", async () => {
    const gasto = await crearGasto(datos(), prisma);
    await desactivarCategoria(supermercado, prisma);

    const activas = await listarCategoriasActivas(prisma);
    expect(activas.map((c) => c.nombre)).not.toContain("Supermercado");

    // El gasto sigue ahi y conserva su categoria.
    const leido = await obtenerGasto(gasto.id, prisma);
    expect(leido?.categoria.nombre).toBe("Supermercado");
  });

  test("se puede volver a activar", async () => {
    await desactivarCategoria(supermercado, prisma);
    await reactivarCategoria(supermercado, prisma);
    const activas = await listarCategoriasActivas(prisma);
    expect(activas.map((c) => c.nombre)).toContain("Supermercado");
  });
});

describe("de la base al resumen, de punta a punta", () => {
  test("el resumen calculado sobre datos reales da los numeros esperados", async () => {
    await crearGasto(datos({ fecha: "2026-10-01", monto: 10000, categoriaId: supermercado }), prisma);
    await crearGasto(datos({ fecha: "2026-10-15", monto: 20000, categoriaId: supermercado }), prisma);
    await crearGasto(datos({ fecha: "2026-10-05", monto: 400000, categoriaId: arriendo }), prisma);
    await crearGasto(datos({ fecha: "2026-10-20", monto: 70000, categoriaId: restaurantes }), prisma);
    // Fuera del mes: no debe aparecer.
    await crearGasto(datos({ fecha: "2026-09-30", monto: 999999 }), prisma);

    const gastos = await listarGastosDelMes("2026-10", prisma);
    const enNoviembre = new Date("2026-11-15T12:00:00.000Z");
    const resumen = resumirMes(gastos, "2026-10", enNoviembre);

    expect(resumen.total).toBe(500000);
    expect(resumen.cantidad).toBe(4);
    expect(resumen.esenciales).toBe(430000);
    expect(resumen.discrecionales).toBe(70000);
    expect(resumen.diasConGasto).toBe(4);
    expect(resumen.mayorGasto?.monto).toBe(400000);

    // Arriendo primero por ser el mayor.
    expect(resumen.porCategoria[0]?.categoria.nombre).toBe("Arriendo");
    expect(resumen.porCategoria[0]?.porcentaje).toBeCloseTo(80, 6);

    // Supermercado acumula sus dos gastos.
    const sup = resumen.porCategoria.find((l) => l.categoria.nombre === "Supermercado");
    expect(sup?.total).toBe(30000);
    expect(sup?.cantidad).toBe(2);

    expect(resumen.porCategoria.reduce((s, l) => s + l.porcentaje, 0)).toBeCloseTo(100, 6);
  });
});
