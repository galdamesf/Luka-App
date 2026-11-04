import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { urlDePrueba } from "./base";

/**
 * La promesa de la migracion de hogares: lo que ya estaba anotado queda en el
 * hogar inicial, sin perder nada.
 *
 * Se prueba como pasaria en tu base: en una base aparte se aplican las
 * migraciones de ANTES, se anota un poco de todo, y recien ahi se aplica la de
 * hogares. Despues, las que vienen detras (lo unico pasa a ser por hogar), y
 * se revisa que tampoco pierdan nada. La base aparte se borra al final.
 */

const CARPETA = join(process.cwd(), "prisma", "migrations");
const MIGRACION_HOGARES = readdirSync(CARPETA).find((m) => m.endsWith("_hogares"));
const TABLAS = ["categorias", "gastos", "sueldos", "deudas", "cuentas", "presupuestos", "ahorros", "ajustes"];

const urlMigracion = (() => {
  const url = new URL(urlDePrueba());
  url.pathname = `${url.pathname}_migracion`;
  return url;
})();
const nombreBase = urlMigracion.pathname.replace(/^\//, "");

function administracion(): Client {
  const url = new URL(urlMigracion);
  url.pathname = "/postgres";
  return new Client({ connectionString: url.toString() });
}

async function aplicar(cliente: Client, migracion: string): Promise<void> {
  await cliente.query(readFileSync(join(CARPETA, migracion, "migration.sql"), "utf8"));
}

let base: Client;
const antes: Record<string, number> = {};

beforeAll(async () => {
  if (MIGRACION_HOGARES === undefined) throw new Error("No encuentro la migracion de hogares");

  const admin = administracion();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombreBase}"`);
  await admin.end();

  base = new Client({ connectionString: urlMigracion.toString() });
  await base.connect();

  const anteriores = readdirSync(CARPETA)
    .filter((m) => !m.endsWith(".toml") && m < MIGRACION_HOGARES)
    .sort();
  for (const m of anteriores) await aplicar(base, m);

  // Un poco de todo, como en una base con uso.
  await base.query(`
    INSERT INTO categorias (id, nombre, color, icono) VALUES ('c1', 'Supermercado', '#15803D', 'shopping-cart');
    INSERT INTO gastos (id, fecha, descripcion, monto, categoria_id, actualizado_en)
      VALUES ('g1', '2026-10-28', 'Feria', 12000, 'c1', now()), ('g2', '2026-10-30', 'Pan', 2500, 'c1', now());
    INSERT INTO sueldos (id, monto, vigente_desde, actualizado_en) VALUES ('s1', 1000000, '2026-10-01', now());
    INSERT INTO deudas (id, nombre, monto_cuota, cuotas_totales, primera_cuota, actualizado_en)
      VALUES ('d1', 'Notebook', 50000, 12, '2026-10-01', now());
    INSERT INTO cuotas_pagadas (id, deuda_id, mes, pagada_en, monto) VALUES ('q1', 'd1', '2026-10-01', '2026-10-05', 50000);
    INSERT INTO cuentas (id, nombre, monto, mes, categoria_id, actualizado_en)
      VALUES ('k1', 'Luz', 30000, '2026-11-01', 'c1', now());
    INSERT INTO presupuestos (id, categoria_id, mes, monto, actualizado_en) VALUES ('p1', 'c1', '2026-11-01', 200000, now());
    INSERT INTO ahorros (id, mes, monto, actualizado_en) VALUES ('a1', '2026-11-01', 40000, now());
    INSERT INTO ajustes (id, dia_inicio_mes, actualizado_en) VALUES ('app', 27, now());
  `);

  for (const tabla of [...TABLAS, "cuotas_pagadas"]) {
    const { rows } = await base.query(`SELECT count(*)::int AS n FROM "${tabla}"`);
    antes[tabla] = rows[0].n;
  }

  await aplicar(base, MIGRACION_HOGARES);
});

