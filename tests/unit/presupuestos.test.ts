import { describe, expect, test } from "vitest";
import {
  armarPresupuestos,
  detalleDeCategoria,
  type PresupuestoPlano,
} from "@/dominio/presupuestos";
import type { CategoriaPlana, GastoPlano } from "@/dominio/resumen";

const SUPER: CategoriaPlana = {
  id: "c-super", nombre: "Supermercado", color: "#c38409", icono: "shopping-cart", esencial: true,
};
const BENCINA: CategoriaPlana = {
  id: "c-bencina", nombre: "Transporte", color: "#0963ff", icono: "bus", esencial: true,
};
const ROPA: CategoriaPlana = {
  id: "c-ropa", nombre: "Ropa", color: "#9c5ac9", icono: "shirt", esencial: false,
};
const DEUDAS: CategoriaPlana = {
  id: "c-deudas", nombre: "Deudas y créditos", color: "#64748b", icono: "credit-card", esencial: true,
};

let n = 0;
const gasto = (
  categoria: CategoriaPlana,
  monto: number,
  fecha = "2026-10-05",
  cuota: GastoPlano["cuota"] = null,
): GastoPlano => ({
  id: `g${(n += 1)}`,
  fecha,
  descripcion: `gasto ${n}`,
  monto,
  medioPago: "DEBITO",
  notas: null,
  boletaArchivo: null,
  categoria,
  cuota,
});

const pres = (
  categoria: CategoriaPlana,
  monto: number,
  mes = "2026-10",
): PresupuestoPlano => ({
  id: `p-${categoria.id}-${mes}`,
  categoria,
  mes,
  monto,
  creadoEn: "2026-10-01",
});

