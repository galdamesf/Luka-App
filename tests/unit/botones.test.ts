import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { contraste, distanciaPerceptual, sirveParaGrafico, sirveParaTexto } from "@/lib/contraste";

/**
 * Los botones de Luka son los de la portada en todas partes: durazno, con
 * mayusculas espaciadas, esquinas de 13 px y el canto que se hunde (.boton-luka
 * en globals.css). Los enlaces de texto van en tinta con subrayado durazno
 * (.enlace-luka). El violeta (--accion) queda solo como color de identidad de
 * algunas secciones, nunca en algo que se aprieta.
 */

const RAIZ = resolve(process.cwd());
const css = readFileSync(join(RAIZ, "src/app/globals.css"), "utf8");

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

function reglaDe(selector: string): string {
  const inicio = css.indexOf(`${selector} {`);
  expect(inicio, `no encontre ${selector}`).toBeGreaterThan(-1);
  return css.slice(inicio, css.indexOf("}", inicio));
}

describe("el boton de Luka", () => {
  test("es el de la portada: durazno, 13 px, mayusculas y canto de 3 px", () => {
    const regla = reglaDe(".boton-luka");
    expect(regla).toContain("background: var(--acento);");
    expect(regla).toContain("color: var(--acento-tinta);");
    expect(regla).toContain("border-radius: 13px;");
    expect(regla).toContain("box-shadow: 0 3px 0 var(--acento-canto);");
    expect(regla).toContain("text-transform: uppercase;");
    expect(regla).toContain("letter-spacing: 0.08em;");
  });

  const claro = tokensDe(":root {");
  const oscuro = { ...claro, ...tokensDe(':root[data-theme="dark"] {') };

  for (const [modo, tema] of [["claro", claro], ["oscuro", oscuro]] as const) {
    describe(`modo ${modo}`, () => {
      test("su texto se lee encima del durazno", () => {
        const f = tema["acento-tinta"] as string;
        const b = tema["acento"] as string;
        expect(sirveParaTexto(f, b), `acento-tinta sobre acento da ${contraste(f, b).toFixed(2)}:1`).toBe(true);
      });

      // En claro el durazno sobre blanco no llega a 3:1: lo que marca el borde
      // del boton es su canto. En oscuro el durazno mismo ya se recorta.
      test("se distingue de la carta y de la pagina", () => {
        const borde = modo === "claro" ? (tema["acento-canto"] as string) : (tema["acento"] as string);
        for (const fondo of ["superficie", "fondo"] as const) {
          const b = tema[fondo] as string;
          expect(sirveParaGrafico(borde, b), `${borde} sobre ${fondo} (${b}) da ${contraste(borde, b).toFixed(2)}:1`).toBe(true);
        }
      });

      // Un boton que se parezca a una senal se lee como un aviso.
      test("no se confunde con ningun color de senal", () => {
        for (const senal of ["exito-fuerte", "alerta", "peligro", "avance"] as const) {
          const d = distanciaPerceptual(tema["acento"] as string, tema[senal] as string);
          expect(d, `--acento esta a ${d.toFixed(1)} de --${senal}`).toBeGreaterThan(10);
        }
      });
    });
  }
});

/* ------------------------- Nada violeta se aprieta ------------------------- */

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(carpeta, e.name)) : e.name.endsWith(".tsx") ? [join(carpeta, e.name)] : [],
  );
}

/**
 * Las etiquetas de apertura de lo que se aprieta (boton, enlace, summary),
 * con sus atributos. `=>` dentro de un atributo no corta la etiqueta.
 */
function interactivos(fuente: string): string[] {
  return [...fuente.matchAll(/<(?:button|a|Link|summary)\b(?:=>|[^>])*>/g)].map((m) => m[0]);
}

describe("en la app, nada que se aprieta va en violeta", () => {
  const fuentes = archivos(join(RAIZ, "src")).map((ruta) => ({ ruta: ruta.slice(RAIZ.length + 1), texto: readFileSync(ruta, "utf8") }));

  test("ningun boton ni enlace usa el violeta de --accion", () => {
    const violetas = fuentes.flatMap(({ ruta, texto }) =>
      interactivos(texto)
        .filter((etiqueta) => /\b(?:bg|text|border|ring|shadow|stroke)-accion\b/.test(etiqueta))
        .map((etiqueta) => `${ruta}: ${etiqueta.replace(/\s+/g, " ").slice(0, 120)}`),
    );
    expect(violetas).toEqual([]);
  });

  test("nadie usa el texto sobre violeta: ya no hay botones violeta", () => {
    const usos = fuentes.filter(({ texto }) => texto.includes("accion-texto")).map(({ ruta }) => ruta);
    expect(usos).toEqual([]);
  });

  test("los botones principales son .boton-luka", () => {
    const principales = fuentes.filter(({ texto }) => texto.includes("boton-luka")).map(({ ruta }) => ruta);
    for (const ruta of [
      "src/componentes/RegistrarGastoEmergente.tsx",
      "src/componentes/FormularioGasto.tsx",
      "src/componentes/AjusteDiaInicio.tsx",
      "src/componentes/Ahorros.tsx",
      "src/componentes/ConfirmarSalida.tsx",
    ]) {
      expect(principales).toContain(ruta);
    }
  });
});
