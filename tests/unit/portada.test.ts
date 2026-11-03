import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { contraste, sirveParaGrafico, sirveParaTexto } from "@/lib/contraste";
import { Luka, type PoseLuka } from "@/componentes/Luka";

// El heroe importa la accion de entrada, que a su vez trae Auth.js. Aqui solo
// interesa lo que se dibuja, asi que la accion se reemplaza por una vacia.
vi.mock("@/app/acciones/entrar", () => ({ entrarConGoogle: async () => {} }));

/* ------------------------------ Los tonos ------------------------------ */

describe("los tonos de la portada", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  function tokensDe(selector: string, desde = 0): Record<string, string> {
    const inicio = css.indexOf(selector, desde);
    expect(inicio, `no encontre el bloque ${selector}`).toBeGreaterThan(-1);
    const bloque = css.slice(inicio, css.indexOf("}", inicio));
    const tokens: Record<string, string> = {};
    for (const linea of bloque.split("\n")) {
      const m = /^\s*--([a-z-]+):\s*(#[0-9a-fA-F]{6});/.exec(linea);
      if (m) tokens[m[1] as string] = (m[2] as string).toLowerCase();
    }
    return tokens;
  }

  // La portada redefine los tokens de la app; los que no toca (acento,
  // semaforo) siguen siendo los de la app en cada modo.
  const app = { claro: tokensDe(":root {"), oscuro: tokensDe(':root[data-theme="dark"] {') };
  const claro = { ...app.claro, ...tokensDe("body:has(.portada) {") };
  const oscuro = { ...app.oscuro, ...tokensDe(':root[data-theme="dark"] body:has(.portada) {') };
  const oscuroDelSistema = tokensDe(':root:not([data-theme="light"]) body:has(.portada) {');

  const PROPIOS = ["fondo", "superficie", "superficie-tenue", "borde", "texto", "texto-tenue", "texto-suave", "titulo", "foco"];

  test("claro y oscuro redefinen los mismos tokens", () => {
    for (const token of PROPIOS) {
      expect(tokensDe("body:has(.portada) {")[token], `falta --${token} en claro`).toBeDefined();
      expect(oscuroDelSistema[token], `falta --${token} en oscuro`).toBeDefined();
    }
  });

  test("el oscuro del sistema y el oscuro elegido son el mismo", () => {
    expect(oscuroDelSistema).toEqual(tokensDe(':root[data-theme="dark"] body:has(.portada) {'));
  });

  // Todo texto de la portada va sobre el papel, una carta o la cabecera de
  // una tabla. Los tres niveles de texto y los titulos se miden contra los tres.
  const TEXTOS = ["texto", "texto-tenue", "texto-suave", "titulo"] as const;
  const FONDOS = ["fondo", "superficie", "superficie-tenue"] as const;
  // El semaforo de los presupuestos se lee como texto («te quedan $15.000»)
  // dentro de las cartas.
  const SENALES = ["exito", "alerta", "peligro"] as const;

  for (const [modo, tema] of [["claro", claro], ["oscuro", oscuro]] as const) {
    describe(`modo ${modo}`, () => {
      for (const frente of [...TEXTOS, ...SENALES]) {
        for (const fondo of FONDOS) {
          test(`${frente} sobre ${fondo} alcanza 4.5:1`, () => {
            const f = tema[frente] as string;
            const b = tema[fondo] as string;
            expect(sirveParaTexto(f, b), `${frente} (${f}) sobre ${fondo} (${b}) da ${contraste(f, b).toFixed(2)}:1`).toBe(true);
          });
        }
      }

      test("el anillo de foco se ve sobre el papel y las cartas (3:1)", () => {
        for (const fondo of FONDOS) {
          const f = tema["foco"] as string;
          const b = tema[fondo] as string;
          expect(sirveParaGrafico(f, b), `foco (${f}) sobre ${fondo} (${b}) da ${contraste(f, b).toFixed(2)}:1`).toBe(true);
        }
      });

      test("el texto de los botones durazno se lee", () => {
        const f = tema["acento-tinta"] as string;
        const b = tema["acento"] as string;
        expect(sirveParaTexto(f, b), `acento-tinta sobre acento da ${contraste(f, b).toFixed(2)}:1`).toBe(true);
      });
    });
  }
});

