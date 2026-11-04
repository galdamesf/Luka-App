import { beforeEach, describe, expect, test, vi } from "vitest";

// Lo que toca la base se reemplaza: aqui se prueba que el ingreso le pase lo
// correcto y haga lo correcto con la respuesta. La base se prueba aparte
// (tests/db/entrada.test.ts).
const registrarEntrada = vi.fn();
const miembroDeSesion = vi.fn();
vi.mock("@/datos/hogares", () => ({
  registrarEntrada: (...a: unknown[]) => registrarEntrada(...a),
  miembroDeSesion: (...a: unknown[]) => miembroDeSesion(...a),
}));

const { puedeEntrar, tokenDeEntrada } = await import("@/lib/ingreso");

const HOGAR = { hogarId: "hogar-inicial", miembroId: "m1", rol: "DUENO" as const };

beforeEach(() => {
  registrarEntrada.mockReset();
  miembroDeSesion.mockReset();
});

describe("puedeEntrar (al volver de Google)", () => {
  test("registra la entrada con el correo, el nombre y la lista del .env", async () => {
    registrarEntrada.mockResolvedValue(HOGAR);
    const entra = await puedeEntrar(
      { email: "Fernando@Gmail.com", name: "Fernando", email_verified: true },
      { CORREOS_AUTORIZADOS: "fernando@gmail.com" },
    );
    expect(entra).toBe(true);
    expect(registrarEntrada).toHaveBeenCalledWith(
      { correo: "Fernando@Gmail.com", nombre: "Fernando" },
      { listaDeAntes: ["fernando@gmail.com"], puertaAbierta: false },
    );
  });

  test("si la base no le encuentra hogar, no entra", async () => {
    registrarEntrada.mockResolvedValue(null);
    expect(await puedeEntrar({ email: "x@gmail.com", email_verified: true }, {})).toBe(false);
  });

  test("un correo que Google no verifico no entra, ni se registra", async () => {
    expect(await puedeEntrar({ email: "x@gmail.com", email_verified: false }, {})).toBe(false);
    expect(registrarEntrada).not.toHaveBeenCalled();
  });
});

describe("tokenDeEntrada (el token recien entrado)", () => {
  test("se sella con la hora y el arranque, y lleva el hogar", async () => {
    miembroDeSesion.mockResolvedValue(HOGAR);
    const token = await tokenDeEntrada({ email: "f@gmail.com", name: "F" }, "arranque-1", 1_000);
    expect(token).toEqual({ email: "f@gmail.com", name: "F", iniciada: 1_000, arranque: "arranque-1", ...HOGAR });
    expect(miembroDeSesion).toHaveBeenCalledWith("f@gmail.com");
  });

  test("sin hogar en la base no hay token: la sesion no nace", async () => {
    miembroDeSesion.mockResolvedValue(null);
    expect(await tokenDeEntrada({ email: "f@gmail.com" }, "arranque-1")).toBeNull();
  });
});
