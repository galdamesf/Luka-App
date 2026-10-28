import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { urlDePrueba } from "@/lib/url-db";

const BASE = "postgresql://gastos:gastos_local@localhost:5433/control_gastos?schema=public";

let guardadas: Record<string, string | undefined>;

beforeEach(() => {
  guardadas = {
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  };
});

afterEach(() => {
  for (const [clave, valor] of Object.entries(guardadas)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
});

describe("urlDePrueba con una URL explicita", () => {
  test("le agrega el sufijo _test al nombre de la base", () => {
    expect(urlDePrueba(BASE)).toContain("/control_gastos_test");
  });

  test("conserva usuario, clave, host, puerto y parametros", () => {
    const url = new URL(urlDePrueba(BASE));
    expect(url.username).toBe("gastos");
    expect(url.password).toBe("gastos_local");
    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("5433");
    expect(url.searchParams.get("schema")).toBe("public");
  });

  test("NUNCA devuelve la base de trabajo", () => {
    const resultado = urlDePrueba(BASE);
    expect(new URL(resultado).pathname).not.toBe("/control_gastos");
  });

  test("no encadena sufijos si ya apunta a una base _test", () => {
    const yaDePrueba = BASE.replace("control_gastos", "control_gastos_test");
    expect(urlDePrueba(yaDePrueba)).not.toContain("_test_test");
  });

  test("reclama si la URL no indica base de datos", () => {
    expect(() => urlDePrueba("postgresql://gastos@localhost:5433")).toThrow(
      /no indica una base de datos/i,
    );
  });

  test("reclama si viene vacia", () => {
    expect(() => urlDePrueba("   ")).toThrow(/Falta DATABASE_URL/i);
  });
});

describe("urlDePrueba leyendo del entorno", () => {
  test("REGRESION: funciona dentro de vitest, que no carga .env solo", () => {
    // Este es el bug que se escapo: vitest deja DATABASE_URL en undefined
    // aunque el .env exista. urlDePrueba tiene que cargarlo por su cuenta.
    delete process.env.DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;

    expect(process.env.DATABASE_URL).toBeUndefined();

    const resultado = urlDePrueba();
    expect(resultado).toMatch(/^postgresql:\/\//);
    expect(resultado).toContain("control_gastos_test");
  });

  test("TEST_DATABASE_URL manda por sobre lo derivado", () => {
    process.env.TEST_DATABASE_URL = "postgresql://otro@otrohost:5555/otra_base";
    expect(urlDePrueba()).toBe("postgresql://otro@otrohost:5555/otra_base");
  });

  test("una TEST_DATABASE_URL vacia no cuenta como definida", () => {
    process.env.TEST_DATABASE_URL = "   ";
    expect(urlDePrueba()).toContain("control_gastos_test");
  });
});
