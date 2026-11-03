import { describe, expect, test } from "vitest";
import {
  ahoraEnSegundos,
  SEGUNDOS_MAXIMOS,
  SEGUNDOS_SIN_USO,
  sellarSesion,
  sesionVigente,
} from "@/lib/sesion";

const ARRANQUE = "arranque-de-hoy";
const AHORA = 1_793_700_000; // un martes cualquiera, en segundos Unix

describe("duracion de la sesion", () => {
  test("se corta a los 30 minutos sin uso (no a los 30 dias de next-auth)", () => {
    expect(SEGUNDOS_SIN_USO).toBe(30 * 60);
  });

  test("dura 8 horas como maximo desde que se entro", () => {
    expect(SEGUNDOS_MAXIMOS).toBe(8 * 60 * 60);
  });
});

describe("sellarSesion", () => {
  test("guarda la hora del ingreso y el arranque", () => {
    expect(sellarSesion(AHORA, ARRANQUE)).toEqual({
      iniciada: AHORA,
      arranque: ARRANQUE,
    });
  });
});

describe("sesionVigente", () => {
  const sello = sellarSesion(AHORA, ARRANQUE);

  test("recien entrado, en el mismo arranque, vale", () => {
    expect(sesionVigente({ email: "f@gmail.com", ...sello }, AHORA, ARRANQUE)).toBe(true);
  });

  test("sigue valiendo justo al cumplir las 8 horas", () => {
    expect(sesionVigente(sello, AHORA + SEGUNDOS_MAXIMOS, ARRANQUE)).toBe(true);
  });

  test("pasadas las 8 horas ya no vale, aunque se haya usado todo el rato", () => {
    expect(sesionVigente(sello, AHORA + SEGUNDOS_MAXIMOS + 1, ARRANQUE)).toBe(false);
  });

  test("con el servidor arrancado de nuevo ya no vale", () => {
    expect(sesionVigente(sello, AHORA + 60, "arranque-de-manana")).toBe(false);
  });

  test("una cookie de antes de este cambio (sin sello) queda afuera", () => {
    expect(sesionVigente({ email: "f@gmail.com", sub: "123" }, AHORA, ARRANQUE)).toBe(false);
  });

  test("un sello a medias o con tipos raros queda afuera", () => {
    expect(sesionVigente({ iniciada: AHORA }, AHORA, ARRANQUE)).toBe(false);
    expect(sesionVigente({ arranque: ARRANQUE }, AHORA, ARRANQUE)).toBe(false);
    expect(sesionVigente({ iniciada: String(AHORA), arranque: ARRANQUE }, AHORA, ARRANQUE)).toBe(false);
  });

  test("un ingreso fechado en el futuro no vale", () => {
    expect(sesionVigente(sellarSesion(AHORA + 60, ARRANQUE), AHORA, ARRANQUE)).toBe(false);
  });

  test("sin marca de arranque no vale ninguna sesion", () => {
    expect(sesionVigente(sellarSesion(AHORA, ""), AHORA, "")).toBe(false);
  });
});

describe("ahoraEnSegundos", () => {
  test("da segundos enteros, como los JWT", () => {
    const antes = Math.floor(Date.now() / 1000);
    const ahora = ahoraEnSegundos();
    expect(Number.isInteger(ahora)).toBe(true);
    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(antes + 1);
  });
});
