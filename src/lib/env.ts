import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga un archivo .env dentro de process.env.
 *
 * Por que existe: cuando hay un prisma.config.ts, Prisma 6 deja de cargar .env
 * por su cuenta ("Prisma config detected, skipping environment variable
 * loading") y el esquema falla con P1012 por DATABASE_URL faltante. Asi que lo
 * cargamos nosotros desde el config.
 *
 * Las variables que ya vienen del entorno tienen prioridad: el .env no las pisa.
 * Si el archivo no existe no pasa nada, se asume que el entorno ya las trae
 * (CI, produccion).
 *
 * @returns Las claves que efectivamente se definieron.
 */
export function cargarEnv(archivo = ".env", directorio = process.cwd()): string[] {
  const ruta = resolve(directorio, archivo);

  let contenido: string;
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch {
    return [];
  }

  return aplicarEnv(contenido);
}

/** Parsea el contenido de un .env y define lo que falte en process.env. */
export function aplicarEnv(contenido: string): string[] {
  const definidas: string[] = [];

  for (const [clave, valor] of parsearEnv(contenido)) {
    // No pisar lo que ya venga del entorno.
    if (process.env[clave] !== undefined) continue;
    process.env[clave] = valor;
    definidas.push(clave);
  }

  return definidas;
}

/**
 * Parsea un .env simple: KEY=valor, una por linea, con comillas opcionales.
 * No soporta valores multilinea ni interpolacion, que no necesitamos.
 */
export function parsearEnv(contenido: string): Map<string, string> {
  const pares = new Map<string, string>();

  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === "" || limpia.startsWith("#")) continue;

    // "export FOO=bar" tambien se acepta.
    const sinExport = limpia.startsWith("export ") ? limpia.slice(7).trim() : limpia;

    const corte = sinExport.indexOf("=");
    if (corte <= 0) continue;

    const clave = sinExport.slice(0, corte).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(clave)) continue;

    let valor = sinExport.slice(corte + 1).trim();

    const entreComillas =
      valor.length >= 2 &&
      ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'")));

    if (entreComillas) {
      valor = valor.slice(1, -1);
    } else {
      // Sin comillas, un # empieza comentario.
      const comentario = valor.indexOf(" #");
      if (comentario !== -1) valor = valor.slice(0, comentario).trimEnd();
    }

    pares.set(clave, valor);
  }

  return pares;
}
