import { beforeEach, describe, expect, test, vi } from "vitest";

// La ruta pregunta por el hogar de la sesion (src/lib/hogar-actual.ts, que
// revisa la cookie y la base); aqui se reemplaza para no levantar next-auth.
const leerHogarActual = vi.fn();
vi.mock("@/lib/hogar-actual", () => ({ leerHogarActual: () => leerHogarActual() }));

const { GET } = await import("@/app/boletas/[archivo]/route");

function pedir(archivo: string) {
  return GET(new Request(`http://localhost/boletas/${archivo}`), {
    params: Promise.resolve({ archivo }),
  });
}

beforeEach(() => {
  leerHogarActual.mockReset();
});

const HOGAR = { hogarId: "h1", miembroId: "m1", rol: "DUENO" };

describe("GET /boletas/[archivo]", () => {
  test("sin sesion responde 401, aunque el nombre sea valido", async () => {
    leerHogarActual.mockResolvedValue(null);
    const respuesta = await pedir("0dd4ebe6b6759cc0c283d2e7adb19d7f.jpg");
    expect(respuesta.status).toBe(401);
  });

  test("con sesion pero ya fuera de su hogar, tampoco pasa", async () => {
    // leerHogarActual devuelve null tambien cuando la base ya no lo tiene
    // como miembro del hogar con que entro.
    leerHogarActual.mockResolvedValue(null);
    const respuesta = await pedir("0dd4ebe6b6759cc0c283d2e7adb19d7f.jpg");
    expect(respuesta.status).toBe(401);
    expect(leerHogarActual).toHaveBeenCalledOnce();
  });

  test("con su hogar, sigue validando el nombre antes de tocar el disco", async () => {
    leerHogarActual.mockResolvedValue(HOGAR);
    const respuesta = await pedir("..%2F.env");
    expect(respuesta.status).toBe(400);
  });

  test("con su hogar y un nombre valido que no existe, 404", async () => {
    leerHogarActual.mockResolvedValue(HOGAR);
    const respuesta = await pedir("00000000000000000000000000000000.jpg");
    expect(respuesta.status).toBe(404);
  });
});
