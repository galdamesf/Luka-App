import { describe, expect, test } from "vitest";
import { PUERTA_ABIERTA, correosAutorizados, reglasDeEntrada } from "@/lib/autorizados";

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

describe("reglasDeEntrada", () => {
  test("toma la lista de CORREOS_AUTORIZADOS, limpia y en su orden", () => {
    const reglas = reglasDeEntrada({ CORREOS_AUTORIZADOS: " Fernando@Gmail.com, ana@gmail.com" });
    expect(reglas.listaDeAntes).toEqual(["fernando@gmail.com", "ana@gmail.com"]);
  });

  test("sin la variable, la lista queda vacia", () => {
    expect(reglasDeEntrada({}).listaDeAntes).toEqual([]);
  });

  test("la puerta sigue cerrada mientras las paginas lean los datos de todos", () => {
    expect(PUERTA_ABIERTA).toBe(false);
    expect(reglasDeEntrada({}).puertaAbierta).toBe(false);
  });
});
