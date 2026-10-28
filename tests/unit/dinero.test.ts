import { describe, expect, test } from "vitest";
import { formatearCLP, formatearNumero, parsearMonto } from "@/lib/dinero";

/** Intl usa espacios finos o no separables segun la version de ICU. */
const normalizar = (texto: string) => texto.replace(/\s/g, " ");

describe("formatearCLP", () => {
  test("usa punto como separador de miles y no muestra decimales", () => {
    expect(normalizar(formatearCLP(45990))).toBe("$45.990");
    expect(normalizar(formatearCLP(1250000))).toBe("$1.250.000");
  });

  test("formatea el cero", () => {
    expect(normalizar(formatearCLP(0))).toBe("$0");
  });
});

describe("formatearNumero", () => {
  test("entrega la cifra sin simbolo", () => {
    expect(formatearNumero(45990)).toBe("45.990");
    expect(formatearNumero(999)).toBe("999");
  });
});

describe("parsearMonto", () => {
  test("acepta lo que uno escribe de verdad", () => {
    expect(parsearMonto("45990")).toBe(45990);
    expect(parsearMonto("45.990")).toBe(45990);
    expect(parsearMonto("$45.990")).toBe(45990);
    expect(parsearMonto("45 990")).toBe(45990);
    expect(parsearMonto("  12.500  ")).toBe(12500);
  });

  test("rechaza vacio y texto sin digitos", () => {
    expect(parsearMonto("")).toBeNull();
    expect(parsearMonto("   ")).toBeNull();
    expect(parsearMonto("mil pesos")).toBeNull();
  });

  test("rechaza el cero porque un gasto de cero no es un gasto", () => {
    expect(parsearMonto("0")).toBeNull();
    expect(parsearMonto("$0")).toBeNull();
  });

  test("con permitirCero el cero si vale", () => {
    expect(parsearMonto("0", { permitirCero: true })).toBe(0);
    expect(parsearMonto("$0", { permitirCero: true })).toBe(0);
    // Y lo que no es numero sigue siendo null.
    expect(parsearMonto("", { permitirCero: true })).toBeNull();
    expect(parsearMonto("nada", { permitirCero: true })).toBeNull();
  });

  test("el signo menos se descarta junto al resto de los no digitos", () => {
    // "-500" queda en 500: la validacion de signo es del formulario, no de aca.
    expect(parsearMonto("-500")).toBe(500);
  });
});
