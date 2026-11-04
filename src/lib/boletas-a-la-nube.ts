import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { BoletaEnUso } from "@/dominio/subir-a-la-nube";
import { almacenEnBlob, rutaEnBlob, type SdkDeBlob } from "./almacen-boletas";
import { carpetaDelHogar, nombreValido, rutaDeBoleta, tipoDeBoleta } from "./boletas";

/**
 * Subir las boletas de tu Mac al Vercel Blob privado (npm run nube:subir).
 * Quedan donde Luka las busca en la nube: boletas/<hogar>/<nombre>, con el
 * mismo nombre que tienen en tu Mac y en los gastos.
 *
 * Nunca se pisa una boleta que ya esta en la nube: repetir la subida solo
 * sube las que faltan.
 */

/** Una boleta de tu Mac, con donde esta y cuanto pesa. */
export type BoletaLocal = BoletaEnUso & { ruta: string; bytes: number };

export type PlanDeBoletas = {
  /** Estan en tu Mac y faltan en la nube. */
  subir: BoletaLocal[];
  /** Ya estan en la nube, con el mismo tamano. */
  yaEstan: BoletaLocal[];
  /** En la nube hay otra con ese nombre y otro tamano: no se toca, se avisa. */
  distintas: BoletaLocal[];
  /** Algun gasto o cuenta la usa, pero no esta en tu Mac. */
  faltanEnDisco: BoletaEnUso[];
};

/** Lo que hay en el Blob bajo boletas/: ruta → tamano en bytes. */
export async function boletasEnElBlob(sdk: Pick<SdkDeBlob, "list">): Promise<Map<string, number>> {
  const enBlob = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const pagina = await sdk.list({ prefix: "boletas/", cursor, limit: 1000 });
    for (const blob of pagina.blobs) enBlob.set(blob.pathname, blob.size);
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor !== undefined);
  return enBlob;
}

/**
 * Donde esta una boleta en tu Mac: en la carpeta de su hogar o, si es de
 * antes de los hogares y todavia no se ordeno, suelta en la carpeta de
 * boletas. null si no esta.
 */
async function buscarEnDisco(boleta: BoletaEnUso, raiz: string): Promise<{ ruta: string; bytes: number } | null> {
  if (!nombreValido(boleta.nombre)) return null;
  const candidatas = [rutaDeBoleta(boleta.nombre, carpetaDelHogar(boleta.hogarId, raiz)), join(raiz, boleta.nombre)];
  for (const ruta of candidatas) {
    try {
      const info = await stat(ruta);
      if (info.isFile()) return { ruta, bytes: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/** Que hacer con cada boleta en uso, comparando tu Mac con la nube. */
export async function planDeBoletas(
  enUso: BoletaEnUso[],
  raiz: string,
  enBlob: Map<string, number>,
): Promise<PlanDeBoletas> {
  const plan: PlanDeBoletas = { subir: [], yaEstan: [], distintas: [], faltanEnDisco: [] };
  for (const boleta of enUso) {
    const local = await buscarEnDisco(boleta, raiz);
    if (local === null) {
      plan.faltanEnDisco.push(boleta);
      continue;
    }
    const conRuta = { ...boleta, ...local };
    const enLaNube = enBlob.get(rutaEnBlob(boleta.hogarId, boleta.nombre));
    if (enLaNube === undefined) plan.subir.push(conRuta);
    else if (enLaNube === local.bytes) plan.yaEstan.push(conRuta);
    else plan.distintas.push(conRuta);
  }
  return plan;
}

/**
 * Sube las boletas del plan, una por una, por el mismo camino que usa Luka
 * al guardar una (privadas, sin pisar). Devuelve cuantas subio.
 */
export async function subirBoletas(
  boletas: BoletaLocal[],
  sdk: SdkDeBlob,
  alSubir: (boleta: BoletaLocal, numero: number) => void = () => {},
): Promise<number> {
  const almacen = almacenEnBlob(sdk);
  let subidas = 0;
  for (const boleta of boletas) {
    const bytes = new Uint8Array(await readFile(boleta.ruta));
    await almacen.escribir(boleta.hogarId, boleta.nombre, bytes, tipoDeBoleta(boleta.nombre));
    subidas += 1;
    alSubir(boleta, subidas);
  }
  return subidas;
}

/**
 * Las boletas de tu Mac que no quedaron en la nube con el mismo tamano.
 * Vacia = estan todas.
 */
export function boletasQueNoCalzan(locales: BoletaLocal[], enBlob: Map<string, number>): BoletaLocal[] {
  return locales.filter((b) => enBlob.get(rutaEnBlob(b.hogarId, b.nombre)) !== b.bytes);
}
