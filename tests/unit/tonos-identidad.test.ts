import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { IDENTIDAD_FACTOR, TONOS } from "@/componentes/tonos";
import { NOMBRES_ICONO } from "@/componentes/iconos";
import { contraste, parMasCercano, sirveParaGrafico } from "@/lib/contraste";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function tokensDe(selector: string): Record<string, string> {
  const inicio = css.indexOf(selector);
  expect(inicio, `no encontre el bloque ${selector}`).toBeGreaterThan(-1);
  const bloque = css.slice(inicio, css.indexOf("}", inicio));
  const tokens: Record<string, string> = {};
  for (const linea of bloque.split("\n")) {
    const m = /^\s*--([a-z-]+):\s*(#[0-9a-fA-F]{6});/.exec(linea);
    if (m) tokens[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return tokens;
}

const claro = tokensDe(":root {");
const oscuro = tokensDe(':root[data-theme="dark"]');
const tonos = Object.keys(TONOS).map((nombre) => {
  const color = claro[`tono-${nombre}`];
  expect(color, `falta --tono-${nombre} en :root`).toBeDefined();
  return [nombre, color as string] as const;
});

describe("tonos de identidad", () => {
  test("cada tono del codigo tiene su token, y no sobra ninguno", () => {
    const enCss = Object.keys(claro).filter((t) => t.startsWith("tono-")).map((t) => t.slice(5));
    expect(enCss.sort()).toEqual(Object.keys(TONOS).sort());
  });

  test("el modo oscuro no los redefine: valen igual en los dos temas", () => {
    expect(Object.keys(oscuro).filter((t) => t.startsWith("tono-"))).toEqual([]);
  });

  test("cada uno pasa 3:1 contra fondo, superficie y riel, en claro y en oscuro", () => {
    for (const [nombre, color] of tonos) {
      for (const [tema, tokens] of [["claro", claro], ["oscuro", oscuro]] as const) {
        for (const fondo of ["fondo", "superficie", "superficie-tenue"] as const) {
          const otro = tokens[fondo] as string;
          expect(
            sirveParaGrafico(color, otro),
            `${nombre} sobre ${fondo} ${tema}: ${contraste(color, otro).toFixed(2)}:1`,
          ).toBe(true);
        }
      }
    }
  });

  test("el icono blanco de la ficha se ve sobre cada uno", () => {
    for (const [nombre, color] of tonos) {
      expect(contraste("#ffffff", color), nombre).toBeGreaterThanOrEqual(3);
    }
  });

  test("se distinguen entre si en vision normal", () => {
    const par = parMasCercano(tonos.map(([, color]) => color));
    // 12 y no 15: nunca son la unica pista, cada uno va con nombre e icono.
    expect(par?.distancia, `${par?.a} y ${par?.b} se parecen`).toBeGreaterThanOrEqual(12);
  });
});

describe("identidad de los factores del Health Score", () => {
  const factores = Object.entries(IDENTIDAD_FACTOR);

  test("cada factor tiene un tono y un icono propios", () => {
    expect(new Set(factores.map(([, f]) => f.tono)).size).toBe(factores.length);
    expect(new Set(factores.map(([, f]) => f.icono)).size).toBe(factores.length);
  });

  test("los iconos existen", () => {
    for (const [clave, f] of factores) {
      expect(NOMBRES_ICONO as readonly string[], `${clave}: ${f.icono}`).toContain(f.icono);
    }
  });
});
