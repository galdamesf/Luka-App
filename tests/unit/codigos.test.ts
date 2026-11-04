import { describe, expect, test } from "vitest";
import { codigoAlAzar, huellaDelCodigo, mismaHuella, secretoDeCodigos } from "@/lib/codigos";

describe("codigoAlAzar", () => {
  test("siempre seis digitos, con ceros a la izquierda", () => {
    for (let i = 0; i < 2_000; i++) expect(codigoAlAzar()).toMatch(/^\d{6}$/);
  });

  test("no se repite: dos mil codigos son casi todos distintos", () => {
    const vistos = new Set(Array.from({ length: 2_000 }, () => codigoAlAzar()));
    expect(vistos.size).toBeGreaterThan(1_990);
  });
});

describe("la huella del codigo", () => {
  const secreto = "secreto-de-prueba";

  test("es un HMAC en hexadecimal, que no contiene el codigo", () => {
    const huella = huellaDelCodigo("004217", "hogar-a", secreto);
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    expect(huella).not.toContain("004217");
  });

  test("cambia con el codigo, con el hogar y con el secreto", () => {
    const base = huellaDelCodigo("004217", "hogar-a", secreto);
    expect(huellaDelCodigo("004217", "hogar-a", secreto)).toBe(base);
    expect(huellaDelCodigo("004218", "hogar-a", secreto)).not.toBe(base);
    expect(huellaDelCodigo("004217", "hogar-b", secreto)).not.toBe(base);
    expect(huellaDelCodigo("004217", "hogar-a", "otro-secreto")).not.toBe(base);
  });

  test("mismaHuella compara completo, y lo vacio no calza con nada", () => {
    const h = huellaDelCodigo("004217", "hogar-a", secreto);
    expect(mismaHuella(h, h)).toBe(true);
    expect(mismaHuella(h, huellaDelCodigo("004218", "hogar-a", secreto))).toBe(false);
    expect(mismaHuella(h, h.slice(0, 32))).toBe(false);
    expect(mismaHuella("", "")).toBe(false);
  });

  test("sin AUTH_SECRET no hay huellas", () => {
    expect(secretoDeCodigos({ AUTH_SECRET: " abc " })).toBe("abc");
    expect(() => secretoDeCodigos({})).toThrow(/AUTH_SECRET/);
    expect(() => secretoDeCodigos({ AUTH_SECRET: "  " })).toThrow(/AUTH_SECRET/);
  });
});
