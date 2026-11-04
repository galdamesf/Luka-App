import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ACTUALIZADO, PRIVACIDAD, RESPONSABLE, RUTAS_LEGALES, TERMINOS, type DocumentoLegal } from "@/dominio/legal";
import { CODIGO_DE_BORRADO } from "@/dominio/hogar";
import { TAMANO_MAXIMO_BOLETA } from "@/dominio/tamano-boleta";
import { HORAS_MAXIMAS, MINUTOS_SIN_USO } from "@/lib/sesion";

const textoDe = (d: DocumentoLegal) =>
  d.secciones.flatMap((s) => [s.titulo, ...s.bloques.flatMap((b) => (b.tipo === "parrafo" ? [b.texto] : b.items))]).join("\n");

describe.each([
  ["la politica de privacidad", PRIVACIDAD],
  ["los terminos de uso", TERMINOS],
])("%s", (_nombre, doc) => {
  test("cada seccion tiene un ancla distinta y algo que decir", () => {
    const ids = doc.secciones.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of doc.secciones) {
      expect(s.id).toMatch(/^[a-z-]+$/);
      expect(s.bloques.length).toBeGreaterThan(0);
    }
  });

  test("dice a quien escribir", () => {
    expect(textoDe(doc)).toContain(RESPONSABLE.correo);
  });

  test("no dice que los datos quedan en tu computador: ahora viven en la nube", () => {
    expect(textoDe(doc)).not.toMatch(/en tu computador/i);
  });
});

describe("lo que dice la politica es lo que hace Luka", () => {
  const texto = textoDe(PRIVACIDAD);

  test("quien responde y como contactarlo", () => {
    expect(RESPONSABLE.correo).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/);
    expect(texto).toContain(RESPONSABLE.nombre);
    expect(ACTUALIZADO).toMatch(/^\d{1,2} de [a-z]+ de \d{4}$/);
  });

  test("los plazos de la sesion y del codigo, y el tope de las boletas, salen del codigo", () => {
    expect(texto).toContain(`tras ${MINUTOS_SIN_USO} minutos sin uso, a las ${HORAS_MAXIMAS} horas como máximo`);
    expect(texto).toContain(`vence en ${CODIGO_DE_BORRADO.minutosDeVigencia} minutos`);
    expect(texto).toContain(`hasta ${TAMANO_MAXIMO_BOLETA / 1024 / 1024}\u00a0MB`);
  });

  test("nombra los servicios donde viven los datos y los permisos de Google que pide", () => {
    for (const quien of ["Vercel", "Neon", "Google"]) expect(texto).toContain(quien);
    for (const permiso of ["«openid»", "«email»", "«profile»"]) expect(texto).toContain(permiso);
  });

  test("dice que los datos no se venden ni se usan para publicidad", () => {
    expect(texto).toMatch(/no se venden/);
    expect(texto).toMatch(/no se usan para publicidad/);
  });
});

describe("la pagina", async () => {
  const { DocumentoLegal } = await import("@/componentes/legal/DocumentoLegal");
  const html = renderToStaticMarkup(createElement(DocumentoLegal, { documento: PRIVACIDAD, otro: "terminos" }));

  test("tiene un solo titulo principal, la fecha y un indice que lleva a cada seccion", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(`Actualizado el ${ACTUALIZADO}`);
    for (const s of PRIVACIDAD.secciones) {
      expect(html).toContain(`href="#${s.id}"`);
      expect(html).toContain(`id="${s.id}"`);
    }
  });

  test("el correo de contacto es un enlace, y lleva al otro documento", () => {
    expect(html).toContain(`href="mailto:${RESPONSABLE.correo}"`);
    expect(html).toContain(`href="${RUTAS_LEGALES.terminos}"`);
  });
});