describe("armarPresupuestos", () => {
  test("sin presupuestos no hay lineas", () => {
    const r = armarPresupuestos([], [gasto(SUPER, 50_000)], "2026-10");
    expect(r.lineas).toEqual([]);
    expect(r.totalPresupuestado).toBe(0);
  });

  test("descuenta los gastos de la categoría del presupuesto", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000)],
      [gasto(SUPER, 30_000), gasto(SUPER, 25_000)],
      "2026-10",
    );

    expect(r.lineas[0]!.gastado).toBe(55_000);
    expect(r.lineas[0]!.restante).toBe(45_000);
    expect(r.lineas[0]!.porcentaje).toBeCloseTo(55, 6);
    expect(r.lineas[0]!.excedido).toBe(false);
  });

  test("un gasto de otra categoría no toca este presupuesto", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000)],
      [gasto(SUPER, 30_000), gasto(BENCINA, 90_000)],
      "2026-10",
    );
    expect(r.lineas[0]!.gastado).toBe(30_000);
  });

  test("cada categoría descuenta de lo suyo", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000), pres(BENCINA, 50_000)],
      [gasto(SUPER, 30_000), gasto(BENCINA, 20_000)],
      "2026-10",
    );
    const porNombre = Object.fromEntries(
      r.lineas.map((l) => [l.presupuesto.categoria.nombre, l.gastado]),
    );
    expect(porNombre["Supermercado"]).toBe(30_000);
    expect(porNombre["Transporte"]).toBe(20_000);
  });

  test("pasarse se marca y el restante queda negativo", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 130_000)], "2026-10");

    expect(r.lineas[0]!.excedido).toBe(true);
    expect(r.lineas[0]!.restante).toBe(-30_000);
    expect(r.lineas[0]!.porcentaje).toBeCloseTo(130, 6);
    expect(r.excedidas).toBe(1);
  });

  test("el porcentaje no se recorta en 100: pasarse tiene que verse", () => {
    const r = armarPresupuestos([pres(SUPER, 10_000)], [gasto(SUPER, 50_000)], "2026-10");
    expect(r.lineas[0]!.porcentaje).toBe(500);
  });

  test("gastar justo el presupuesto lo deja agotado, pero no excedido", () => {
    // Justo en el tope ya no se puede gastar mas: la barra va en rojo. Pero
    // no te pasaste, asi que el texto no debe decir que te pasaste.
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 100_000)], "2026-10");

    expect(r.lineas[0]!.agotado).toBe(true);
    expect(r.lineas[0]!.excedido).toBe(false);
    expect(r.lineas[0]!.restante).toBe(0);
    // Dejo de ser "aviso": el aviso es mientras todavia queda algo.
    expect(r.lineas[0]!.alLimite).toBe(false);
  });

  test("un peso antes del tope todavia es aviso, no rojo", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 99_999)], "2026-10");

    expect(r.lineas[0]!.agotado).toBe(false);
    expect(r.lineas[0]!.alLimite).toBe(true);
  });

  test("pasarse tambien deja agotado", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 100_001)], "2026-10");

    expect(r.lineas[0]!.agotado).toBe(true);
    expect(r.lineas[0]!.excedido).toBe(true);
    expect(r.lineas[0]!.alLimite).toBe(false);
  });

  test("los tres estados nunca se pisan", () => {
    // Para cada monto gastado, exactamente uno de los tres colores manda.
    for (const gastadoEn of [0, 1, 50_000, 79_999, 80_000, 99_999, 100_000, 150_000]) {
      const r = armarPresupuestos(
        [pres(SUPER, 100_000)],
        gastadoEn === 0 ? [] : [gasto(SUPER, gastadoEn)],
        "2026-10",
      );
      const l = r.lineas[0]!;
      expect(
        [l.agotado, l.alLimite].filter(Boolean).length,
        `con ${gastadoEn} gastados, agotado=${l.agotado} alLimite=${l.alLimite}`,
      ).toBeLessThanOrEqual(1);
      if (l.excedido) expect(l.agotado).toBe(true);
    }
  });

  test("avisa cuando va por el 80% o más", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000), pres(BENCINA, 100_000)],
      [gasto(SUPER, 80_000), gasto(BENCINA, 79_000)],
      "2026-10",
    );
    const porNombre = Object.fromEntries(
      r.lineas.map((l) => [l.presupuesto.categoria.nombre, l.alLimite]),
    );
    expect(porNombre["Supermercado"]).toBe(true);
    expect(porNombre["Transporte"]).toBe(false);
  });

  test("excedido y alLimite no son verdaderos a la vez", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 120_000)], "2026-10");
    expect(r.lineas[0]!.excedido).toBe(true);
    expect(r.lineas[0]!.alLimite).toBe(false);
  });

  test("un gasto de otro mes no entra", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000)],
      [gasto(SUPER, 30_000, "2026-09-20"), gasto(SUPER, 10_000, "2026-10-02")],
      "2026-10",
    );
    expect(r.lineas[0]!.gastado).toBe(10_000);
  });

  test("un presupuesto de otro mes no aparece", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000, "2026-09"), pres(BENCINA, 50_000, "2026-10")],
      [],
      "2026-10",
    );
    expect(r.lineas).toHaveLength(1);
    expect(r.lineas[0]!.presupuesto.categoria.nombre).toBe("Transporte");
  });

  /**
   * Misma proteccion que en resumirMes: los pagos de cuota ya se descuentan
   * como cuotas en el balance. Si ademas consumieran un presupuesto, la
   * misma plata se contaria dos veces.
   */
  test("REGRESION: los pagos de cuota no consumen presupuesto", () => {
    const r = armarPresupuestos(
      [pres(DEUDAS, 200_000)],
      [gasto(DEUDAS, 168_000, "2026-10-05", { deudaId: "d1", deudaNombre: "Crédito" })],
      "2026-10",
    );

    expect(r.lineas[0]!.gastado).toBe(0);
    expect(r.lineas[0]!.restante).toBe(200_000);
  });

  test("ordena de más consumido a menos", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000), pres(BENCINA, 100_000), pres(ROPA, 100_000)],
      [gasto(SUPER, 10_000), gasto(BENCINA, 90_000), gasto(ROPA, 50_000)],
      "2026-10",
    );
    expect(r.lineas.map((l) => l.presupuesto.categoria.nombre)).toEqual([
      "Transporte",
      "Ropa",
      "Supermercado",
    ]);
  });

  test("a igual consumo, ordena por nombre para no bailar", () => {
    const r = armarPresupuestos(
      [pres(ROPA, 100_000), pres(SUPER, 100_000)],
      [gasto(ROPA, 50_000), gasto(SUPER, 50_000)],
      "2026-10",
    );
    expect(r.lineas.map((l) => l.presupuesto.categoria.nombre)).toEqual([
      "Ropa",
      "Supermercado",
    ]);
  });

  test("los totales suman solo lo presupuestado", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000), pres(BENCINA, 50_000)],
      [gasto(SUPER, 30_000), gasto(BENCINA, 20_000), gasto(ROPA, 999_999)],
      "2026-10",
    );

    expect(r.totalPresupuestado).toBe(150_000);
    expect(r.totalGastado).toBe(50_000);
    expect(r.totalRestante).toBe(100_000);
  });

  test("lista las categorías con gasto y sin presupuesto", () => {
    const r = armarPresupuestos(
      [pres(SUPER, 100_000)],
      [gasto(SUPER, 10_000), gasto(ROPA, 20_000), gasto(BENCINA, 5_000), gasto(ROPA, 1_000)],
      "2026-10",
    );

    expect(r.sinPresupuesto.map((c) => c.nombre)).toEqual(["Ropa", "Transporte"]);
  });

  test("una categoría con presupuesto no aparece como sin presupuesto", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [gasto(SUPER, 10_000)], "2026-10");
    expect(r.sinPresupuesto).toEqual([]);
  });

  test("un presupuesto sin gastos queda entero", () => {
    const r = armarPresupuestos([pres(SUPER, 100_000)], [], "2026-10");

    expect(r.lineas[0]!.gastado).toBe(0);
    expect(r.lineas[0]!.restante).toBe(100_000);
    expect(r.lineas[0]!.porcentaje).toBe(0);
    expect(r.lineas[0]!.alLimite).toBe(false);
  });
});

