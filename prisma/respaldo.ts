/**
 * Saca una copia completa de tu base (estructura y datos) a la carpeta
 * respaldos/, con la fecha y la hora en el nombre:
 *
 *   npm run db:respaldo
 *
 * Necesita la base corriendo (npm run db:up). La copia es SQL comun: se puede
 * abrir con cualquier editor. Los respaldos tienen tus datos, por eso la
 * carpeta no va al repositorio (.gitignore).
 *
 * Para volver a una copia, el comando que imprime al terminar. Volver a una
 * copia REEMPLAZA todo lo que hay en la base por lo de la copia: por eso el
 * archivo parte borrando el esquema, y asi tampoco quedan restos de una
 * migracion aplicada despues del respaldo.
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";

// Los mismos de docker-compose.yml.
const SERVICIO = "db";
const USUARIO = "gastos";
const BASE = "control_gastos";
const CARPETA = "respaldos";

/** 2026-11-03_150245: ordena bien como texto y no tiene caracteres raros. */
function sello(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `_${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}`
  );
}

async function main() {
  const ahora = new Date();
  mkdirSync(CARPETA, { recursive: true });
  const archivo = join(CARPETA, `luka-${sello(ahora)}.sql`);
  // Se escribe aparte y se renombra al final: si algo falla a medias, no
  // queda un respaldo cortado que parezca bueno.
  const parcial = `${archivo}.parcial`;

  const salida = createWriteStream(parcial);
  const cabecera = [
    `-- Respaldo de Luka (${ahora.toLocaleString("es-CL")})`,
    "-- Al restaurarlo REEMPLAZA todo lo que hay en la base por lo de este archivo.",
    "DROP SCHEMA IF EXISTS public CASCADE;",
    // El esquema vuelve tal como lo crea Postgres 16 en una base nueva.
    "CREATE SCHEMA public AUTHORIZATION pg_database_owner;",
    "GRANT USAGE ON SCHEMA public TO PUBLIC;",
    "COMMENT ON SCHEMA public IS 'standard public schema';",
    "",
    "",
  ].join("\n");
  salida.write(cabecera);

  // --no-owner: la copia se puede restaurar con otro usuario de Postgres.
  const volcado = spawn(
    "docker",
    ["compose", "exec", "-T", SERVICIO, "pg_dump", "-U", USUARIO, "-d", BASE, "--no-owner"],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  volcado.stdout.pipe(salida, { end: false });

  const codigo = await new Promise<number | null>((resolver) => {
    volcado.on("error", (error) => {
      console.error(`No pude correr docker: ${error.message}`);
      resolver(null);
    });
    volcado.on("close", resolver);
  });
  salida.end();
  await once(salida, "finish");

  const tamano = statSync(parcial).size;
  if (codigo !== 0 || tamano <= Buffer.byteLength(cabecera)) {
    rmSync(parcial, { force: true });
    console.error("No se pudo sacar el respaldo. ¿Está corriendo la base? Levántala con: npm run db:up");
    process.exitCode = 1;
    return;
  }

  renameSync(parcial, archivo);
  console.log(`Respaldo listo: ${archivo} (${Math.max(1, Math.round(tamano / 1024))} KB)`);
  console.log("");
  console.log("Para volver a esta copia (reemplaza TODO lo que hay en la base):");
  console.log(`  docker compose exec -T ${SERVICIO} psql -U ${USUARIO} -d ${BASE} -v ON_ERROR_STOP=1 -q < ${archivo}`);
}

main().catch((error) => {
  console.error("El respaldo falló:", error);
  process.exitCode = 1;
});
