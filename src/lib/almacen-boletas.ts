import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as sdkDeBlob from "@vercel/blob";
import {
  carpetaDeBoletas,
  carpetaDelHogar,
  exigirHogarValido,
  nombreValido,
  rutaDeBoleta,
  validarBoleta,
  type ArchivoSubido,
  type ResultadoGuardado,
} from "./boletas";

/**
 * Donde viven las fotos de las boletas: en el disco (en tu Mac) o en un
 * Vercel Blob privado (en la nube). El resto de Luka no sabe cual: guarda,
 * lee y borra siempre las de un hogar, el de quien mira.
 *
 * En los dos, la boleta queda en «boletas/<hogar>/<nombre>», con el nombre que
 * genera el servidor (src/lib/boletas.ts). En Blob el almacen es privado: no
 * hay enlaces publicos, y cada boleta se lee desde el servidor despues de
 * revisar el hogar (src/app/boletas/[archivo]/route.ts).
 */
export type AlmacenDeBoletas = {
  readonly tipo: "disco" | "blob";
  escribir(hogarId: string, nombre: string, bytes: Uint8Array, tipoMime: string): Promise<void>;
  /** null si no existe. Una boleta de otro hogar tampoco existe aqui. */
  leer(hogarId: string, nombre: string): Promise<Uint8Array | null>;
  /** Borra todas las boletas del hogar. */
  borrarDelHogar(hogarId: string): Promise<void>;
};

function exigirNombre(nombre: string): string {
  if (!nombreValido(nombre)) throw new Error(`Nombre de boleta no valido: "${nombre}".`);
  return nombre;
}

/** Las boletas en el disco, en boletas/<hogar>/ (o en la carpeta que se diga). */
export function almacenEnDisco(raiz: string = carpetaDeBoletas()): AlmacenDeBoletas {
  return {
    tipo: "disco",
    async escribir(hogarId, nombre, bytes) {
      const carpeta = carpetaDelHogar(hogarId, raiz);
      await mkdir(carpeta, { recursive: true });
      // "wx": nunca se pisa una boleta que ya existe.
      await writeFile(rutaDeBoleta(nombre, carpeta), bytes, { flag: "wx" });
    },
    async leer(hogarId, nombre) {
      try {
        return new Uint8Array(await readFile(rutaDeBoleta(nombre, carpetaDelHogar(hogarId, raiz))));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async borrarDelHogar(hogarId) {
      await rm(carpetaDelHogar(hogarId, raiz), { recursive: true, force: true });
    },
  };
}

/** Lo que se usa del SDK de Vercel Blob. Los tests le pasan uno en memoria. */
export type SdkDeBlob = Pick<typeof sdkDeBlob, "put" | "get" | "list" | "del">;

/** La ruta de una boleta dentro del Blob: boletas/<hogar>/<nombre>. */
export function rutaEnBlob(hogarId: string, nombre: string): string {
  return `boletas/${exigirHogarValido(hogarId)}/${exigirNombre(nombre)}`;
}

/**
 * Las boletas en un Vercel Blob privado. Las credenciales las pone Vercel al
 * conectar el Blob al proyecto (BLOB_READ_WRITE_TOKEN, o BLOB_STORE_ID con
 * OIDC); el SDK las lee solo.
 */
export function almacenEnBlob(sdk: SdkDeBlob = sdkDeBlob): AlmacenDeBoletas {
  return {
    tipo: "blob",
    async escribir(hogarId, nombre, bytes, tipoMime) {
      await sdk.put(rutaEnBlob(hogarId, nombre), Buffer.from(bytes), {
        access: "private",
        contentType: tipoMime,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
    },
    async leer(hogarId, nombre) {
      const respuesta = await sdk.get(rutaEnBlob(hogarId, nombre), { access: "private" });
      if (respuesta === null || respuesta.statusCode !== 200) return null;
      return new Uint8Array(await new Response(respuesta.stream).arrayBuffer());
    },
    async borrarDelHogar(hogarId) {
      // Primero se junta la lista completa y despues se borra: borrar
      // mientras se recorre la lista puede correrla y dejar boletas atras.
      const prefix = `boletas/${exigirHogarValido(hogarId)}/`;
      const rutas: string[] = [];
      let cursor: string | undefined;
      do {
        const pagina = await sdk.list({ prefix, cursor, limit: 1000 });
        rutas.push(...pagina.blobs.map((b) => b.pathname));
        cursor = pagina.hasMore ? pagina.cursor : undefined;
      } while (cursor !== undefined);
      for (let i = 0; i < rutas.length; i += 1000) await sdk.del(rutas.slice(i, i + 1000));
    },
  };
}

/**
 * El almacen que corresponde: Blob si el proyecto tiene un Blob conectado; si
 * no, el disco. En Vercel no hay disco que dure, asi que ahi un Blob es
 * obligatorio: sin el, falla con un mensaje claro en vez de perder boletas.
 */
export function almacenDelEntorno(entorno: Record<string, string | undefined> = process.env): AlmacenDeBoletas {
  const hayBlob = Boolean(entorno.BLOB_READ_WRITE_TOKEN?.trim() || entorno.BLOB_STORE_ID?.trim());
  if (hayBlob) return almacenEnBlob();
  if (entorno.VERCEL === "1") {
    throw new Error("En Vercel las boletas van a un Vercel Blob privado: conecta uno al proyecto (Storage → Blob).");
  }
  return almacenEnDisco(entorno.CARPETA_BOLETAS?.trim() || carpetaDeBoletas());
}

/**
 * Valida una boleta subida y la guarda en el almacen, en el hogar de quien la
 * sube. Si el almacen falla (sin red, Blob caido), lo dice en vez de reventar.
 */
export async function guardarBoletaDelHogar(
  archivo: ArchivoSubido,
  hogarId: string,
  almacen: AlmacenDeBoletas = almacenDelEntorno(),
): Promise<ResultadoGuardado> {
  const valida = await validarBoleta(archivo);
  if (!valida.ok) return valida;
  try {
    await almacen.escribir(hogarId, valida.nombre, valida.bytes, valida.tipo);
  } catch (error) {
    console.error(`No se pudo guardar la boleta en el almacen (${almacen.tipo}):`, error);
    return { ok: false, motivo: "No se pudo guardar el archivo. Intenta de nuevo." };
  }
  return { ok: true, archivo: valida.nombre, bytes: valida.bytes.length };
}
