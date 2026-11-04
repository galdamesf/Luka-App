import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { urlDePrueba, urlDePruebaNube } from "@/lib/url-db";

/**
 * Antes de los tests de base de datos: crear las bases de pruebas si no
 * existen y aplicarles las migraciones. Correrlo de nuevo no rompe nada.
 *
 * Son dos: la _test de siempre y la _nube_test, que hace de «la nube» en los
 * tests de npm run nube:subir.
 */
export default async function setup() {
  for (const url of [urlDePrueba(), urlDePruebaNube()]) {
    await crearBaseSiFalta(url);

    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    });
  }
}

async function crearBaseSiFalta(url: string): Promise<void> {
  const destino = new URL(url);
  const nombre = destino.pathname.replace(/^\//, "");

  // Para crear una base hay que estar conectado a otra: usamos postgres.
  const administracion = new URL(url);
  administracion.pathname = "/postgres";

  const cliente = new Client({ connectionString: administracion.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [nombre],
    );
    if (existe.rowCount === 0) {
      // El nombre viene de .env, no de entrada del usuario, pero igual se
      // escapa con comillas dobles porque no admite parametros.
      await cliente.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
      console.log(`Base de pruebas creada: ${nombre}`);
    }
  } finally {
    await cliente.end();
  }
}
