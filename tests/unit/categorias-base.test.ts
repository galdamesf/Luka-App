import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    for (const [i, c] of CATEGORIAS_CON_COLOR.entries()) {
      const base = CATEGORIAS_BASE[i]!;
      expect(c.nombre).toBe(base.nombre);
      expect(c.color, `${c.nombre} se desalineo de su grupo`).toBe(colorDeGrupo(base.grupo));
    }
  });

  /**
   * REGRESION: el seed se cayo con "Unknown argument `grupo`".
   *
   * CATEGORIAS_CON_COLOR se pasa tal cual a prisma.categoria.upsert, asi que
   * cada llave tiene que ser una columna real. El typecheck no lo atrapa:
   * esparcir un objeto no dispara el chequeo de propiedades de mas, y el
   * error solo aparece al correr el seed contra la base.
   */
  test("REGRESION: las llaves del seed existen como columnas en schema.prisma", () => {
    const esquema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );

    const bloque = esquema.match(/model Categoria \{([\s\S]*?)\n\}/);
    expect(bloque, "no encontre el modelo Categoria en schema.prisma").not.toBeNull();

    const columnas = new Set(
      bloque![1]!
        .split("\n")
        .map((linea) => linea.trim())
        .filter((linea) => linea !== "" && !linea.startsWith("//") && !linea.startsWith("@@"))
        .map((linea) => linea.split(/\s+/)[0]!)
        .filter((nombre) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(nombre)),
    );

    for (const fila of CATEGORIAS_CON_COLOR) {
      for (const llave of Object.keys(fila)) {
        expect(
          columnas,
          `"${llave}" no es columna de Categoria: el seed se va a caer`,
        ).toContain(llave);
      }
    }
  });

  test("el seed manda las cuatro columnas que necesita", () => {
    expect(Object.keys(CATEGORIAS_CON_COLOR[0]!).sort()).toEqual([
      "color",
      "esencial",
      "icono",
      "nombre",
    ]);
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

/**
 * REGRESION: el test medía contra el fondo equivocado.
 *
 * Las barras de categoria se dibujan sobre `--superficie-tenue` (el riel),
 * no sobre `--superficie` (la card). Validar contra la card daba todo en
 * verde mientras cuatro de seis colores fallaban de verdad.
 *
 * Esto ata las constantes al CSS: si alguien cambia el riel y no actualiza
 * FONDO_CLARO / FONDO_OSCURO, cae aqui en vez de pasar mintiendo.
 */
describe("las constantes apuntan al riel de verdad", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  function rielDe(bloque: string): string {
    const m = bloque.match(/--superficie-tenue:\s*(#[0-9a-fA-F]{6})/);
    expect(m, "no encontré --superficie-tenue en ese bloque").not.toBeNull();
    return m![1]!.toLowerCase();
  }

  test("FONDO_CLARO es el riel del modo claro", () => {
    const claro = css.slice(css.indexOf(":root"), css.indexOf("@media"));
    expect(rielDe(claro)).toBe(FONDO_CLARO.toLowerCase());
  });

  test("FONDO_OSCURO es el riel del modo oscuro", () => {
    const oscuro = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(rielDe(oscuro)).toBe(FONDO_OSCURO.toLowerCase());
  });

  test("el riel NO es la superficie de la card: son cosas distintas", () => {
    const claro = css.slice(css.indexOf(":root"), css.indexOf("@media"));
    const card = claro.match(/--superficie:\s*(#[0-9a-fA-F]{6})/)![1]!.toLowerCase();
    expect(card).not.toBe(rielDe(claro));
  });
});

describe("el seed no deja campos afuera", () => {
  // Cambiar `esencial` en el codigo no hacia nada en las categorias que ya
  // existian: el `update` del seed solo refrescaba color, icono y orden, asi
  // que la categoria vieja se quedaba con el valor con el que nacio. Solo se
  // notaba al mirar por que un gasto caia en la linea equivocada del balance.
  const seed = readFileSync(
    new URL("../../prisma/seed.ts", import.meta.url),
    "utf-8",
  );
  const update = seed.slice(seed.indexOf("update: {"), seed.indexOf("create: {"));

  test.each(
    Object.keys(CATEGORIAS_CON_COLOR[0]!).filter((campo) => campo !== "nombre"),
  )("el update del seed refresca %s", (campo) => {
    expect(update, `falta "${campo}" en el update del seed`).toContain(`${campo}:`);
  });
});
