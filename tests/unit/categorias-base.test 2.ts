import { describe, expect, test } from "vitest";
import {
  CATEGORIAS_BASE,
  CATEGORIAS_CON_COLOR,
  FONDO_CLARO,
  FONDO_OSCURO,
  GRUPOS_CATEGORICOS,
  GRUPOS_GASTO,
  colorDeGrupo,
} from "@/dominio/categorias-base";
import {
  contraste,
  croma,
  distanciaPerceptual,
  parMasCercano,
  sirveParaGrafico,
  sirveParaTexto,
  textoLegibleSobre,
} from "@/lib/contraste";
import { NOMBRES_ICONO } from "@/componentes/iconos";

describe("integridad de la paleta base", () => {
  test("los nombres no se repiten", () => {
    const nombres = CATEGORIAS_BASE.map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  test("cada categoria apunta a un grupo que existe", () => {
    for (const c of CATEGORIAS_BASE) {
      expect(GRUPOS_GASTO, `${c.nombre} apunta a "${c.grupo}"`).toHaveProperty(c.grupo);
    }
  });

  test("todos los colores de grupo son hex de 6 digitos", () => {
    for (const clave of Object.keys(GRUPOS_GASTO) as (keyof typeof GRUPOS_GASTO)[]) {
      expect(GRUPOS_GASTO[clave].color, `${clave} tiene un color raro`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
  });

  test("el color resuelto es siempre el del grupo", () => {
    for (const c of CATEGORIAS_CON_COLOR) {
      expect(c.color, `${c.nombre} se desalineo de su grupo`).toBe(colorDeGrupo(c.grupo));
    }
  });

  test("cada icono existe en el componente Icono", () => {
    for (const c of CATEGORIAS_BASE) {
      expect(
        NOMBRES_ICONO as readonly string[],
        `el icono "${c.icono}" de ${c.nombre} no esta dibujado`,
      ).toContain(c.icono);
    }
  });

  test("cada categoria tiene un icono propio: el color nunca identifica solo", () => {
    const iconos = CATEGORIAS_BASE.map((c) => c.icono);
    expect(new Set(iconos).size).toBe(iconos.length);
  });

  test("todos los grupos se usan", () => {
    const usados = new Set(CATEGORIAS_BASE.map((c) => c.grupo));
    for (const clave of Object.keys(GRUPOS_GASTO)) {
      expect(usados, `el grupo "${clave}" quedo sin categorias`).toContain(clave);
    }
  });

  test("hay categorias esenciales y discrecionales", () => {
    expect(CATEGORIAS_BASE.some((c) => c.esencial)).toBe(true);
    expect(CATEGORIAS_BASE.some((c) => !c.esencial)).toBe(true);
  });

  test("los nombres caben en VARCHAR(60)", () => {
    for (const c of CATEGORIAS_BASE) {
      expect(c.nombre.length).toBeLessThanOrEqual(60);
    }
  });
});

/**
 * La misma tarjeta se dibuja sobre fondo claro y sobre fondo oscuro, asi que
 * cada color tiene que alcanzar 3:1 contra los dos (WCAG 1.4.11). Esta es la
 * restriccion dura: es la que decide cuantos colores caben.
 */
describe("la paleta rinde en los dos modos", () => {
  for (const clave of Object.keys(GRUPOS_GASTO) as (keyof typeof GRUPOS_GASTO)[]) {
    const { nombre, color } = GRUPOS_GASTO[clave];

    test(`${nombre} alcanza 3:1 en claro y en oscuro`, () => {
      const claro = contraste(color, FONDO_CLARO);
      const oscuro = contraste(color, FONDO_OSCURO);

      expect(
        sirveParaGrafico(color, FONDO_CLARO),
        `${color} sobre claro da ${claro.toFixed(2)}:1`,
      ).toBe(true);

      expect(
        sirveParaGrafico(color, FONDO_OSCURO),
        `${color} sobre oscuro da ${oscuro.toFixed(2)}:1`,
      ).toBe(true);
    });

    test(`${nombre} deja leer el texto encima`, () => {
      const tinta = textoLegibleSobre(color);
      expect(
        sirveParaTexto(tinta, color),
        `${color} con ${tinta} da ${contraste(tinta, color).toFixed(2)}:1`,
      ).toBe(true);
    });
  }
});

/**
 * Separacion entre los colores. Es otra cosa que el contraste: el contraste
 * dice si el color se ve, esto dice si se distingue de los demas.
 *
 * Se mide entre TODOS los pares, no entre vecinos, porque en una grilla de
 * tarjetas se ven todas al mismo tiempo.
 *
 * Los numeros salen del validador de la habilidad dataviz. El gris de "Otros"
 * no entra: es el neutro, y a proposito no pasa el piso de croma.
 */
describe("los grupos se distinguen entre si", () => {
  const categoricos = GRUPOS_CATEGORICOS.map((g) => GRUPOS_GASTO[g].color);

  test("son 5 colores categoricos mas el neutro", () => {
    expect(categoricos).toHaveLength(5);
    expect(Object.keys(GRUPOS_GASTO)).toHaveLength(6);
  });

  test("REGRESION: vision normal se mantiene sobre delta E 15", () => {
    const peor = parMasCercano(categoricos);
    expect(peor).not.toBeNull();
    expect(
      peor!.distancia,
      `${peor!.a} y ${peor!.b} quedaron a ${peor!.distancia.toFixed(1)}`,
    ).toBeGreaterThanOrEqual(15);
  });

  test("REGRESION: daltonismo se mantiene sobre el piso de 6", () => {
    for (const tipo of ["protan", "deutan", "tritan"] as const) {
      const peor = parMasCercano(categoricos, tipo);
      expect(
        peor!.distancia,
        `con ${tipo}, ${peor!.a} y ${peor!.b} quedaron a ${peor!.distancia.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  test("los 5 categoricos pasan el piso de croma de 0.1", () => {
    for (const clave of GRUPOS_CATEGORICOS) {
      const { nombre, color } = GRUPOS_GASTO[clave];
      expect(croma(color), `${nombre} (${color}) se lee como gris`).toBeGreaterThanOrEqual(
        0.1,
      );
    }
  });

  test("el neutro de Otros es gris de verdad y queda fuera de la paleta", () => {
    expect(croma(GRUPOS_GASTO.otros.color)).toBeLessThan(0.1);
    expect(GRUPOS_CATEGORICOS as readonly string[]).not.toContain("otros");
  });

  test("el recorte al gamut importa: sin el, el daltonismo sale optimista", () => {
    // Es la razon por la que simularCvd recorta a [0,1]. Si alguien saca ese
    // recorte, este test deja de tener sentido y hay que revisar los pisos.
    const azul = GRUPOS_GASTO.movilidad.color;
    const morado = GRUPOS_GASTO.ocio.color;
    expect(distanciaPerceptual(azul, morado, "protan")).toBeLessThan(
      distanciaPerceptual(azul, morado),
    );
  });
});
