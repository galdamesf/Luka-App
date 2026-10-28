import { afterEach, describe, expect, test } from "vitest";
import { aplicarEnv, cargarEnv, parsearEnv } from "@/lib/env";

const CLAVES_DE_PRUEBA = ["CG_PRUEBA_A", "CG_PRUEBA_B", "CG_PRUEBA_C"];

afterEach(() => {
  for (const clave of CLAVES_DE_PRUEBA) delete process.env[clave];
});

describe("parsearEnv", () => {
  test("lee el formato que usa nuestro .env", () => {
    const pares = parsearEnv(
      'DATABASE_URL="postgresql://gastos:gastos_local@localhost:5433/control_gastos?schema=public"',
    );
    expect(pares.get("DATABASE_URL")).toBe(
      "postgresql://gastos:gastos_local@localhost:5433/control_gastos?schema=public",
    );
  });

  test("saca las comillas dobles y simples", () => {
    const pares = parsearEnv('A="uno"\nB=\'dos\'\nC=tres');
    expect(pares.get("A")).toBe("uno");
    expect(pares.get("B")).toBe("dos");
    expect(pares.get("C")).toBe("tres");
  });

  test("ignora lineas vacias y comentarios", () => {
    const pares = parsearEnv("# un comentario\n\n  \nA=1\n#B=2");
    expect(pares.get("A")).toBe("1");
    expect(pares.has("B")).toBe(false);
    expect(pares.size).toBe(1);
  });

  test("acepta export adelante", () => {
    expect(parsearEnv("export A=1").get("A")).toBe("1");
  });

  test("no corta el valor en el signo igual ni en los ? de la URL", () => {
    const url = "postgresql://u:p@h:5433/db?schema=public&sslmode=require";
    expect(parsearEnv(`DATABASE_URL=${url}`).get("DATABASE_URL")).toBe(url);
  });

  test("sin comillas, un # con espacio adelante es comentario", () => {
    expect(parsearEnv("A=valor # nota").get("A")).toBe("valor");
    // Entre comillas el # es parte del valor: importante para colores hex.
    expect(parsearEnv('A="#15803D"').get("A")).toBe("#15803D");
  });

  test("descarta claves invalidas y lineas sin igual", () => {
    const pares = parsearEnv("sin igual\n=sin clave\n1MALA=x\nBUENA=ok");
    expect(pares.size).toBe(1);
    expect(pares.get("BUENA")).toBe("ok");
  });

  test("tolera saltos de linea de Windows", () => {
    expect(parsearEnv("A=1\r\nB=2").get("B")).toBe("2");
  });
});

describe("aplicarEnv", () => {
  test("define lo que falta en process.env", () => {
    const definidas = aplicarEnv("CG_PRUEBA_A=valor");
    expect(definidas).toEqual(["CG_PRUEBA_A"]);
    expect(process.env.CG_PRUEBA_A).toBe("valor");
  });

  test("no pisa una variable que ya viene del entorno", () => {
    process.env.CG_PRUEBA_B = "del entorno";
    const definidas = aplicarEnv("CG_PRUEBA_B=del archivo");
    expect(definidas).toEqual([]);
    expect(process.env.CG_PRUEBA_B).toBe("del entorno");
  });
});

describe("cargarEnv", () => {
  test("si el archivo no existe no explota", () => {
    expect(cargarEnv("no-existe-este-archivo.env")).toEqual([]);
  });

  test("lee el .env del proyecto y deja DATABASE_URL disponible", () => {
    delete process.env.DATABASE_URL;
    cargarEnv();
    expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    expect(process.env.DATABASE_URL).toContain("control_gastos");
  });
});