/* -------------------------------- Luka -------------------------------- */

const dibujar = (pose: PoseLuka, quieto = false) =>
  renderToStaticMarkup(createElement(Luka, { pose, quieto }));

/** Las clases que mueven a Luka en globals.css. */
// Solo clases que EMPIEZAN con luka- (boton-luka-grande no es de movimiento).
const clasesDeMovimiento = (html: string) => html.match(/(?<![\w-])luka-(?!pasea)[a-z-]+/g) ?? [];

describe("Luka", () => {
  test("con lupa va siempre quieto", () => {
    expect(clasesDeMovimiento(dibujar("lupa"))).toEqual([]);
  });

  test("quieto no lleva ninguna clase que lo anime", () => {
    expect(clasesDeMovimiento(dibujar("rastreando", true))).toEqual([]);
    expect(clasesDeMovimiento(dibujar("echado", true))).toEqual([]);
  });

  test("en la app sigue moviendose como siempre", () => {
    const rastreando = new Set(clasesDeMovimiento(dibujar("rastreando")));
    for (const clase of ["luka-cuerpo", "luka-cola", "luka-pata", "luka-olfato", "luka-ojo", "luka-oreja"]) {
      expect(rastreando.has(clase), `falta ${clase}`).toBe(true);
    }
    const echado = new Set(clasesDeMovimiento(dibujar("echado")));
    for (const clase of ["luka-dormido", "luka-ojo-echado", "luka-oreja-echada"]) {
      expect(echado.has(clase), `falta ${clase}`).toBe(true);
    }
  });

  test("el paseo del header encuentra las patas, la cabeza y la cola", () => {
    const html = dibujar("rastreando");
    for (const n of [1, 2, 3, 4]) expect(html).toContain(`data-pata="${n}"`);
    expect(html).toContain("data-cabeza");
    expect(html).toContain("data-cola");
  });

  test("dos Lukas en la misma pagina recortan cada uno con lo suyo", () => {
    const html = renderToStaticMarkup(
      createElement(Fragment, null, createElement(Luka, { pose: "lupa" }), createElement(Luka, { pose: "lupa" })),
    );
    const [uno, dos] = html.split("</svg>");
    const ids = (s: string) => [...s.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    const usos = (s: string) => [...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    const idsUno = ids(uno as string);
    const idsDos = ids(dos as string);
    expect(idsUno.length).toBeGreaterThan(0);
    expect(idsUno.filter((id) => idsDos.includes(id))).toEqual([]);
    for (const uso of usos(uno as string)) expect(idsUno).toContain(uso);
    for (const uso of usos(dos as string)) expect(idsDos).toContain(uso);
  });

  // Luka va siempre entero: ningun circulo ni elipse (la lupa, los ojos, la
  // nariz, los pies, la sombra) se sale del viewBox, contando el trazo.
  test.each(["rastreando", "echado", "lupa"] as const)("%s entra completo en su viewBox", (pose) => {
    const html = dibujar(pose, true);
    const [x, y, ancho, alto] = (/viewBox="([^"]+)"/.exec(html)?.[1] ?? "").split(" ").map(Number) as [number, number, number, number];
    // Lo que va dentro de un grupo girado no esta en las coordenadas que dice
    // su atributo: se salta. Por eso se recorre el arbol llevando la cuenta.
    const girados: boolean[] = [];
    let medidas = 0;
    for (const m of html.matchAll(/<(\/?)(g|circle|ellipse)\b([^>]*?)\/?>/g)) {
      const [, cierra, etiqueta, atributos = ""] = m;
      if (etiqueta === "g") {
        if (cierra) girados.pop();
        else girados.push(/\stransform="/.test(atributos));
        continue;
      }
      if (cierra || girados.includes(true)) continue;
      medidas++;
      const attr = (nombre: string) => Number(new RegExp(`\\s${nombre}="([^"]+)"`).exec(atributos)?.[1] ?? 0);
      const rx = etiqueta === "circle" ? attr("r") : attr("rx");
      const ry = etiqueta === "circle" ? attr("r") : attr("ry");
      const trazo = attr("stroke-width") / 2;
      const cx = attr("cx");
      const cy = attr("cy");
      expect(cx - rx - trazo, `${m[0]} se sale por la izquierda`).toBeGreaterThanOrEqual(x);
      expect(cx + rx + trazo, `${m[0]} se sale por la derecha`).toBeLessThanOrEqual(x + ancho);
      expect(cy - ry - trazo, `${m[0]} se sale por arriba`).toBeGreaterThanOrEqual(y);
      expect(cy + ry + trazo, `${m[0]} se sale por abajo`).toBeLessThanOrEqual(y + alto);
    }
    expect(medidas, "no medi nada: cambio el dibujo o el recorrido").toBeGreaterThan(3);
  });
});

/* --------------------------- Navbar y heroe --------------------------- */

describe("el navbar y el heroe de la portada", async () => {
  const { NavPortada } = await import("@/componentes/portada/NavPortada");
  const { Heroe } = await import("@/componentes/portada/Heroe");
  const nav = renderToStaticMarkup(createElement(NavPortada));
  const heroe = renderToStaticMarkup(createElement(Heroe));

  test("el navbar lleva a las tarjetas, a las preguntas y a la entrada", () => {
    expect(nav).toMatch(/<a[^>]*href="#que-hacemos"[^>]*>¿Qué hacemos\?<\/a>/);
    expect(nav).toMatch(/<a[^>]*href="#preguntas"[^>]*>Preguntas<\/a>/);
    expect(nav).toMatch(/<a[^>]*href="\/ingresar"[^>]*>Entrar<\/a>/);
  });

  test("el Luka del navbar va quieto", () => {
    expect(clasesDeMovimiento(nav)).toEqual([]);
  });

  test("«Entrar con Google» es un boton de formulario, no un enlace", () => {
    expect(heroe).toMatch(/<form[^>]*>\s*<button type="submit"[^>]*>[\s\S]*Entrar con Google[\s\S]*<\/button>\s*<\/form>/);
  });

  test("«Entrar con Google» es el mismo boton que «Entrar» del navbar", () => {
    const claseDe = (html: string, texto: string) =>
      new RegExp(`<(?:a|button)[^>]*class="([^"]*)"[^>]*>(?:(?!</(?:a|button)>)[\\s\\S])*${texto}`).exec(html)?.[1]?.split(/\s+/) ?? [];
    expect(claseDe(nav, "Entrar<")).toContain("boton-luka");
    expect(claseDe(heroe, "Entrar con Google")).toContain("boton-luka");
  });

  test("«tu dinero» va en la etiqueta durazno con el canto de los botones", () => {
    expect(heroe).toMatch(/Sigue el rastro de <span class="etiqueta-luka">tu dinero<\/span>\./);
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const regla = css.slice(css.indexOf(".etiqueta-luka {"), css.indexOf("}", css.indexOf(".etiqueta-luka {")));
    expect(regla).toContain("background: var(--acento);");
    expect(regla).toContain("color: var(--acento-tinta);");
    expect(regla).toContain("box-shadow: 0 0.07em 0 var(--acento-canto);");
    // El giro va en rotate: transform es del parallax del titular.
    expect(regla).not.toContain("transform");
  });

  test("el heroe dice lo que la app hace, sin cifras", () => {
    expect(heroe).toContain("Sigue el rastro de");
    expect(heroe).toContain("La sesión se cierra sola");
    expect(heroe).not.toMatch(/\$\s?\d/);
  });
});

/* ------------------------------- Vitrina ------------------------------- */

describe("la vitrina", async () => {
  const { armarPresupuestos } = await import("@/dominio/presupuestos");
  const { periodoDeFecha } = await import("@/lib/periodo");
  const { MES_EJEMPLO, QUEDA_EJEMPLO } = await import("@/componentes/portada/cifras-ejemplo");
  const { CATEGORIAS_BASE } = await import("@/dominio/categorias-base");
  const v = await import("@/componentes/portada/reglas-vitrina");

  const FERIA = { id: "c-feria", nombre: "Feria", color: "#c38409", icono: "shopping-basket", esencial: true };

  /** Lo que diria la app real para ese gasto y ese presupuesto. */
  function segunLaApp(gastado: number, techo: number) {
    const [linea] = armarPresupuestos(
      [{ id: "p", categoria: FERIA, mes: "2026-10", monto: techo, creadoEn: "2026-10-01" }],
      [{ id: "g", fecha: "2026-10-05", descripcion: "feria", monto: gastado, medioPago: "DEBITO", notas: null, boletaArchivo: null, categoria: FERIA, cuota: null }],
      "2026-10",
    ).lineas;
    return linea!;
  }

  test.each([
    [85_000, 100_000],
    [79_999, 100_000],
    [80_000, 100_000],
    [99_999, 100_000],
    [100_000, 100_000],
    [100_001, 100_000],
    [85_000, 50_000],
    [1, 400_000],
  ])("con %i gastados de %i, el semaforo es el de la app", (gastado, techo) => {
    const app = segunLaApp(gastado, techo);
    const esperado = app.excedido ? "pasado" : app.agotado ? "tope" : app.alLimite ? "aviso" : "sobra";
    expect(v.estadoDeFila(gastado, techo)).toBe(esperado);
  });

  test("el aviso de la feria usa las frases de la app", () => {
    expect(v.avisoDeFeria(85_000, 100_000)).toEqual({
      estado: "aviso",
      titulo: "Estás llegando al límite en Feria.",
      linea: "te quedan $15.000 · 85% usado",
    });
    expect(v.avisoDeFeria(85_000, 85_000).titulo).toBe("Llegaste al 100% en Feria: ahí ya no te queda nada.");
    expect(v.avisoDeFeria(85_000, 50_000)).toMatchObject({
      estado: "pasado",
      titulo: "Te pasaste del presupuesto en Feria.",
      linea: "te pasaste por $35.000 · 170% usado",
    });
    expect(v.avisoDeFeria(85_000, 0).estado).toBe("sin");
  });

  test("con el 27, hoy (18 de octubre) estas en octubre, del 27 de septiembre al 26 de octubre", () => {
    expect(v.mesConDiaDeInicio(27)).toEqual({
      nombre: "octubre",
      siguiente: "noviembre",
      rango: "27 de septiembre al 26 de octubre",
      dias: 30,
    });
  });

  test.each([1, 5, 15, 16, 18, 19, 29, 31])("con el %i, el mes es el que arma la app", (dia) => {
    const app = periodoDeFecha(v.HOY_EJEMPLO, dia);
    const vitrina = v.mesConDiaDeInicio(dia);
    expect(`2026-${String(["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"].indexOf(vitrina.nombre) + 1).padStart(2, "0")}`).toBe(app.mes);
    expect(vitrina.dias).toBe(app.dias);
  });

  test("el campo del presupuesto lee lo que se escribe", () => {
    expect(v.leerMonto("100.000")).toBe(100_000);
    expect(v.leerMonto("$ 45.990")).toBe(45_990);
    expect(v.leerMonto("")).toBe(0);
    expect(v.leerMonto("9999999999")).toBe(99_999_999);
  });

  test("los negativos llevan signo menos de verdad", () => {
    expect(v.montoConSigno(-35_000)).toBe("−$35.000");
    expect(v.montoConSigno(15_000)).toBe("$15.000");
  });

  test("el mes de ejemplo cuadra: el cafe no gasta mas que todo lo no esencial", () => {
    const cafe = MES_EJEMPLO.techos.find((t) => t.categoria === "Café")!;
    expect(cafe).toMatchObject({ gastado: 40_000, techo: 40_000 });
    expect(cafe.gastado).toBeLessThanOrEqual(MES_EJEMPLO.discrecionales);
    expect(QUEDA_EJEMPLO).toBe(428_020);
    expect(MES_EJEMPLO.categorias).toBe(CATEGORIAS_BASE.length);
  });

  test("la tabla muestra el mes de ejemplo, con la feria al limite", async () => {
    const { Vitrina } = await import("@/componentes/portada/Vitrina");
    const html = renderToStaticMarkup(createElement(Vitrina));
    expect(html).toContain("Presupuesto por categoría");
    expect(html).toMatch(/value="100\.000"/);
    expect(html).toContain("Estás llegando al límite en Feria.");
    expect(html).toContain("te quedan $15.000 · 85% usado");
    expect(html).toContain("06 · Presupuestos");
    // Total de alimentacion: 540.000 presupuestados, 212.350 gastados.
    expect(html).toContain("$540.000");
    expect(html).toContain("$212.350");
    expect(html).toContain("$327.650");
  });
});

/* ------------------------- Tarjetas y preguntas ------------------------- */

describe("las tarjetas y las preguntas", async () => {
  const { Tarjetas, TARJETAS } = await import("@/componentes/portada/Tarjetas");
  const { Preguntas, PREGUNTAS } = await import("@/componentes/portada/Preguntas");
  const { CATEGORIAS_BASE } = await import("@/dominio/categorias-base");
  const { HORAS_MAXIMAS, MINUTOS_SIN_USO } = await import("@/lib/sesion");
  const tarjetas = renderToStaticMarkup(createElement(Tarjetas));
  const preguntas = renderToStaticMarkup(createElement(Preguntas));

  test("«¿Que hacemos?» baja a las seis tarjetas", () => {
    expect(tarjetas).toMatch(/<section[^>]*id="que-hacemos"/);
    expect(TARJETAS).toHaveLength(6);
    expect(tarjetas.match(/<h3/g)).toHaveLength(6);
  });

  test("las tarjetas llevan el mismo canto que los botones y esquinas de 24 px", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const boton = css.slice(css.indexOf(".boton-luka {"), css.indexOf("}", css.indexOf(".boton-luka {")));
    const canto = /box-shadow:\s*([^;]+);/.exec(boton)?.[1];
    expect(canto).toBe("0 3px 0 var(--acento-canto)");
    const clases = [...tarjetas.matchAll(/<li[^>]*class="([^"]*)"/g)].map((m) => m[1]!.split(" "));
    expect(clases).toHaveLength(6);
    for (const c of clases) {
      expect(c).toContain("rounded-3xl");
      expect(c).toContain(`shadow-[${canto!.replaceAll(" ", "_")}]`);
    }
  });

  test("la tarjeta de las boletas dice cuantas categorias trae la app", () => {
    // Si cambian las categorias base, cambia «veintidós» en Tarjetas.tsx.
    expect(CATEGORIAS_BASE).toHaveLength(22);
    expect(TARJETAS.some((t) => t.texto.includes("Trae veintidós categorías listas."))).toBe(true);
  });

  test("«Preguntas» baja a las preguntas, con la primera abierta y una a la vez", () => {
    expect(preguntas).toMatch(/<section[^>]*id="preguntas"/);
    const details = preguntas.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(PREGUNTAS.length);
    expect(details[0]).toMatch(/\sopen=""/);
    for (const d of details.slice(1)) expect(d).not.toMatch(/\sopen/);
    for (const d of details) expect(d).toContain('name="preguntas-portada"');
  });

  test("la respuesta de la sesion dice los plazos de la app", () => {
    expect(preguntas).toContain(`tras ${MINUTOS_SIN_USO} minutos sin uso, a las ${HORAS_MAXIMAS} horas como máximo`);
  });
});

/* ---------------------------- Cierre y pie ---------------------------- */

describe("el cierre y el pie", async () => {
  const { Cierre } = await import("@/componentes/portada/Cierre");
  const { PiePortada } = await import("@/componentes/portada/PiePortada");
  const cierre = renderToStaticMarkup(createElement(Cierre));
  const pie = renderToStaticMarkup(createElement(PiePortada));

  test("Luka con su lupa va pegado a «Una», la primera palabra del titular", () => {
    expect(cierre).toMatch(/<h2[^>]*>\s*<span class="relative inline-block">Una<svg viewBox="26 137 266 169"/);
  });

  test("en el cierre y el pie nada se mueve", () => {
    expect(clasesDeMovimiento(cierre)).toEqual([]);
    expect(clasesDeMovimiento(pie)).toEqual([]);
  });

  test("el boton del cierre es el mismo «Entrar con Google» del heroe", () => {
    expect(cierre).toMatch(/<form[^>]*>\s*<button type="submit" class="boton-luka boton-luka-grande[^"]*">[\s\S]*Entrar con Google<\/button>/);
  });

  test("el pie avisa que las cifras son de ejemplo y lleva a las secciones", () => {
    expect(pie).toContain("Las cifras de esta página son de un mes de ejemplo.");
    expect(pie).toMatch(/href="#que-hacemos"/);
    expect(pie).toMatch(/href="#preguntas"/);
    expect(pie).toMatch(/href="\/ingresar"/);
  });
});

/* ------------------------------- Parallax ------------------------------- */

describe("el parallax y las ondas", async () => {
  const { Heroe } = await import("@/componentes/portada/Heroe");
  const { Vitrina } = await import("@/componentes/portada/Vitrina");
  const { Tarjetas } = await import("@/componentes/portada/Tarjetas");
  const { Preguntas } = await import("@/componentes/portada/Preguntas");
  const { Cierre } = await import("@/componentes/portada/Cierre");
  const { PieDePagina } = await import("@/componentes/PieDePagina");
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const capas = (html: string) => [...html.matchAll(/data-paralaje="([^"]+)"/g)].map((m) => Number(m[1]));

  test.each([
    ["el heroe", Heroe],
    ["la vitrina", Vitrina],
    ["las tarjetas", Tarjetas],
    ["las preguntas", Preguntas],
    ["el cierre", Cierre],
  ] as const)("%s tiene capas que se mueven a distinta velocidad", (_, Seccion) => {
    const velocidades = capas(renderToStaticMarkup(createElement(Seccion)));
    expect(velocidades.length).toBeGreaterThan(1);
    expect(new Set(velocidades).size).toBeGreaterThan(1);
    // Todas positivas: las secciones vecinas se separan, no se juntan.
    for (const v of velocidades) expect(v).toBeGreaterThan(0);
  });

  test("las tarjetas flotantes de la vitrina solo bajan: arriba no tienen aire", () => {
    const html = renderToStaticMarkup(createElement(Vitrina));
    const dia = /<div[^>]*data-paralaje="[^"]+"[^>]*data-paralaje-min="([^"]+)"[^>]*>\s*<label for="portada-dia"/.exec(html);
    expect(dia?.[1]).toBe("0");
    const aviso = /<div role="status"[^>]*data-paralaje-min="([^"]+)"/.exec(html);
    expect(aviso?.[1]).toBe("0");
  });

  test("«claro» va encerrado en el circulo a mano, completo si no se anima", () => {
    const html = renderToStaticMarkup(createElement(Cierre));
    expect(html).toMatch(/<span class="palabra-circulada">claro<svg data-fase="quieto"[^>]*class="trazo-circulo"><path pathLength="1"/);
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    // Sin JS o con movimiento reducido el trazo queda en «quieto»: dashoffset 0.
    const regla = css.slice(css.indexOf(".trazo-circulo path {"), css.indexOf("}", css.indexOf(".trazo-circulo path {")));
    expect(regla).toContain("stroke-dashoffset: 0;");
  });

  test("Luka se mueve con su titular y nunca se separa de «Una»", () => {
    const html = renderToStaticMarkup(createElement(Cierre));
    const titular = /<h2[\s\S]*?<\/h2>/.exec(html)?.[0] ?? "";
    expect(titular).toContain("Una<svg");
    expect(titular).not.toContain("data-paralaje");
  });

  test("el parallax solo usa transform, y el aviso entra con translate para no pisarlo", () => {
    expect(css).toMatch(/\[data-paralaje\]\s*\{\s*transform:\s*translate3d\(0, var\(--paralaje, 0px\), 0\);/);
    const entrada = css.slice(css.indexOf("@keyframes portada-aviso-entra"), css.indexOf(".portada-aviso-entra {"));
    expect(entrada.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("transform");
  });

  test("la banda durazno del cierre sube por una onda desde las preguntas", () => {
    const html = renderToStaticMarkup(createElement(Preguntas));
    expect(html).toMatch(/^<div class="con-onda relative"><section[\s\S]*<\/section><svg[^>]*><path d="M0,[^"]+" fill="var\(--durazno\)"/);
  });

  test("el pie sube por una onda, en la portada y en la app", () => {
    const cierre = renderToStaticMarkup(createElement(Cierre));
    expect(cierre).toMatch(/<path d="M0,[^"]+" fill="var\(--pie\)"/);
    const pie = renderToStaticMarkup(createElement(PieDePagina));
    expect(pie).toMatch(/<path d="M0,[^"]+" fill="var\(--pie\)"[\s\S]*<\/svg><\/div><footer/);
  });
});
