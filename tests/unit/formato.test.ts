import { describe, expect, test } from "vitest";
import {
  fechaCorta,
  mesVecino,
  nombreDelMes,
  nombreDelMesCorto,
  porcentajeLegible,
  listaLegible,
  variacionLegible,
} from "@/componentes/formato";

describe("nombreDelMes", () => {
  test("entrega el mes en español con el año", () => {
    expect(nombreDelMes("2026-10")).toBe("octubre 2026");
    expect(nombreDelMes("2026-01")).toBe("enero 2026");
    expect(nombreDelMes("2026-12")).toBe("diciembre 2026");
  });
});

describe("nombreDelMesCorto", () => {
  test("abrevia a tres letras", () => {
    expect(nombreDelMesCorto("2026-10")).toBe("oct 2026");
    expect(nombreDelMesCorto("2027-02")).toBe("feb 2027");
  });

  test("es más corto que el largo, que es para lo que existe", () => {
    expect(nombreDelMesCorto("2026-09").length).toBeLessThan(nombreDelMes("2026-09").length);
  });
});

describe("fechaCorta", () => {
  test("día sin cero a la izquierda y mes abreviado", () => {
    expect(fechaCorta("2026-10-01")).toBe("1 oct");
    expect(fechaCorta("2026-10-27")).toBe("27 oct");
    expect(fechaCorta("2026-01-05")).toBe("5 ene");
  });
});

describe("mesVecino", () => {
  test("avanza y retrocede un mes", () => {
    expect(mesVecino("2026-10", 1)).toBe("2026-11");
    expect(mesVecino("2026-10", -1)).toBe("2026-09");
  });

  test("cruza el fin de año en ambos sentidos", () => {
    expect(mesVecino("2026-12", 1)).toBe("2027-01");
    expect(mesVecino("2026-01", -1)).toBe("2025-12");
  });

  test("ir y volver deja el mismo mes", () => {
    expect(mesVecino(mesVecino("2026-12", 1), -1)).toBe("2026-12");
  });
});

describe("porcentajeLegible", () => {
  test("redondea a entero", () => {
    expect(porcentajeLegible(54.3)).toBe("54%");
    expect(porcentajeLegible(54.6)).toBe("55%");
    expect(porcentajeLegible(100)).toBe("100%");
  });

  test("el cero exacto es 0%", () => {
    expect(porcentajeLegible(0)).toBe("0%");
  });

  test("algo que existe pero redondea a cero se muestra como <1%", () => {
    // Si mostrara "0%", parecería que no se gastó nada en esa categoría.
    expect(porcentajeLegible(0.4)).toBe("<1%");
    expect(porcentajeLegible(0.99)).toBe("<1%");
  });

  test("desde 1% en adelante muestra el número", () => {
    expect(porcentajeLegible(1)).toBe("1%");
  });
});

describe("listaLegible", () => {
  test("una sola va sin adornos", () => {
    expect(listaLegible(["Ropa"])).toBe("Ropa");
  });

  test("dos van con y", () => {
    expect(listaLegible(["Ropa", "Café"])).toBe("Ropa y Café");
  });

  test("tres van con comas y una y al final", () => {
    expect(listaLegible(["Ropa", "Café", "Feria"])).toBe("Ropa, Café y Feria");
  });

  test("de cuatro para arriba se corta", () => {
    expect(listaLegible(["Ropa", "Café", "Feria", "Bencina"])).toBe(
      "Ropa, Café, Feria y 1 más",
    );
    expect(listaLegible(["a", "b", "c", "d", "e"])).toBe("a, b, c y 2 más");
  });

  test("vacia no devuelve basura", () => {
    expect(listaLegible([])).toBe("");
  });

  test("el tope se puede mover", () => {
    expect(listaLegible(["a", "b", "c"], 1)).toBe("a y 2 más");
  });
});

describe("variacionLegible", () => {
  test("lleva signo y coma decimal, con el menos tipografico", () => {
    expect(variacionLegible(4.17)).toBe("+4,2%");
    expect(variacionLegible(-4.17)).toBe("−4,2%");
  });

  test("desde 10 va sin decimales", () => {
    expect(variacionLegible(12.6)).toBe("+13%");
    expect(variacionLegible(-48.2)).toBe("−48%");
  });

  test("lo que redondea a cero no lleva signo", () => {
    expect(variacionLegible(0)).toBe("0%");
    expect(variacionLegible(0.04)).toBe("0%");
    expect(variacionLegible(-0.04)).toBe("0%");
  });

  test("sin comparacion es una raya, no un cero", () => {
    expect(variacionLegible(null)).toBe("—");
  });
});
