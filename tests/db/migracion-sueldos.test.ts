import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { urlDePrueba } from "./base";

/**
 * La migracion del sueldo por persona, como pasaria en tu base: con las
 * migraciones de antes, un hogar con dueno y otro miembro, y un historial de
 * sueldos. Despues de aplicarla, el historial es del dueno y nada cambia de
 * monto. La base aparte se borra al final.
 */

const CARPETA = join(process.cwd(), "prisma", "migrations");
const MIGRACION = readdirSync(CARPETA).find((m) => m.endsWith("_sueldo_por_persona"));

const urlMigracion = (() => {
  const url = new URL(urlDePrueba());
  url.pathname = `${url.pathname}_migracion_sueldos`;
  return url;
})();
const nombreBase = urlMigracion.pathname.replace(/^\//, "");

function administracion(): Client {
  const url = new URL(urlMigracion);
  url.pathname = "/postgres";
  return new Client({ connectionString: url.toString() });
}

const aplicar = (cliente: Client, migracion: string) =>
  cliente.query(readFileSync(join(CARPETA, migracion, "migration.sql"), "utf8"));

let base: Client;

beforeAll(async () => {
  if (MIGRACION === undefined) throw new Error("No encuentro la migracion del sueldo por persona");

  const admin = administracion();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${nombreBase}"`);
  await admin.end();

  base = new Client({ connectionString: urlMigracion.toString() });
  await base.connect();
  const anteriores = readdirSync(CARPETA)
    .filter((m) => !m.endsWith(".toml") && m < MIGRACION)
    .sort();
  for (const m of anteriores) await aplicar(base, m);

  await base.query(`
    INSERT INTO hogares (id, nombre) VALUES ('casa', 'Casa'), ('otra', 'Otra');
    INSERT INTO miembros (id, hogar_id, correo, rol, entro_en)
      VALUES ('fer', 'casa', 'fer@gmail.com', 'DUENO', now()),
             ('angelina', 'casa', 'angelina@gmail.com', 'MIEMBRO', now()),
             ('ana', 'otra', 'ana@gmail.com', 'DUENO', now());
    INSERT INTO sueldos (id, hogar_id, monto, vigente_desde, actualizado_en)
      VALUES ('s1', 'casa', 900000, '2026-01-01', now()),
             ('s2', 'casa', 1000000, '2026-06-01', now()),
             ('s3', 'otra', 700000, '2026-03-01', now());
  `);
  await aplicar(base, MIGRACION);
});

afterAll(async () => {
  await base?.end();
  const admin = administracion();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
  await admin.end();
});

describe("el sueldo pasa a ser de cada persona", () => {
  test("el historial de cada hogar queda como sueldo de su dueno, con los mismos montos", async () => {
    const { rows } = await base.query("SELECT id, miembro_id, monto, vigente_hasta FROM sueldos ORDER BY id");
    expect(rows).toEqual([
      { id: "s1", miembro_id: "fer", monto: 900000, vigente_hasta: null },
      { id: "s2", miembro_id: "fer", monto: 1000000, vigente_hasta: null },
      { id: "s3", miembro_id: "ana", monto: 700000, vigente_hasta: null },
    ]);
  });

  test("despues, otro miembro puede anotar su sueldo el mismo mes", async () => {
    await base.query(`
      INSERT INTO sueldos (id, hogar_id, miembro_id, monto, vigente_desde, actualizado_en)
      VALUES ('s4', 'casa', 'angelina', 800000, '2026-06-01', now())
    `);
    const { rows } = await base.query("SELECT count(*)::int AS n FROM sueldos WHERE vigente_desde = '2026-06-01'");
    expect(rows[0].n).toBe(2);
  });

  test("la misma persona no anota dos sueldos el mismo mes", async () => {
    await expect(
      base.query(`
        INSERT INTO sueldos (id, hogar_id, miembro_id, monto, vigente_desde, actualizado_en)
        VALUES ('s5', 'casa', 'fer', 1, '2026-06-01', now())
      `),
    ).rejects.toThrow(/sueldos_miembro_id_vigente_desde_key/);
  });
});
