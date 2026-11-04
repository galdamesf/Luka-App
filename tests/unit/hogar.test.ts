import { describe, expect, test } from "vitest";
import {
  CODIGO_DE_BORRADO,
  codigoEquivocado,
  errorDeNombreDeHogar,
  limpiarCodigo,
  nombreParaMostrar,
  ordenarMiembros,
  primerNombre,
  puedeBorrarHogar,
  puedeCambiarDiaDeInicio,
  puedeHacerDueno,
  puedeInvitar,
  puedeQuitar,
  puedeRenombrar,
  puedeSalir,
  revisarCodigo,
  segundosParaReenviar,
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

describe("puedeBorrarHogar", () => {
  const yo = fila("d", { rol: "DUENO" });

  test("el dueno que esta solo puede borrar el hogar, aunque tenga invitaciones pendientes", () => {
    expect(puedeBorrarHogar(dueno, [yo])).toBeNull();
    expect(puedeBorrarHogar(dueno, [yo, fila("abuela", { entroEn: null })])).toBeNull();
  });

  test("con alguien mas que ya entro, no: le borraria sus datos", () => {
    expect(puedeBorrarHogar(dueno, [yo, fila("m")])).toMatch(/estás solo/);
  });

  test("un miembro no borra el hogar", () => {
    expect(puedeBorrarHogar(miembro, [fila("m")])).toMatch(/dueño/);
  });
});

describe("el codigo para borrar el hogar", () => {
  const ahora = new Date("2026-11-04T03:00:00.000Z");
  const enMinutos = (m: number) => new Date(ahora.getTime() + m * 60_000);
  const pendiente = { miembroId: "d", expiraEn: enMinutos(10), intentos: 0 };

  test("seis digitos, diez minutos, cinco intentos y un minuto entre envios", () => {
    expect(CODIGO_DE_BORRADO).toEqual({ digitos: 6, minutosDeVigencia: 10, intentos: 5, segundosParaReenviar: 60 });
  });

  test("limpiarCodigo acepta los 6 digitos con espacios o guion, y nada mas", () => {
    expect(limpiarCodigo("004217")).toBe("004217");
    expect(limpiarCodigo(" 004 217 ")).toBe("004217");
    expect(limpiarCodigo("004-217")).toBe("004217");
    for (const malo of ["", "12345", "1234567", "12a456", "１２３４５６"]) expect(limpiarCodigo(malo), malo).toBeNull();
  });

  test("otro codigo, recien despues de un minuto", () => {
    expect(segundosParaReenviar(null, ahora)).toBe(0);
    expect(segundosParaReenviar(ahora, ahora)).toBe(60);
    expect(segundosParaReenviar(new Date(ahora.getTime() - 45_500), ahora)).toBe(15);
    expect(segundosParaReenviar(new Date(ahora.getTime() - 60_000), ahora)).toBe(0);
  });

  test("revisarCodigo: tiene que haber uno, de quien lo usa, vigente y con intentos", () => {
    expect(revisarCodigo(pendiente, dueno, ahora)).toBeNull();
    expect(revisarCodigo(null, dueno, ahora)).toMatch(/Primero pide el código/);
    expect(revisarCodigo({ ...pendiente, miembroId: "otro" }, dueno, ahora)).toMatch(/Primero pide el código/);
    expect(revisarCodigo({ ...pendiente, expiraEn: ahora }, dueno, ahora)).toMatch(/venció/);
    expect(revisarCodigo({ ...pendiente, intentos: 5 }, dueno, ahora)).toMatch(/Se acabaron los intentos/);
    expect(revisarCodigo({ ...pendiente, intentos: 4 }, dueno, ahora)).toBeNull();
  });

  test("codigoEquivocado dice cuantos intentos quedan", () => {
    expect(codigoEquivocado(1)).toBe("Ese código no es. Te quedan 4 intentos.");
    expect(codigoEquivocado(4)).toBe("Ese código no es. Te queda 1 intento.");
    expect(codigoEquivocado(5)).toMatch(/se acabaron los intentos/);
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