/**
 * REGRESION: con `=== null` un gasto sin el campo `cuota` se tomaba por
 * pago de cuota, y el presupuesto se quedaba en cero sin avisar. Un total
 * equivocado en silencio es peor que un error que se ve.
 */
describe("un gasto sin el campo cuota cuenta igual", () => {
  test("gasta el presupuesto aunque le falte el campo", () => {
    const sinCampo = { ...gasto(SUPER, 40_000) } as GastoPlano;
    delete (sinCampo as { cuota?: unknown }).cuota;

    const r = armarPresupuestos([pres(SUPER, 100_000)], [sinCampo], "2026-10");
    expect(r.lineas[0]!.gastado).toBe(40_000);
  });

  test("un pago de cuota de verdad sigue quedando fuera", () => {
    const conCuota = gasto(SUPER, 40_000, "2026-10-05", {
      deudaId: "d1",
      deudaNombre: "Crédito",
    });
    const r = armarPresupuestos([pres(SUPER, 100_000)], [conCuota], "2026-10");
    expect(r.lineas[0]!.gastado).toBe(0);
  });
});

describe("detalleDeCategoria", () => {
  test("solo trae los gastos de esa categoría y ese mes", () => {
    const d = detalleDeCategoria(
      [
        gasto(SUPER, 10_000, "2026-10-02"),
        gasto(BENCINA, 99_000, "2026-10-03"),
        gasto(SUPER, 20_000, "2026-09-28"),
      ],
      SUPER.id,
      "2026-10",
      31,
    );

    expect(d.cantidad).toBe(1);
    expect(d.total).toBe(10_000);
  });

  test("ordena del más nuevo al más viejo", () => {
    const d = detalleDeCategoria(
      [
        gasto(SUPER, 1_000, "2026-10-02"),
        gasto(SUPER, 2_000, "2026-10-20"),
        gasto(SUPER, 3_000, "2026-10-11"),
      ],
      SUPER.id,
      "2026-10",
      31,
    );
    expect(d.gastos.map((g) => g.fecha)).toEqual(["2026-10-20", "2026-10-11", "2026-10-02"]);
  });

  test("a igual fecha, el más caro primero y con desempate estable", () => {
    const a = gasto(SUPER, 5_000, "2026-10-10");
    const b = gasto(SUPER, 9_000, "2026-10-10");
    const uno = detalleDeCategoria([a, b], SUPER.id, "2026-10", 31).gastos.map((g) => g.monto);
    const otro = detalleDeCategoria([b, a], SUPER.id, "2026-10", 31).gastos.map((g) => g.monto);

    expect(uno).toEqual([9_000, 5_000]);
    expect(otro).toEqual(uno);
  });

  test("reparte en bloques de 7 días desde el día 1", () => {
    const d = detalleDeCategoria(
      [
        gasto(SUPER, 1_000, "2026-10-01"),
        gasto(SUPER, 2_000, "2026-10-07"),
        gasto(SUPER, 4_000, "2026-10-08"),
        gasto(SUPER, 8_000, "2026-10-31"),
      ],
      SUPER.id,
      "2026-10",
      31,
    );

    expect(d.semanas[0]!.total).toBe(3_000);
    expect(d.semanas[0]!.desde).toBe(1);
    expect(d.semanas[0]!.hasta).toBe(7);
    expect(d.semanas[1]!.total).toBe(4_000);
    expect(d.semanas.at(-1)!.total).toBe(8_000);
  });

  test("el último bloque se corta en el último día del mes", () => {
    const d = detalleDeCategoria([], SUPER.id, "2026-02", 28);
    expect(d.semanas).toHaveLength(4);
    expect(d.semanas.at(-1)!.hasta).toBe(28);
  });

  test("un mes de 31 días tiene 5 bloques, el último de 3 días", () => {
    const d = detalleDeCategoria([], SUPER.id, "2026-10", 31);
    expect(d.semanas).toHaveLength(5);
    expect(d.semanas.at(-1)).toMatchObject({ desde: 29, hasta: 31 });
  });

  test("las semanas sin gastos vienen igual, en cero", () => {
    const d = detalleDeCategoria([gasto(SUPER, 1_000, "2026-10-01")], SUPER.id, "2026-10", 31);
    expect(d.semanas[1]!.total).toBe(0);
    expect(d.semanas[1]!.gastos).toEqual([]);
  });

  test("la suma de las semanas es el total", () => {
    const d = detalleDeCategoria(
      [
        gasto(SUPER, 1_000, "2026-10-03"),
        gasto(SUPER, 2_000, "2026-10-12"),
        gasto(SUPER, 4_000, "2026-10-25"),
      ],
      SUPER.id,
      "2026-10",
      31,
    );
    expect(d.semanas.reduce((s, x) => s + x.total, 0)).toBe(d.total);
  });

  test("cuenta cuántos tienen boleta", () => {
    const conFoto = { ...gasto(SUPER, 1_000, "2026-10-03"), boletaArchivo: "a".repeat(32) + ".jpg" };
    const d = detalleDeCategoria(
      [conFoto, gasto(SUPER, 2_000, "2026-10-04")],
      SUPER.id,
      "2026-10",
      31,
    );
    expect(d.conBoleta).toBe(1);
  });

  test("REGRESION: los pagos de cuota quedan fuera, igual que del presupuesto", () => {
    const d = detalleDeCategoria(
      [
        gasto(SUPER, 10_000, "2026-10-02"),
        gasto(SUPER, 50_000, "2026-10-03", { deudaId: "d1", deudaNombre: "Crédito" }),
      ],
      SUPER.id,
      "2026-10",
      31,
    );

    expect(d.cantidad).toBe(1);
    expect(d.total).toBe(10_000);
  });

  test("una categoría sin gastos devuelve el esqueleto vacío", () => {
    const d = detalleDeCategoria([], SUPER.id, "2026-10", 31);
    expect(d.total).toBe(0);
    expect(d.cantidad).toBe(0);
    expect(d.gastos).toEqual([]);
    expect(d.semanas).toHaveLength(5);
  });
});

