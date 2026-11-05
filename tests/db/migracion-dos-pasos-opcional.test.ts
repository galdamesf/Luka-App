import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { urlDePrueba } from "./base";

/**
 * La migracion que deja opcional la verificacion en dos pasos, como pasaria
 * en tu base: con las migraciones de antes y cuatro personas (con la app, con
 * la app a medias, sin app e invitada). Despues de aplicarla, solo quien ya
 * tenia la app queda como que eligio. La base aparte se borra al final.
 */

const CARPETA = join(process.cwd(), "prisma", "migrations");
const MIGRACION = readdirSync(CARPETA).find((m) => m.endsWith("_dos_pasos_opcional"));

const urlMigracion = (() => {
  const url = new URL(urlDePrueba());
  url.pathname = `${url.pathname}_migracion_dos_pasos`;
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
  if (MIGRACION === undefined) throw new Error("No encuentro la migracion de la verificacion opcional");

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
    INSERT INTO hogares (id, nombre) VALUES ('casa', 'Casa');
    INSERT INTO miembros (id, hogar_id, correo, rol, entro_en)
      VALUES ('con-app', 'casa', 'con-app@gmail.com', 'DUENO', '2026-11-04 15:00'),
             ('a-medias', 'casa', 'a-medias@gmail.com', 'MIEMBRO', '2026-11-04 15:00'),
             ('sin-app', 'casa', 'sin-app@gmail.com', 'MIEMBRO', '2026-11-04 15:00'),
             ('invitada', 'casa', 'invitada@gmail.com', 'MIEMBRO', NULL);
    INSERT INTO dos_pasos (miembro_id, clave_cifrada, confirmado_en)
      VALUES ('con-app', 'v1.a.b.c', '2026-11-04 16:30'),
             ('a-medias', 'v1.d.e.f', NULL);
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

describe("la verificacion en dos pasos pasa a ser opcional", () => {
  test("quien ya tenia la app queda como que eligio, con la fecha en que la configuro; los demas eligen al entrar", async () => {
    const { rows } = await base.query(
      `SELECT id, to_char(decidio_dos_pasos_en, 'YYYY-MM-DD HH24:MI') AS decidio FROM miembros ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: "a-medias", decidio: null },
      { id: "con-app", decidio: "2026-11-04 16:30" },
      { id: "invitada", decidio: null },
      { id: "sin-app", decidio: null },
    ]);
  });

  test("no toca la app de nadie", async () => {
    const { rows } = await base.query("SELECT miembro_id, confirmado_en IS NOT NULL AS confirmada FROM dos_pasos ORDER BY miembro_id");
    expect(rows).toEqual([
      { miembro_id: "a-medias", confirmada: false },
      { miembro_id: "con-app", confirmada: true },
    ]);
  });
});
