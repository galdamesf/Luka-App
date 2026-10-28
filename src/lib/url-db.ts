import { cargarEnv } from "./env";

/**
 * Deriva la URL de la base de PRUEBAS a partir de la de trabajo, agregandole
 * el sufijo `_test` al nombre de la base.
 *
 * Nunca devuelve la base de trabajo: los tests truncan tablas, y apuntar sin
 * querer a la base real borraria los gastos de verdad.
 *
 * @param base URL explicita. Si se omite, se lee del entorno (y del .env).
 */
export function urlDePrueba(base?: string): string {
  let origen = base;

  if (origen === undefined) {
    // Vitest NO carga .env en process.env por su cuenta: dentro de los tests
    // DATABASE_URL llega undefined aunque el archivo exista. Hay que cargarla
    // aca o esto falla con un mensaje que apunta al lugar equivocado.
    //
    // cargarEnv no pisa lo que ya este definido, asi que llamarla de nuevo es
    // inofensivo. Eso ademas permite que global-setup le pase la URL de la base
    // _test al proceso hijo de `prisma migrate deploy` sin que el .env se la
    // sobrescriba con la base de trabajo.
    cargarEnv();

    const explicita = process.env.TEST_DATABASE_URL;
    if (explicita !== undefined && explicita.trim() !== "") return explicita;

    origen = process.env.DATABASE_URL;
  }

  if (origen === undefined || origen.trim() === "") {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env y levanta Postgres con npm run db:up.",
    );
  }

  const url = new URL(origen);
  const nombre = url.pathname.replace(/^\//, "");

  if (nombre === "") {
    throw new Error(`DATABASE_URL no indica una base de datos: ${origen}`);
  }
  // Ya apunta a una base de pruebas: se deja tal cual, sin encadenar sufijos.
  if (nombre.endsWith("_test")) return url.toString();

  url.pathname = `/${nombre}_test`;
  return url.toString();
}
