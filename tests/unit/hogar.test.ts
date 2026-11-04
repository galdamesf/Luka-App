import { describe, expect, test } from "vitest";
import {
  errorDeNombreDeHogar,
  nombreParaMostrar,
  ordenarMiembros,
  primerNombre,
  puedeCambiarDiaDeInicio,
  puedeHacerDueno,
  puedeInvitar,
  puedeQuitar,
  puedeRenombrar,
  puedeSalir,
  type MiembroDelHogar,
} from "@/dominio/hogar";

const dueno = { miembroId: "d", rol: "DUENO" as const };
const miembro = { miembroId: "m", rol: "MIEMBRO" as const };
const fila = (id: string, cambios: Partial<MiembroDelHogar> = {}): MiembroDelHogar => ({
  id,
  correo: `${id}@gmail.com`,
  nombre: null,
  rol: "MIEMBRO",
  entroEn: "2026-11-03T12:00:00.000Z",
  ...cambios,
});

describe("lo que solo hace el dueno", () => {
  test.each([
    ["invitar", puedeInvitar],
    ["cambiar el nombre", puedeRenombrar],
    ["cambiar el dia de inicio", puedeCambiarDiaDeInicio],
  ])("%s: el dueno si, un miembro no", (_que, regla) => {
    expect(regla(dueno)).toBeNull();
    expect(regla(miembro)).toMatch(/dueño/);
  });
});

describe("puedeQuitar", () => {
  test("el dueno saca a un miembro o cancela una invitacion", () => {
    expect(puedeQuitar(dueno, fila("m"))).toBeNull();
    expect(puedeQuitar(dueno, fila("i", { entroEn: null }))).toBeNull();
  });

  test("el dueno no se saca a si mismo, ni un miembro saca a nadie", () => {
    expect(puedeQuitar(dueno, fila("d", { rol: "DUENO" }))).toMatch(/Salir del hogar/);
    expect(puedeQuitar(miembro, fila("x"))).toMatch(/dueño/);
  });

  test("al dueno no lo saca nadie", () => {
    expect(puedeQuitar(dueno, fila("otro-dueno", { rol: "DUENO" }))).toMatch(/no se le puede sacar/);
  });
});

describe("puedeHacerDueno", () => {
  test("el dueno le pasa el hogar a alguien que ya entro", () => {
    expect(puedeHacerDueno(dueno, fila("m"))).toBeNull();
  });

  test("no a una invitacion pendiente, ni a si mismo, ni lo hace un miembro", () => {
    expect(puedeHacerDueno(dueno, fila("i", { entroEn: null }))).toMatch(/ya entró/);
    expect(puedeHacerDueno(dueno, fila("d"))).toMatch(/Ya eres/);
    expect(puedeHacerDueno(miembro, fila("x"))).toMatch(/dueño/);
  });
});

describe("puedeSalir", () => {
  test("un miembro sale cuando quiere; el dueno, despues de pasar el hogar", () => {
    expect(puedeSalir(miembro)).toBeNull();
    expect(puedeSalir(dueno)).toMatch(/pásale el hogar/);
  });
});

describe("como se nombra a un miembro", () => {
  test("con su nombre de Google, o con su correo si todavia no entra", () => {
    expect(nombreParaMostrar({ nombre: "Angelina Pérez", correo: "a@gmail.com" })).toBe("Angelina Pérez");
    expect(nombreParaMostrar({ nombre: null, correo: "abuela.rosa@gmail.com" })).toBe("abuela.rosa");
    expect(nombreParaMostrar({ nombre: "   ", correo: "x@gmail.com" })).toBe("x");
  });

  test("primerNombre, para etiquetas cortas", () => {
    expect(primerNombre({ nombre: "Angelina Pérez", correo: "a@gmail.com" })).toBe("Angelina");
  });
});

describe("ordenarMiembros", () => {
  test("el dueno, despues los que entraron por nombre, y al final las invitaciones", () => {
    const orden = ordenarMiembros([
      fila("inv", { entroEn: null, nombre: null }),
      fila("zoe", { nombre: "Zoe" }),
      fila("dueno", { rol: "DUENO", nombre: "Fernando" }),
      fila("ana", { nombre: "Ana" }),
    ]).map((m) => m.id);
    expect(orden).toEqual(["dueno", "ana", "zoe", "inv"]);
  });
});

describe("errorDeNombreDeHogar", () => {
  test("pide algo escrito y que quepa", () => {
    expect(errorDeNombreDeHogar("Casa Galdames")).toBeNull();
    expect(errorDeNombreDeHogar("   ")).toMatch(/Escribe/);
    expect(errorDeNombreDeHogar("x".repeat(61))).toMatch(/60/);
  });
});
