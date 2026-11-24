import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Bandeja, ItemPorRevisar, ResultadoBandeja } from "@/dominio/bandeja";
import type { Revision } from "@/dominio/movimientos";
import type { CategoriaPlana } from "@/dominio/resumen";
import { BandejaPorRevisar, VISIBLES_EN_LA_BANDEJA } from "@/componentes/BandejaPorRevisar";
import { cuandoFue, detalleDe, fichaDe, medioDe, montoDe, textoJuntados } from "@/componentes/textos-bandeja";

/*
  Lo que se ve en la bandeja «Por revisar»: los textos de cada movimiento y
  el componente dibujado en el servidor, sin base de datos.
*/

const HOY = "2026-11-20";

const SUPER: CategoriaPlana = { id: "super", nombre: "Supermercado", color: "#ca8a04", icono: "shopping-cart", esencial: true };
const ARRIENDO: CategoriaPlana = { id: "arriendo", nombre: "Arriendo", color: "#0f766e", icono: "house", esencial: true };

function revision(cambios: Partial<Revision> = {}): Revision {
  return { propuesta: { como: "gasto" }, categoria: null, clave: { clave: "lider", etiqueta: "LIDER" }, lista: false, avisos: [], ...cambios };
}

function item(cambios: Partial<ItemPorRevisar> = {}): ItemPorRevisar {
  return {
    id: "m1",
    tipo: "COMPRA",
    sentido: "GASTO",
    monto: 23_480,
    moneda: "CLP",
    fecha: "2026-11-19",
    comercio: "LIDER EXPRESS LOS LEONES",
    fuente: "Aviso de Banco de Chile",
    medioPago: "CREDITO",
    ultimos4: "4821",
    cuotas: null,
    contraparte: { nombre: null, banco: null, ultimos4: null },
    confianza: null,
    juntados: [],
    revision: revision(),
    ...cambios,
  };
}

describe("los textos de cada movimiento", () => {
  test("cuando fue: hoy, ayer, el dia de esta semana, y despues la fecha", () => {
    expect(cuandoFue("2026-11-20", HOY)).toBe("Hoy");
    expect(cuandoFue("2026-11-19", HOY)).toBe("Ayer");
    expect(cuandoFue("2026-11-16", HOY)).toBe("Lunes 16");
    expect(cuandoFue("2026-11-05", HOY)).toBe("5 nov");
  });

  test("con que se pago: el medio y la tarjeta, o lo que se sepa", () => {
    expect(medioDe({ medioPago: "CREDITO", ultimos4: "4821" })).toBe("Crédito •••• 4821");
    expect(medioDe({ medioPago: "TRANSFERENCIA", ultimos4: "5678" })).toBe("Transferencia");
    expect(medioDe({ medioPago: null, ultimos4: "5678" })).toBe("•••• 5678");
    expect(medioDe({ medioPago: null, ultimos4: null })).toBeNull();
  });

  test("el monto en pesos, o en dolares con sus centavos", () => {
    expect(montoDe({ monto: 23_480, moneda: "CLP" })).toBe("$23.480");
    expect(montoDe({ monto: 1_599, moneda: "USD" })).toBe("US$15,99");
  });

  test("la ficha dice por que esta asi, y con su regla, a que categoria va", () => {
    expect(fichaDe(item())).toEqual({ texto: "Comercio nuevo: elige su categoría", tono: "acento" });
    expect(
      fichaDe(item({ revision: revision({ categoria: { categoriaId: "super", porque: "regla", de: "Líder" } }) }), "Supermercado"),
    ).toEqual({ texto: "Tu regla: Líder → Supermercado", tono: "neutro" });
    expect(
      fichaDe(item({ revision: revision({ categoria: { categoriaId: "super", porque: "historial", de: "Líder" } }) }), "Supermercado"),
    ).toEqual({ texto: "Como la última vez: Supermercado", tono: "neutro" });
    expect(fichaDe(item({ revision: revision({ avisos: ["ia"] }) })).texto).toBe("Leído con IA: revisa los datos");
    expect(fichaDe(item({ revision: revision({ avisos: ["dolares"] }) })).texto).toBe("En dólares: anota cuánto fue en pesos");
  });

  test("las preguntas van en ambar y explican que se encontro", () => {
    const duplicado = item({
      revision: revision({
        propuesta: {
          como: "mismo-gasto",
          gasto: { id: "g", fecha: "2026-11-19", descripcion: "Feria", monto: 23_480, categoriaId: "super", pagoDe: null, fuentes: [] },
        },
      }),
    });
    expect(fichaDe(duplicado)).toEqual({ texto: "Posible duplicado", tono: "alerta" });
    expect(detalleDe(duplicado, HOY)).toBe("Ayer anotaste «Feria» por $23.480.");

    const cuotas = item({
      revision: revision({ propuesta: { como: "deuda", deuda: { nombre: "PARIS.CL", cuotas: 3, montoCuota: 29_990, primeraCuota: "2026-12" } } }),
    });
    expect(fichaDe(cuotas)).toEqual({ texto: "Compra en 3 cuotas", tono: "alerta" });
    expect(detalleDe(cuotas, HOY)).toBe("3 cuotas de $29.990 desde diciembre: en Luka una cuota no es un gasto, es una deuda.");
  });

  test("el pago de una cuenta ya pagada se reconoce como tal", () => {
    const yaPagada = item({
      revision: revision({
        propuesta: {
          como: "mismo-gasto",
          gasto: {
            id: "g", fecha: "2026-11-12", descripcion: "Luz", monto: 23_480, categoriaId: "luz",
            pagoDe: { tipo: "cuenta", nombre: "Luz" }, fuentes: [],
          },
        },
      }),
    });
    expect(detalleDe(yaPagada, HOY)).toBe("Ya pagaste «Luz» por $23.480 (12 nov).");
  });

  test("lo que se junto se nombra, para que se sepa que cuenta una vez", () => {
    expect(textoJuntados([])).toBeNull();
    expect(textoJuntados(["Aviso de cargo de Consorcio"])).toBe(
      "También llegó: Aviso de cargo de Consorcio. Es el mismo movimiento: cuenta una vez.",
    );
  });
});

