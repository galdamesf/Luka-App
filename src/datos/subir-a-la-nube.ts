import { isDeepStrictEqual } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { TABLAS, ordenarFilas, type Datos, type Fila, type Tabla } from "@/dominio/subir-a-la-nube";

/**
 * Leer una base completa y copiarla sobre otra (npm run nube:subir). Las
 * reglas (orden de las tablas, que se perderia) estan en
 * src/dominio/subir-a-la-nube.ts.
 */

/** Lo que se usa de Prisma: la misma API sirve para tu Mac y para la nube. */
type Base = Pick<PrismaClient, "$queryRaw" | "$transaction" | Tabla | "codigoDeBorrado">;

/** Lo comun a todas las tablas. Prisma tipa cada una aparte; aqui da igual cual. */
type Delegado = {
  findMany(): Promise<Fila[]>;
  createMany(argumentos: { data: Fila[] }): Promise<{ count: number }>;
  deleteMany(): Promise<{ count: number }>;
};

function delegado(db: unknown, tabla: Tabla): Delegado {
  return (db as Record<Tabla, Delegado>)[tabla];
}

/**
 * Las migraciones que una base tiene aplicadas y terminadas, por nombre. Si la
 * tabla de Prisma no existe (una base vacia), ninguna.
 */
export async function migracionesAplicadas(db: Pick<PrismaClient, "$queryRaw">): Promise<string[]> {
  const [tabla] = await db.$queryRaw<{ existe: boolean }[]>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS existe
  `;
  if (tabla?.existe !== true) return [];
  const filas = await db.$queryRaw<{ nombre: string }[]>`
    SELECT migration_name AS nombre FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  return filas.map((f) => f.nombre).sort();
}

/** Todas las filas de todas las tablas que se copian, ordenadas por su llave. */
export async function leerTodo(db: Base): Promise<Datos> {
  const datos = {} as Datos;
  for (const tabla of TABLAS) {
    datos[tabla] = ordenarFilas(tabla, await delegado(db, tabla).findMany());
  }
  return datos;
}

export type OpcionesDeCopia = {
  /** Filas por INSERT. Postgres acepta hasta 65.535 valores por consulta. */
  lote?: number;
  /** Cuanto puede durar la copia entera antes de deshacerse. */
  tiempoMaximoMs?: number;
};

/**
 * Reemplaza todo lo de `destino` por `datos` (lo que se leyo de tu Mac), en
 * una sola transaccion: o queda todo copiado, o la nube queda exactamente
 * como estaba. Conserva los ids y las fechas, asi que las boletas, los
 * enlaces y los historiales siguen apuntando a lo mismo.
 */
export async function copiarDatos(
  datos: Datos,
  destino: Pick<PrismaClient, "$transaction">,
  { lote = 500, tiempoMaximoMs = 180_000 }: OpcionesDeCopia = {},
): Promise<void> {
  await destino.$transaction(
    async (tx) => {
      // Primero se vacia, de las que apuntan a las apuntadas.
      await tx.codigoDeBorrado.deleteMany();
      for (const tabla of [...TABLAS].reverse()) {
        await delegado(tx, tabla).deleteMany();
      }
      // Despues se llena, de las apuntadas a las que apuntan.
      for (const tabla of TABLAS) {
        const filas = datos[tabla];
        for (let i = 0; i < filas.length; i += lote) {
          await delegado(tx, tabla).createMany({ data: filas.slice(i, i + lote) });
        }
      }
    },
    { maxWait: 30_000, timeout: tiempoMaximoMs },
  );
}

/**
 * Las tablas en que `destino` no tiene exactamente las mismas filas que
 * `datos`, columna por columna. Vacia = la copia salio identica.
 */
export async function tablasDistintas(datos: Datos, destino: Base): Promise<Tabla[]> {
  const copiados = await leerTodo(destino);
  return TABLAS.filter((tabla) => !isDeepStrictEqual(datos[tabla], copiados[tabla]));
}
