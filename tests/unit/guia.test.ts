import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { GUIA, IMAGENES_GUIA, PREGUNTAS, PRIMEROS_PASOS } from "@/componentes/guia/contenido";
import { SECCIONES_PANEL } from "@/componentes/secciones-panel";

const imagenesUsadas = GUIA.flatMap((s) => s.bloques.flatMap((b) => (b.imagen === undefined ? [] : [b.imagen])));

describe("la guia ¿Como usar?", () => {
  test("explica todas las secciones del panel, una vez cada una", () => {
    const explicadas = GUIA.flatMap((s) => (s.seccionPanel === undefined ? [] : [s.seccionPanel]));
    expect([...explicadas].sort()).toEqual(Object.keys(SECCIONES_PANEL).sort());
  });

  test("cada seccion de la guia tiene un ancla distinta y algo que decir", () => {
    const ids = GUIA.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of GUIA) {
      expect(s.paraQueSirve.length).toBeGreaterThan(40);
      expect(s.bloques.length).toBeGreaterThan(0);
    }
  });

  test("las secciones del panel enlazan a su ancla en el panel", () => {
    for (const s of GUIA) {
      if (s.seccionPanel !== undefined) expect(s.enlace).toBe(`/#${SECCIONES_PANEL[s.seccionPanel].id}`);
    }
  });

  test("los primeros pasos llevan a una seccion que existe en la guia", () => {
    const ids = new Set(GUIA.map((s) => s.id));
    for (const paso of PRIMEROS_PASOS) expect(ids.has(paso.destino.slice(1))).toBe(true);
  });

  test("cada imagen existe en sus dos versiones, claro y oscuro", () => {
    for (const imagen of imagenesUsadas) {
      for (const tema of ["claro", "oscuro"]) {
        const ruta = join(process.cwd(), "public", "guia", `${imagen.archivo}-${tema}.webp`);
        expect(existsSync(ruta), ruta).toBe(true);
      }
      expect(imagen.alt.length).toBeGreaterThan(20);
    }
  });

  test("no sobra ninguna imagen: todas las capturas se usan", () => {
    const usadas = new Set(imagenesUsadas.map((i) => i.archivo));
    expect([...usadas].sort()).toEqual(Object.keys(IMAGENES_GUIA).sort());
  });

  test("las preguntas frecuentes tienen respuesta", () => {
    for (const p of PREGUNTAS) {
      expect(p.pregunta.endsWith("?")).toBe(true);
      expect(p.respuesta.length).toBeGreaterThan(30);
    }
  });
});
