import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { PALETA_PAISAJE as PALETA } from "@/componentes/portada/paleta-paisaje";
import {
  contraste,
  distanciaPerceptual,
  luminancia,
  parMasCercano,
  sirveParaGrafico,
  sirveParaTexto,
  textoLegibleSobre,
} from "@/lib/contraste";

describe("luminancia", () => {
  test("los extremos dan 0 y 1", () => {
    expect(luminancia("#000000")).toBeCloseTo(0, 5);
    expect(luminancia("#ffffff")).toBeCloseTo(1, 5);
  });

  test("rechaza formatos que no sean #RRGGBB", () => {
    expect(() => luminancia("#fff")).toThrow(/invalido/i);
    expect(() => luminancia("rojo")).toThrow(/invalido/i);
  });
});

describe("contraste", () => {
  test("blanco sobre negro da el maximo de 21:1", () => {
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  test("un color contra si mismo da 1:1", () => {
    expect(contraste("#15803d", "#15803d")).toBeCloseTo(1, 5);
  });

  test("es simetrico", () => {
    expect(contraste("#0f172a", "#f8fafc")).toBeCloseTo(contraste("#f8fafc", "#0f172a"), 10);
  });
});

describe("textoLegibleSobre", () => {
  test("elige negro sobre colores claros y blanco sobre oscuros", () => {
    expect(textoLegibleSobre("#f8fafc")).toBe("#000000");
    expect(textoLegibleSobre("#0f172a")).toBe("#ffffff");
  });
});

describe("distanciaPerceptual", () => {
  test("un color contra si mismo da cero", () => {
    expect(distanciaPerceptual("#16a34a", "#16a34a")).toBeCloseTo(0, 6);
  });

  test("es simetrica", () => {
    expect(distanciaPerceptual("#16a34a", "#e11d48")).toBeCloseTo(
      distanciaPerceptual("#e11d48", "#16a34a"), 10,
    );
  });

  test("blanco y negro estan lo mas lejos posible", () => {
    expect(distanciaPerceptual("#000000", "#ffffff")).toBeGreaterThan(95);
  });

  test("dos tonos del mismo verde quedan cerca", () => {
    expect(distanciaPerceptual("#16a34a", "#15803d")).toBeLessThan(15);
  });

  test("colores de familias distintas quedan lejos", () => {
    expect(distanciaPerceptual("#16a34a", "#e11d48")).toBeGreaterThan(30);
  });

  test("mide algo distinto que el contraste WCAG", () => {
    // Dos azules con contraste casi igual contra blanco y que igual se
    // distinguen entre si: el contraste no sirve para esto.
    const a = "#2563eb", b = "#0369a1";
    expect(Math.abs(contraste(a, "#ffffff") - contraste(b, "#ffffff"))).toBeLessThan(1.5);
    expect(distanciaPerceptual(a, b)).toBeGreaterThan(8);
  });

  test("rechaza formatos invalidos", () => {
    expect(() => distanciaPerceptual("#fff", "#000000")).toThrow(/invalido/i);
  });
});

describe("parMasCercano", () => {
  test("encuentra el par mas confundible de una lista", () => {
    const p = parMasCercano(["#16a34a", "#e11d48", "#15803d"]);
    expect([p?.a, p?.b].sort()).toEqual(["#15803d", "#16a34a"]);
  });

  test("con menos de dos colores no hay par", () => {
    expect(parMasCercano([])).toBeNull();
    expect(parMasCercano(["#16a34a"])).toBeNull();
  });
});

/**
 * Estos tests leen globals.css de verdad. Si alguien cambia un token del tema
 * y rompe la accesibilidad, revientan aca y no en la cara del usuario.
 */
describe("el tema de globals.css cumple WCAG AA", () => {
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

  const PARES_TEXTO: ReadonlyArray<readonly [string, string]> = [
    ["texto", "fondo"],
    ["texto", "superficie"],
    ["texto-tenue", "fondo"],
    ["texto-tenue", "superficie"],
    ["exito", "superficie"],
    ["alerta", "superficie"],
    ["peligro", "superficie"],
    ["foco", "fondo"],
    // La banda nocturna del paseo: su texto sobre su fondo y sobre su carta.
    ["noche-texto", "noche"],
    ["noche-tenue", "noche"],
    ["noche-texto", "noche-superficie"],
    ["noche-tenue", "noche-superficie"],
  ];

  for (const [modo, tema] of [["claro", claro], ["oscuro", oscuro]] as const) {
    describe(`modo ${modo}`, () => {
      test("define todos los tokens esperados", () => {
        for (const token of ["fondo", "superficie", "superficie-tenue", "texto", "texto-tenue", "primario", "primario-texto", "exito", "exito-fuerte", "alerta", "peligro", "avance", "pie", "pie-texto", "foco", "acento", "acento-fuerte", "acento-tinta", "durazno", "durazno-texto", "durazno-tenue", "durazno-realce", "noche", "noche-superficie", "noche-borde", "noche-texto", "noche-tenue"]) {
          expect(tema[token], `falta --${token} en modo ${modo}`).toBeDefined();
        }
      });

      for (const [frente, fondo] of PARES_TEXTO) {
        test(`${frente} sobre ${fondo} alcanza 4.5:1`, () => {
          const f = tema[frente] as string;
          const b = tema[fondo] as string;
          const razon = contraste(f, b);
          expect(
            sirveParaTexto(f, b),
            `${frente} (${f}) sobre ${fondo} (${b}) da ${razon.toFixed(2)}:1`,
          ).toBe(true);
        });
      }

      // Los rellenos de barra se dibujan sobre el RIEL (--superficie-tenue),
      // no sobre la card. Medirlos contra la card deja pasar colores que en
      // pantalla no alcanzan: ya paso una vez con el ocre de Alimentacion.
      for (const relleno of ["exito-fuerte", "avance", "alerta", "peligro"] as const) {
        test(`${relleno} alcanza 3:1 como relleno de barras`, () => {
          for (const fondo of ["superficie-tenue", "superficie", "fondo"] as const) {
            const f = tema[relleno] as string;
            const b = tema[fondo] as string;
            const razon = contraste(f, b);
            expect(
              sirveParaGrafico(f, b),
              `${relleno} (${f}) sobre ${fondo} (${b}) da ${razon.toFixed(2)}:1`,
            ).toBe(true);
          }
        });
      }

      // Los botones de accion llevan texto ENCIMA del color, no al lado:
      // ahi ya no basta 3:1, hace falta 4.5:1 como cualquier texto.
      test.each([["primario"], ["peligro"], ["exito"]])(
        "el texto sobre un boton %s se lee",
        (fondo) => {
          const f = tema["primario-texto"] as string;
          const b = tema[fondo] as string;
          expect(
            sirveParaTexto(f, b),
            `primario-texto (${f}) sobre ${fondo} (${b}) da ${contraste(f, b).toFixed(2)}:1`,
          ).toBe(true);
        },
      );

      // El pie es una banda oscura en los DOS temas, asi que su texto no se
      // mide contra las superficies de la pagina sino contra el mismo --pie.
      test("el texto del pie se lee sobre la banda del pie", () => {
        const f = tema["pie-texto"] as string;
        const b = tema["pie"] as string;
        expect(
          sirveParaTexto(f, b),
          `pie-texto (${f}) sobre pie (${b}) da ${contraste(f, b).toFixed(2)}:1`,
        ).toBe(true);
      });

      // La banda --durazno de la portada es clara en los dos temas, asi que
      // su texto se mide contra ella y no contra las superficies de la
      // pagina, igual que el del pie.
      test.each([["durazno-texto"], ["durazno-tenue"], ["durazno-realce"]])(
        "%s se lee sobre la banda de durazno",
        (frente) => {
          const f = tema[frente] as string;
          const b = tema["durazno"] as string;
          expect(
            sirveParaTexto(f, b),
            `${frente} (${f}) sobre durazno (${b}) da ${contraste(f, b).toFixed(2)}:1`,
          ).toBe(true);
        },
      );

      test("la banda de durazno es clara en los dos temas", () => {
        // Si siguiera al tema, en oscuro quedaria texto oscuro sobre fondo
        // oscuro: es el mismo error que --pie evita al reves.
        expect(
          luminancia(tema["durazno"] as string),
          `--durazno (${tema["durazno"]}) no es claro en modo ${modo}`,
        ).toBeGreaterThan(0.6);
      });

      test("el texto del boton de acento se lee encima del relleno", () => {
        const f = tema["acento-tinta"] as string;
        const b = tema["acento"] as string;
        expect(
          sirveParaTexto(f, b),
          `acento-tinta (${f}) sobre acento (${b}) da ${contraste(f, b).toFixed(2)}:1`,
        ).toBe(true);
      });

      // Lo mas importante de este bloque: el acento NO puede parecerse a
      // ninguno de los cuatro colores de senal, o el boton de "Iniciar
      // sesion" se lee como un aviso de presupuesto. Antes la portada usaba
      // el ocre de --alerta, que era literalmente el mismo color.
      test.each([
        ["acento"],
        ["durazno-realce"],
      ])(
        "%s no se confunde con ningun color de senal",
        (token) => {
        for (const senal of ["exito-fuerte", "alerta", "peligro", "avance"] as const) {
          const d = distanciaPerceptual(tema[token] as string, tema[senal] as string);
          expect(
            d,
            `--${token} (${tema[token]}) esta a ${d.toFixed(1)} de --${senal} (${tema[senal]})`,
          ).toBeGreaterThan(10);
        }
      });

      test("el pie es oscuro en los dos temas", () => {
        // Si alguien lo cambiara por --primario, en oscuro quedaria blanco.
        expect(
          luminancia(tema["pie"] as string),
          `--pie (${tema["pie"]}) no es oscuro en modo ${modo}`,
        ).toBeLessThan(0.1);
      });

      test("el azul de progreso no es el mismo color que el anillo de foco", () => {
        // Si fueran identicos, un relleno cualquiera se veria igual que la
        // marca de "esto es lo que tiene el teclado encima".
        expect(tema["avance"]).not.toBe(tema["foco"]);
      });
    });
  }
});

describe("la paleta del paisaje del header", () => {
  // El paisaje es una pintura y no sigue al tema, asi que se mide una sola vez.
  // Lo que se vigila es que ningun tono del dibujo se acerque a los cuatro
  // colores con que Luka avisa: un cerro verde diria "te sobra plata" y un
  // alamo azul diria "deuda". El color de esta app significa algo.
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const raiz = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const senal = (nombre: string): string => {
    const m = new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6});`).exec(raiz);
    expect(m, `falta --${nombre} en :root`).not.toBeNull();
    return ((m as RegExpExecArray)[1] as string).toLowerCase();
  };
  const senales = ["exito-fuerte", "alerta", "peligro", "avance"] as const;
  const tonos = Object.entries(PALETA);

  test("tiene todos los planos del dibujo", () => {
    for (const plano of ["cielo-2", "nieve-luz", "roca-luz", "roca-sombra", "pre-cerca", "llano-cerca", "alamo", "matorral", "pirca", "senda"]) {
      expect(PALETA[plano as keyof typeof PALETA], `falta ${plano} en la paleta`).toBeDefined();
    }
  });

  test.each(tonos)("%s no se confunde con ningun color de senal", (nombre, hex) => {
    for (const nombreSenal of senales) {
      const d = distanciaPerceptual(hex, senal(nombreSenal));
      expect(
        d,
        `${nombre} (${hex}) esta a ${d.toFixed(1)} de --${nombreSenal}`,
      ).toBeGreaterThan(10);
    }
  });

  test("el texto del header se lee sobre CUALQUIER banda del cielo", () => {
    // El titular y su bajada no descansan sobre --durazno a secas: descansan
    // sobre las bandas pintadas del cielo, que bajan hasta un arrebol bastante
    // mas saturado. Medir solo contra el token dejaba pasar texto ilegible
    // sobre la banda dorada, que es justo donde cae la nota de Google.
    const cielo = ["cielo-2", "cielo-3", "cielo-4", "dorado"] as const;
    const sobreTexto = ["durazno-texto", "durazno-tenue", "durazno-realce"] as const;
    const raizTexto = (n: string) => {
      const m = new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6});`).exec(raiz);
      return ((m as RegExpExecArray)[1] as string).toLowerCase();
    };
    for (const t of sobreTexto) {
      for (const banda of cielo) {
        const f = raizTexto(t);
        const b = PALETA[banda];
        expect(
          sirveParaTexto(f, b),
          `--${t} (${f}) sobre la banda ${banda} (${b}) da ${contraste(f, b).toFixed(2)}:1`,
        ).toBe(true);
      }
    }
  });

  test("el frente es oscuro: Luka es claro y tiene que recortarse contra el", () => {
    // Sin esta franja oscura el perro desaparece sobre el paisaje. Es una
    // regla del dibujo, no una preferencia.
    for (const plano of ["matorral", "pirca", "borde"] as const) {
      expect(luminancia(PALETA[plano]), `${plano} deberia ser oscuro`).toBeLessThan(0.3);
    }
  });
});
