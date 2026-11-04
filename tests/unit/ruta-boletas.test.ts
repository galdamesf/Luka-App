import { beforeEach, describe, expect, test, vi } from "vitest";

// La ruta pregunta por la sesion a src/auth.ts; aqui se reemplaza para no
// levantar next-auth.
const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));

const { GET } = await import("@/app/boletas/[archivo]/route");

function pedir(archivo: string) {
  return GET(new Request(`http://localhost/boletas/${archivo}`), {
    params: Promise.resolve({ archivo }),
  });
}

beforeEach(() => {
  auth.mockReset();
});

describe("GET /boletas/[archivo]", () => {
  test("sin sesion responde 401, aunque el nombre sea valido", async () => {
    auth.mockResolvedValue(null);
    const respuesta = await pedir("0dd4ebe6b6759cc0c283d2e7adb19d7f.jpg");
    expect(respuesta.status).toBe(401);
  });

  test("una sesion sin usuario tampoco pasa", async () => {
    auth.mockResolvedValue({ expires: "2099-01-01T00:00:00.000Z" });
    const respuesta = await pedir("0dd4ebe6b6759cc0c283d2e7adb19d7f.jpg");
    expect(respuesta.status).toBe(401);
  });

  test("con sesion, sigue validando el nombre antes de tocar el disco", async () => {
    auth.mockResolvedValue({ user: { email: "f@gmail.com" } });
    const respuesta = await pedir("..%2F.env");
    expect(respuesta.status).toBe(400);
  });

  test("con sesion y un nombre valido que no existe, 404", async () => {
    auth.mockResolvedValue({ user: { email: "f@gmail.com" } });
    const respuesta = await pedir("00000000000000000000000000000000.jpg");
    expect(respuesta.status).toBe(404);
  });
});
