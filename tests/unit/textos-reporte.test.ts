import { describe, expect, test } from "vitest";
import { diaDeLaSemana, fechaLarga } from "@/componentes/formato";
import {
  comparacionConAnterior,
  estadoDeLaSemana,
  urlPdfReporte,
  urlReporte,
} from "@/componentes/textos-reporte";

describe("fechas del reporte", () => {
  test("el dia de la semana no depende de la zona horaria", () => {
    expect(diaDeLaSemana("2026-10-29")).toBe("jueves");
    expect(diaDeLaSemana("2026-11-01")).toBe("domingo");
    expect(fechaLarga("2026-10-31")).toBe("sábado 31 de octubre");
  });
});

describe("urls", () => {
  test("la pagina y el PDF de una semana", () => {
    expect(urlReporte("2026-10", 5)).toBe("/informes/semana?mes=2026-10&semana=5");
    expect(urlReporte("2026-10")).toBe("/informes/semana?mes=2026-10");
    expect(urlPdfReporte("2026-10", 5)).toBe("/informes/semana/pdf?mes=2026-10&semana=5");
  });
});

describe("estadoDeLaSemana", () => {
  test("en curso, cerrada o por venir", () => {
    expect(estadoDeLaSemana({ estado: "en-curso", diasTranscurridos: 2, totalDias: 3 })).toBe("En curso: van 2 de 3 días");
    expect(estadoDeLaSemana({ estado: "cerrada", diasTranscurridos: 7, totalDias: 7 })).toBe("Semana cerrada · 7 días");
    expect(estadoDeLaSemana({ estado: "por-venir", diasTranscurridos: 0, totalDias: 7 })).toBe("Todavía no empieza");
  });
});

describe("comparacionConAnterior", () => {
  const anterior = { semana: 4, total: 42_000, discrecionales: 30_000, diasTranscurridos: 7 };

  test("la primera semana no compara", () => {
    const [linea] = comparacionConAnterior({ anterior: null, tendencia: null, diasTranscurridos: 7, estado: "cerrada", discrecionales: 0 });
    expect(linea?.texto).toMatch(/primera semana/);
  });

  test("si subio el gasto discrecional por dia, lo marca como alza", () => {
    const lineas = comparacionConAnterior({ anterior, tendencia: 357, diasTranscurridos: 2, estado: "en-curso", discrecionales: 67_738 });
    expect(lineas[0]?.texto).toBe("Semana 4: $42.000 en 7 días, $30.000 de ello discrecional.");
    expect(lineas[1]).toMatchObject({ tono: "sube" });
    expect(lineas[1]?.texto).toContain("+357%");
  });

  test("si bajo, lo marca como baja", () => {
    expect(comparacionConAnterior({ anterior, tendencia: -20, diasTranscurridos: 7, estado: "cerrada", discrecionales: 1 })[1]?.tono).toBe("baja");
  });

  test("en curso sin gasto discrecional todavia, no inventa una baja", () => {
    const lineas = comparacionConAnterior({ anterior, tendencia: null, diasTranscurridos: 1, estado: "en-curso", discrecionales: 0 });
    expect(lineas[1]).toEqual({ texto: "Todavía no hay gasto discrecional esta semana para comparar.", tono: "neutro" });
  });
});
