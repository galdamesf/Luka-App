/**
 * Las reglas para copiar Luka de tu Mac a la nube (npm run nube:subir), sin
 * base de datos ni archivos: que se copia, en que orden, que se perderia y
 * que conexion se usa. Lo que lee y escribe esta en src/datos/subir-a-la-nube.ts
 * y src/lib/boletas-a-la-nube.ts.
 */

/**
 * Las tablas que se copian, en el orden en que se pueden insertar: cada una
 * despues de las que apunta con sus llaves foraneas. Para vaciar, al reves.
 *
 * Los codigos para borrar un hogar no se copian: duran unos minutos y valen
 * solo donde se pidieron.
 */
export const TABLAS = [
  "hogar",
  "miembro",
  "categoria",
  "deuda",
  "sueldo",
  "ahorro",
  "ajustes",
  "gasto",
  "cuenta",
  "cuotaPagada",
  "presupuesto",
] as const;

export type Tabla = (typeof TABLAS)[number];

/** Una fila tal como la devuelve Prisma: solo columnas, sin relaciones. */
export type Fila = Record<string, unknown>;

/** Todo lo de una base, tabla por tabla. */
export type Datos = Record<Tabla, Fila[]>;

/** Como se llama cada tabla para mostrarla. */
export const NOMBRE_DE_TABLA: Record<Tabla, string> = {
  hogar: "hogares",
  miembro: "miembros",
  categoria: "categorias",
  deuda: "deudas",
  sueldo: "sueldos",
  ahorro: "ahorros",
  ajustes: "ajustes",
  gasto: "gastos",
  cuenta: "cuentas",
  cuotaPagada: "cuotas pagadas",
  presupuesto: "presupuestos",
};

/** La llave primaria de cada fila: `id`, salvo en ajustes, que es la del hogar. */
export function llavePrimaria(tabla: Tabla, fila: Fila): string {
  return String(tabla === "ajustes" ? fila.hogarId : fila.id);
}

/**
 * Ordena las filas por su llave, comparando caracter a caracter. No se usa el
 * orden de Postgres porque depende del idioma de cada base (tu Mac ordena en
 * es_CL y la nube no): con el mismo contenido saldrian en otro orden.
 */
