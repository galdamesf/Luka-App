import { describe, expect, test } from "vitest";
import {
  ahoraEnSegundos,
  hogarDelToken,
  mismoHogar,
  SEGUNDOS_MAXIMOS,
  SEGUNDOS_SIN_USO,
  sellarSesion,
  sesionDelToken,
  sesionVigente,
  tokenVigente,
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

describe("el hogar en la sesion", () => {
  const hogar = { hogarId: "h1", miembroId: "m1", rol: "DUENO" as const };
  const sello = sellarSesion(1_000, "a1");

  test("hogarDelToken lee el hogar que se guardo al entrar", () => {
    expect(hogarDelToken({ ...sello, ...hogar, email: "f@gmail.com" })).toEqual(hogar);
  });

  test("un token sin hogar (de antes de los hogares) no trae hogar", () => {
    expect(hogarDelToken({ ...sello })).toBeNull();
  });

  test("un hogar a medias o con un rol que no existe no vale", () => {
    expect(hogarDelToken({ ...hogar, miembroId: "" })).toBeNull();
    expect(hogarDelToken({ ...hogar, rol: "ADMIN" })).toBeNull();
    expect(hogarDelToken({ ...hogar, hogarId: 7 })).toBeNull();
  });

  test("tokenVigente pide el sello vigente Y el hogar", () => {
    expect(tokenVigente({ ...sello, ...hogar }, 1_010, "a1")).toBe(true);
    expect(tokenVigente({ ...sello }, 1_010, "a1")).toBe(false);
    expect(tokenVigente({ ...sello, ...hogar }, 1_010, "otro-arranque")).toBe(false);
  });

  test("mismoHogar: la sesion coincide con lo que dice la base", () => {
    expect(mismoHogar(hogar, { ...hogar })).toBe(true);
    // El rol puede cambiar sin cortar la sesion: manda el de la base.
    expect(mismoHogar(hogar, { ...hogar, rol: "MIEMBRO" })).toBe(true);
  });

  test("mismoHogar: si ya no es miembro, o lo es de otro hogar, no coincide", () => {
    expect(mismoHogar(hogar, null)).toBe(false);
    expect(mismoHogar(hogar, { ...hogar, hogarId: "h2" })).toBe(false);
    expect(mismoHogar(hogar, { ...hogar, miembroId: "m2" })).toBe(false);
    expect(mismoHogar(null, hogar)).toBe(false);
  });
});

describe("sesionDelToken (el id para el segundo paso)", () => {
  test("lee el id de 32 hexadecimales que nace al entrar", () => {
    const id = "0123456789abcdef0123456789abcdef";
    expect(sesionDelToken({ sesionId: id })).toBe(id);
  });

  test("sin id, o con otra forma, no hay sesion que verificar", () => {
    expect(sesionDelToken({})).toBeNull();
    expect(sesionDelToken({ sesionId: 123 })).toBeNull();
    expect(sesionDelToken({ sesionId: "0123456789ABCDEF0123456789ABCDEF" })).toBeNull();
    expect(sesionDelToken({ sesionId: "x".repeat(32) })).toBeNull();
    expect(sesionDelToken({ sesionId: "0123" })).toBeNull();
  });
});