describe("avisos de la seccion", () => {
  const armar = (gastados: Record<string, number>) =>
    armarPresupuestos(
      [pres(SUPER, 100_000), pres(BENCINA, 100_000), pres(ROPA, 100_000)],
      [
        gasto(SUPER, gastados["super"] ?? 1),
        gasto(BENCINA, gastados["bencina"] ?? 1),
        gasto(ROPA, gastados["ropa"] ?? 1),
      ],
      "2026-10",
    );
  const nombres = (cs: { nombre: string }[]) => cs.map((c) => c.nombre).sort();

  test("cada categoria cae en un solo aviso", () => {
    const a = armar({ super: 85_000, bencina: 100_000, ropa: 130_000 }).alertas;

    expect(nombres(a.cerca)).toEqual(["Supermercado"]);
    expect(nombres(a.enElTope)).toEqual(["Transporte"]);
    expect(nombres(a.excedidas)).toEqual(["Ropa"]);
  });

  test("ninguna categoria sale en dos avisos a la vez", () => {
    for (const monto of [1, 50_000, 79_999, 80_000, 99_999, 100_000, 100_001, 500_000]) {
      const a = armar({ super: monto }).alertas;
      const veces = [a.cerca, a.enElTope, a.excedidas].filter((lista) =>
        lista.some((c) => c.nombre === "Supermercado"),
      ).length;
      expect(veces, `con ${monto} gastados aparece en ${veces} avisos`).toBeLessThanOrEqual(1);
    }
  });

  test("sin nada que avisar, las tres listas vienen vacias", () => {
    const a = armar({ super: 10_000, bencina: 10_000, ropa: 10_000 }).alertas;
    expect([...a.cerca, ...a.enElTope, ...a.excedidas]).toEqual([]);
  });

  test("el contador viejo y la lista nueva dicen lo mismo", () => {
    // Son dos fuentes para el mismo dato: si se separan, una miente.
    const r = armar({ super: 130_000, bencina: 200_000, ropa: 10_000 });
    expect(r.alertas.excedidas.length).toBe(r.excedidas);
  });
});