export function ordenarFilas(tabla: Tabla, filas: Fila[]): Fila[] {
  return [...filas].sort((a, b) => {
    const x = llavePrimaria(tabla, a);
    const y = llavePrimaria(tabla, b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Cuantas filas hay en cada tabla. */
export function contar(datos: Datos): Record<Tabla, number> {
  return Object.fromEntries(TABLAS.map((t) => [t, datos[t].length])) as Record<Tabla, number>;
}

export type ComparacionDeMigraciones = {
  iguales: boolean;
  /** Las que tiene tu Mac y la nube no. */
  soloEnOrigen: string[];
  /** Las que tiene la nube y tu Mac no. */
  soloEnDestino: string[];
};

/**
 * Las dos bases tienen que tener las mismas migraciones: si no, sus tablas no
 * tienen las mismas columnas y copiar fallaria a medias o dejaria datos mal.
 */
export function compararMigraciones(origen: string[], destino: string[]): ComparacionDeMigraciones {
  const soloEnOrigen = origen.filter((m) => !destino.includes(m)).sort();
  const soloEnDestino = destino.filter((m) => !origen.includes(m)).sort();
  return { iguales: soloEnOrigen.length === 0 && soloEnDestino.length === 0, soloEnOrigen, soloEnDestino };
}

export type LoQueSePierde = {
  /** Por tabla, cuantas filas de la nube no estan en tu Mac. Solo las que tienen alguna. */
  filas: { tabla: Tabla; cuantas: number }[];
  /** Las personas de la nube que no estan en tu Mac: perderian su hogar. */
  correos: string[];
};

/**
 * Lo que hay en la nube y desapareceria al reemplazarla por lo de tu Mac.
 *
 * Una fila se conserva si en tu Mac hay otra con la misma llave. A las
 * personas se las reconoce por el correo y no por el id: la primera vez que
 * entraste a la nube se te creo otro id, pero sigues siendo tu.
 */
export function loQueSePierde(origen: Datos, destino: Datos): LoQueSePierde {
  const filas: LoQueSePierde["filas"] = [];
  let correos: string[] = [];

  for (const tabla of TABLAS) {
    const llave =
      tabla === "miembro"
        ? (f: Fila) => String(f.correo)
        : (f: Fila) => llavePrimaria(tabla, f);
    const enOrigen = new Set(origen[tabla].map(llave));
    const perdidas = destino[tabla].filter((f) => !enOrigen.has(llave(f)));
    if (perdidas.length > 0) filas.push({ tabla, cuantas: perdidas.length });
    if (tabla === "miembro") correos = perdidas.map(llave).sort();
  }

  return { filas, correos };
}

/** true si no se pierde nada de la nube. */
export function nadaSePierde(perdida: LoQueSePierde): boolean {
  return perdida.filas.length === 0;
}

const MAQUINA_LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

/**
 * La conexion a la base de la nube, desde lo que bajo `vercel env pull` mas
 * la linea que pegaste de Neon. Se prefiere la conexion directa
 * (DATABASE_URL_UNPOOLED): copiar es una sola transaccion larga.
 *
 * Lanza si falta, si no parece una URL de Postgres o si apunta a tu propio
 * computador: copiar tu Mac sobre tu Mac borraria tus datos.
 */
export function urlDeLaNube(variables: Map<string, string>, urlLocal: string): string {
  const url = ["DATABASE_URL_UNPOOLED", "NUBE_DATABASE_URL", "DATABASE_URL"]
    .map((clave) => variables.get(clave)?.trim())
    .find((valor) => valor !== undefined && valor !== "");

  if (url === undefined) {
    throw new Error(
      "Falta la conexión a la base de la nube: pega la línea DATABASE_URL_UNPOOLED=… en .env.nube.local.",
    );
  }

  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new Error("La conexión a la nube en .env.nube.local no es una URL válida.");
  }
  if (destino.protocol !== "postgresql:" && destino.protocol !== "postgres:") {
    throw new Error("La conexión a la nube en .env.nube.local no es de Postgres (debe empezar con postgresql://).");
  }
  if (MAQUINA_LOCAL.has(destino.hostname) || url === urlLocal.trim()) {
    throw new Error(
      "La conexión en .env.nube.local apunta a tu propio computador, no a la nube. Revisa que sea la de Neon.",
    );
  }
  return url;
}

export type CredencialesDeBlob = {
  /** Variables que el SDK de Vercel Blob lee del entorno. */
  variables: Record<string, string>;
  /** Como se conecta, para mostrarlo. */
  modo: "oidc" | "token";
};

/**
 * Las credenciales del Blob que bajo `vercel env pull`: el id del almacen con
 * el token OIDC de corta duracion (lo normal), o un token de lectura y
 * escritura. null si no hay ninguna de las dos.
 */
export function credencialesDeBlob(variables: Map<string, string>): CredencialesDeBlob | null {
  const almacen = variables.get("BLOB_STORE_ID")?.trim();
  const oidc = variables.get("VERCEL_OIDC_TOKEN")?.trim();
  if (almacen && oidc) {
    return { variables: { BLOB_STORE_ID: almacen, VERCEL_OIDC_TOKEN: oidc }, modo: "oidc" };
  }
  const token = variables.get("BLOB_READ_WRITE_TOKEN")?.trim();
  if (token) return { variables: { BLOB_READ_WRITE_TOKEN: token }, modo: "token" };
  return null;
}

export type BoletaEnUso = { hogarId: string; nombre: string };

/**
 * Las boletas que algun gasto o cuenta usa, una vez cada una, ordenadas. Las
 * que estan en la carpeta pero nadie usa no se suben: no se pueden ver desde
 * Luka.
 */
export function boletasEnUso(datos: Pick<Datos, "gasto" | "cuenta">): BoletaEnUso[] {
  const vistas = new Map<string, BoletaEnUso>();
  for (const fila of [...datos.gasto, ...datos.cuenta]) {
    if (typeof fila.boletaArchivo !== "string") continue;
    const boleta = { hogarId: String(fila.hogarId), nombre: fila.boletaArchivo };
    vistas.set(`${boleta.hogarId}/${boleta.nombre}`, boleta);
  }
  return [...vistas.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, b]) => b);
}
