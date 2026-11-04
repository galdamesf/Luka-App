import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

describe("GET /boletas/[archivo] con una carpeta por hogar", () => {
  const NOMBRE = "0123456789abcdef0123456789abcdef.jpg";
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  let raiz: string;

  beforeEach(async () => {
    // La ruta lee la carpeta de boletas de CARPETA_BOLETAS: aqui, una temporal
    // con una boleta en la carpeta del hogar h1.
    raiz = await mkdtemp(join(tmpdir(), "boletas-ruta-"));
    vi.stubEnv("CARPETA_BOLETAS", raiz);
    await mkdir(join(raiz, "h1"));
    await writeFile(join(raiz, "h1", NOMBRE), JPG);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(raiz, { recursive: true, force: true });
  });

  test("el hogar de la boleta la ve", async () => {
    leerHogarActual.mockResolvedValue({ hogarId: "h1", miembroId: "m1", rol: "DUENO" });
    const respuesta = await pedir(NOMBRE);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("image/jpeg");
    expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(JPG);
  });

  test("otro hogar recibe 404, como si no existiera, aunque sepa el nombre", async () => {
    leerHogarActual.mockResolvedValue({ hogarId: "h2", miembroId: "m2", rol: "DUENO" });
    expect((await pedir(NOMBRE)).status).toBe(404);
  });

  test("una boleta suelta de antes de los hogares no se sirve a nadie", async () => {
    await writeFile(join(raiz, NOMBRE.replace("0123", "9999")), JPG);
    leerHogarActual.mockResolvedValue({ hogarId: "h1", miembroId: "m1", rol: "DUENO" });
    expect((await pedir(NOMBRE.replace("0123", "9999"))).status).toBe(404);
  });
});