describe("la bandeja dibujada", () => {
  const accion = async (): Promise<ResultadoBandeja> => ({ ok: true, titulo: null, mensaje: null, deshacer: null, regla: null });
  const dibujar = (bandeja: Bandeja) =>
    renderToStaticMarkup(
      createElement(BandejaPorRevisar, {
        bandeja,
        categorias: [SUPER, ARRIENDO],
        hoy: HOY,
        accionConfirmar: accion,
        accionConfirmarListas: accion,
        accionDescartar: accion,
        accionAnotarIgual: accion,
        accionDeshacer: accion,
        accionCrearRegla: accion,
      }),
    );

  test("cada propuesta con su boton, y las listas con el suyo arriba", () => {
    const html = dibujar({
      visible: true,
      dejadosFuera: [],
      porRevisar: [
        item({
          id: "lista",
          revision: revision({ categoria: { categoriaId: "super", porque: "regla", de: "Líder" }, lista: true }),
        }),
        item({
          id: "cuotas",
          comercio: "PARIS.CL",
          revision: revision({ propuesta: { como: "deuda", deuda: { nombre: "PARIS.CL", cuotas: 3, montoCuota: 29_990, primeraCuota: "2026-12" } } }),
        }),
        item({
          id: "cuenta",
          comercio: "ENEL DISTRIBUCION",
          revision: revision({ propuesta: { como: "pago-de-cuenta", cuenta: { id: "c", nombre: "Luz", monto: 23_480, mes: "2026-11" } } }),
        }),
      ],
    });
    expect(html).toContain("Por revisar");
    expect(html).toContain("Confirmar 1 lista");
    expect(html).toContain("Tu regla: Líder → Supermercado");
    expect(html).toContain("Anotar como deuda");
    expect(html).toContain("Marcar pagada");
    expect(html).toContain("Parece el pago de «Luz», que tenías por pagar.");
    // La lista ya trae su categoria elegida.
    expect(html).toMatch(/<option value="super" selected="">Supermercado<\/option>/);
  });

  test("lo que no tiene categoria no esta listo: no hay boton de confirmar todas", () => {
    const html = dibujar({ visible: true, dejadosFuera: [], porRevisar: [item()] });
    expect(html).not.toMatch(/Confirmar \d+ lista/);
    expect(html).toContain("Elige una categoría");
  });

  test("en dolares pide el monto en pesos", () => {
    const html = dibujar({
      visible: true,
      dejadosFuera: [],
      porRevisar: [item({ moneda: "USD", monto: 1_599, revision: revision({ avisos: ["dolares"] }) })],
    });
    expect(html).toContain("¿Cuánto fue en pesos?");
    expect(html).toContain("US$15,99");
  });

  test("al dia: Luka echado, y lo que quedo fuera con su motivo", () => {
    const html = dibujar({
      visible: true,
      porRevisar: [],
      dejadosFuera: [
        {
          id: "f", comercio: "Pago de la tarjeta", monto: 412_300, moneda: "CLP", fecha: "2026-11-18",
          fuente: "Aviso de Santander", motivo: "pago-tarjeta", puedeAnotarse: true,
        },
      ],
    });
    expect(html).toContain("Todo al día");
    expect(html).toContain("Luka dejó fuera 1 movimiento (ver por qué)");
    expect(html).toContain("Es el pago de la tarjeta: cada compra con crédito ya cuenta por su lado.");
    expect(html).toContain("Anotar igual");
  });

  test("con muchos, se ven los primeros y el resto con «Ver todos»", () => {
    const muchos = Array.from({ length: VISIBLES_EN_LA_BANDEJA + 3 }, (_, i) => item({ id: `m${i}`, comercio: `Comercio ${i}` }));
    const html = dibujar({ visible: true, dejadosFuera: [], porRevisar: muchos });
    expect(html).toContain(`Comercio ${VISIBLES_EN_LA_BANDEJA - 1}`);
    expect(html).not.toContain(`Comercio ${VISIBLES_EN_LA_BANDEJA}<`);
    expect(html).toContain("Ver los 3 que faltan");
  });
});