afterAll(async () => {
  await base?.end();
  const admin = administracion();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
  await admin.end();
});

describe("migracion de hogares sobre una base con datos", () => {
  test("crea el hogar inicial, sin miembros todavia", async () => {
    const hogares = await base.query("SELECT id, nombre FROM hogares");
    expect(hogares.rows).toEqual([{ id: "hogar-inicial", nombre: "Mi hogar" }]);
    const miembros = await base.query("SELECT count(*)::int AS n FROM miembros");
    expect(miembros.rows[0].n).toBe(0);
  });

  test("no se pierde ninguna fila", async () => {
    for (const [tabla, n] of Object.entries(antes)) {
      const { rows } = await base.query(`SELECT count(*)::int AS n FROM "${tabla}"`);
      expect(rows[0].n, tabla).toBe(n);
    }
  });

  test.each(TABLAS)("todo lo de %s queda en el hogar inicial", async (tabla) => {
    const { rows } = await base.query(`SELECT DISTINCT hogar_id FROM "${tabla}"`);
    expect(rows).toEqual([{ hogar_id: "hogar-inicial" }]);
  });

  test("los gastos de antes quedan sin autor: no se sabe quien los anoto", async () => {
    const { rows } = await base.query("SELECT count(*)::int AS n FROM gastos WHERE anotado_por_id IS NOT NULL");
    expect(rows[0].n).toBe(0);
  });

  test("el dia de inicio y los montos siguen iguales", async () => {
    const ajustes = await base.query("SELECT dia_inicio_mes FROM ajustes");
    expect(ajustes.rows).toEqual([{ dia_inicio_mes: 27 }]);
    const gastos = await base.query("SELECT sum(monto)::int AS total FROM gastos");
    expect(gastos.rows[0].total).toBe(14500);
  });
});

describe("despues, lo unico pasa a ser unico por hogar", () => {
  beforeAll(async () => {
    const posteriores = readdirSync(CARPETA)
      .filter((m) => !m.endsWith(".toml") && m > (MIGRACION_HOGARES as string))
      .sort();
    expect(posteriores.length).toBeGreaterThan(0);
    for (const m of posteriores) await aplicar(base, m);
  });

  test("no se pierde ninguna fila", async () => {
    for (const [tabla, n] of Object.entries(antes)) {
      const { rows } = await base.query(`SELECT count(*)::int AS n FROM "${tabla}"`);
      expect(rows[0].n, tabla).toBe(n);
    }
  });

  test("los ajustes de antes quedan como los del hogar inicial, con su dia", async () => {
    const { rows } = await base.query("SELECT * FROM ajustes");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ hogar_id: "hogar-inicial", dia_inicio_mes: 27 });
    expect(rows[0]).not.toHaveProperty("id");
  });

  test("otro hogar ya puede tener su «Supermercado» y sus ajustes", async () => {
    await base.query(`
      INSERT INTO hogares (id, nombre) VALUES ('otro', 'Casa de Ana');
      INSERT INTO categorias (id, hogar_id, nombre, color, icono) VALUES ('c2', 'otro', 'Supermercado', '#15803D', 'shopping-cart');
      INSERT INTO ajustes (hogar_id, dia_inicio_mes, actualizado_en) VALUES ('otro', 5, now());
    `);
    const { rows } = await base.query("SELECT count(*)::int AS n FROM categorias WHERE nombre = 'Supermercado'");
    expect(rows[0].n).toBe(2);
  });

  test("dentro de un mismo hogar, el nombre sigue sin repetirse", async () => {
    await expect(
      base.query(
        "INSERT INTO categorias (id, hogar_id, nombre, color, icono) VALUES ('c3', 'hogar-inicial', 'Supermercado', '#15803D', 'shopping-cart')",
      ),
    ).rejects.toThrow(/categorias_hogar_id_nombre_key/);
  });
});
