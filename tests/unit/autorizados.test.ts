import { describe, expect, test } from "vitest";
import { correosAutorizados, estaAutorizado } from "@/lib/autorizados";

describe("correosAutorizados", () => {
  test("separa por coma y limpia espacios y mayusculas", () => {
    expect(correosAutorizados(" Uno@Gmail.com , dos@gmail.com ")).toEqual([
      "uno@gmail.com",
      "dos@gmail.com",
    ]);
  });

  test("sin variable o vacia, la lista queda vacia", () => {
    expect(correosAutorizados(undefined)).toEqual([]);
    expect(correosAutorizados("")).toEqual([]);
    expect(correosAutorizados(" , ,")).toEqual([]);
  });
});

describe("estaAutorizado", () => {
  const lista = ["fernando@gmail.com"];

  test("acepta el correo aunque venga con otra capitalizacion", () => {
    expect(estaAutorizado("Fernando@Gmail.com", lista)).toBe(true);
  });

  test("rechaza a quien no esta en la lista", () => {
    expect(estaAutorizado("otro@gmail.com", lista)).toBe(false);
  });

  test("sin correo no entra nadie", () => {
    expect(estaAutorizado(null, lista)).toBe(false);
    expect(estaAutorizado(undefined, lista)).toBe(false);
  });

  test("con la lista vacia no entra nadie: la puerta cerrada por defecto", () => {
    expect(estaAutorizado("fernando@gmail.com", [])).toBe(false);
  });
});
