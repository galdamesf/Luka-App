import { describe, expect, test } from "vitest";
import {
  decidirEntrada,
  limpiarNombre,
  nombreDeHogarNuevo,
  normalizarCorreo,
  type ReglasDeEntrada,
} from "@/dominio/entrada";

describe("normalizarCorreo", () => {
  test("deja el correo sin espacios y en minusculas, como lo exige la base", () => {
    expect(normalizarCorreo("  Fernando@Gmail.COM ")).toBe("fernando@gmail.com");
  });

  test.each([null, undefined, "", "   ", "sin-arroba", "@gmail.com", "ana@", "a b@gmail.com"])(
    "%j no es un correo",
    (correo) => {
      expect(normalizarCorreo(correo)).toBeNull();
    },
  );

  test("un correo mas largo que la columna no pasa", () => {
    expect(normalizarCorreo(`${"a".repeat(250)}@g.cl`)).toBeNull();
  });
});

describe("limpiarNombre", () => {
  test("junta espacios y recorta a lo que cabe", () => {
    expect(limpiarNombre("  Ana   María  ")).toBe("Ana María");
    expect(limpiarNombre("x".repeat(200))).toHaveLength(120);
  });

  test("sin nombre queda vacio", () => {
    expect(limpiarNombre(undefined)).toBeNull();
    expect(limpiarNombre("   ")).toBeNull();
  });
});

describe("decidirEntrada", () => {
  const cerrada: ReglasDeEntrada = { listaDeAntes: ["fernando@gmail.com", "ana@gmail.com"], puertaAbierta: false };
  const abierta: ReglasDeEntrada = { ...cerrada, puertaAbierta: true };
  const decidir = (
    correo: string | null,
    { yaEsMiembro = false, hogarInicialLibre = true, reglas = cerrada } = {},
  ) => decidirEntrada({ correo, yaEsMiembro, hogarInicialLibre, ...reglas });

  test("quien ya es miembro (o tiene invitacion) entra a su hogar", () => {
    expect(decidir("pedro@gmail.com", { yaEsMiembro: true })).toEqual({ tipo: "miembro" });
  });

  test("ser miembro manda sobre todo: nadie se cambia de hogar al entrar", () => {
    expect(decidir("fernando@gmail.com", { yaEsMiembro: true })).toEqual({ tipo: "miembro" });
  });

  test("el primero de la lista se vuelve dueno de «Mi hogar» mientras no tenga dueno", () => {
    expect(decidir("fernando@gmail.com")).toEqual({ tipo: "dueno-del-hogar-inicial" });
  });

  test("con «Mi hogar» ya con dueno (o borrado), la lista no abre nada: a quien sacaron no vuelve solo", () => {
    expect(decidir("fernando@gmail.com", { hogarInicialLibre: false })).toEqual({ tipo: "rechazada" });
  });

  test("con la puerta abierta, el primero de la lista sin «Mi hogar» libre tiene uno nuevo", () => {
    expect(decidir("fernando@gmail.com", { reglas: abierta, hogarInicialLibre: false })).toEqual({ tipo: "hogar-nuevo" });
  });

  test("los demas de la lista necesitan invitacion, como cualquiera", () => {
    expect(decidir("ana@gmail.com")).toEqual({ tipo: "rechazada" });
  });

  test("con la puerta cerrada, alguien nuevo no entra", () => {
    expect(decidir("desconocido@gmail.com")).toEqual({ tipo: "rechazada" });
  });

  test("con la puerta abierta, alguien nuevo tiene su propio hogar", () => {
    expect(decidir("desconocido@gmail.com", { reglas: abierta })).toEqual({ tipo: "hogar-nuevo" });
    expect(decidir("ana@gmail.com", { reglas: abierta, hogarInicialLibre: false })).toEqual({ tipo: "hogar-nuevo" });
  });

  test("con la lista vacia y la puerta cerrada solo entran los miembros", () => {
    const vacia = { listaDeAntes: [], puertaAbierta: false };
    expect(decidir("fernando@gmail.com", { reglas: vacia })).toEqual({ tipo: "rechazada" });
    expect(decidir("fernando@gmail.com", { reglas: vacia, yaEsMiembro: true })).toEqual({ tipo: "miembro" });
  });

  test("sin correo no entra nadie, ni con la puerta abierta", () => {
    expect(decidir(null, { reglas: abierta })).toEqual({ tipo: "rechazada" });
  });
});

describe("nombreDeHogarNuevo", () => {
  test("lleva el primer nombre de la persona", () => {
    expect(nombreDeHogarNuevo("Ana María Pérez")).toBe("Hogar de Ana");
  });

  test("sin nombre, «Mi hogar»", () => {
    expect(nombreDeHogarNuevo(null)).toBe("Mi hogar");
    expect(nombreDeHogarNuevo("   ")).toBe("Mi hogar");
  });

  test("nunca pasa de lo que cabe en la columna", () => {
    expect(nombreDeHogarNuevo("x".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
