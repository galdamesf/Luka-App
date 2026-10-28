import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

/**
 * Guardado de fotos de boletas en disco.
 *
 * Reglas de seguridad, que aca importan porque esto recibe archivos de afuera:
 *
 *  1. El nombre del archivo lo genera el servidor, siempre. El nombre que
 *     manda el navegador no se usa ni para derivarlo: un "../../.ssh/id_rsa"
 *     no tiene por donde entrar.
 *  2. Antes de guardar se miran los primeros bytes. El tipo declarado por el
 *     navegador se puede mentir; la firma del archivo no tanto.
 *  3. Al servir, el nombre pedido tiene que calzar con el patron exacto que
 *     generamos. Cualquier otra cosa se rechaza sin tocar el disco.
 */

export const TIPOS_PERMITIDOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
} as const;

export type TipoPermitido = keyof typeof TIPOS_PERMITIDOS;
export type Extension = (typeof TIPOS_PERMITIDOS)[TipoPermitido];

/** 10 MB: una foto de celular pesa 2 a 5. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** Lo que generamos: 32 caracteres hex y una extension conocida. */
const NOMBRE_VALIDO = /^[a-f0-9]{32}\.(jpg|png|webp|heic|pdf)$/;

/** Carpeta donde viven las boletas. Fuera de src para que no la escanee Next. */
export function carpetaDeBoletas(): string {
  return process.env.CARPETA_BOLETAS ?? join(process.cwd(), "boletas");
}

/** Firmas de archivo. Un tipo declarado se puede mentir; esto cuesta mas. */
const FIRMAS: Record<Extension, (b: Uint8Array) => boolean> = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  webp: (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  // En HEIC los bytes 4 a 7 son "ftyp" y despues viene la marca.
  heic: (b) => {
    if (!(b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)) return false;
    const marca = String.fromCharCode(...Array.from(b.slice(8, 12)));
    return ["heic", "heix", "hevc", "mif1", "msf1", "heim"].includes(marca);
  },
  pdf: (b) =>
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d,
};

export function firmaCorresponde(bytes: Uint8Array, extension: Extension): boolean {
  if (bytes.length < 12) return false;
  return FIRMAS[extension](bytes);
}

/** true si el nombre es uno que pudimos haber generado nosotros. */
export function nombreValido(nombre: string): boolean {
  // basename corta cualquier intento de ruta antes de comparar, por si acaso.
  return nombre === basename(nombre) && NOMBRE_VALIDO.test(nombre);
}

/**
 * Ruta en disco de una boleta. Lanza si el nombre no es uno nuestro o si la
 * ruta resultante se sale de la carpeta.
 */
export function rutaDeBoleta(nombre: string, carpeta = carpetaDeBoletas()): string {
  if (!nombreValido(nombre)) {
    throw new Error(`Nombre de boleta no valido: "${nombre}".`);
  }

  const base = resolve(carpeta);
  const completa = resolve(base, nombre);

  // Cinturon y tirantes: aunque el patron ya lo impide, se confirma que la
  // ruta final quedo dentro de la carpeta.
  if (completa !== join(base, nombre)) {
    throw new Error("La ruta de la boleta se sale de la carpeta.");
  }
  return completa;
}

export type ResultadoGuardado =
  | { ok: true; archivo: string; bytes: number }
  | { ok: false; motivo: string };

/**
 * Guarda un archivo subido y devuelve el nombre generado.
 * No confia en `archivo.name` ni en `archivo.type` para decidir donde escribir.
 */
export async function guardarBoleta(
  archivo: { arrayBuffer(): Promise<ArrayBuffer>; size: number; type: string },
  carpeta = carpetaDeBoletas(),
): Promise<ResultadoGuardado> {
  if (archivo.size === 0) {
    return { ok: false, motivo: "El archivo está vacío." };
  }
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = Math.round(TAMANO_MAXIMO / 1024 / 1024);
    return { ok: false, motivo: `La imagen no puede pesar más de ${mb} MB.` };
  }

  const extension = TIPOS_PERMITIDOS[archivo.type as TipoPermitido];
  if (extension === undefined) {
    return { ok: false, motivo: "Solo se aceptan imágenes JPG, PNG, WEBP, HEIC o un PDF." };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (!firmaCorresponde(bytes, extension)) {
    return { ok: false, motivo: "El archivo no parece ser del tipo que dice ser." };
  }

  const nombre = `${randomBytes(16).toString("hex")}.${extension}`;

  await mkdir(carpeta, { recursive: true });
  await writeFile(rutaDeBoleta(nombre, carpeta), bytes);

  return { ok: true, archivo: nombre, bytes: bytes.length };
}

export async function leerBoleta(
  nombre: string,
  carpeta = carpetaDeBoletas(),
): Promise<Uint8Array> {
  return new Uint8Array(await readFile(rutaDeBoleta(nombre, carpeta)));
}

/** Borra una boleta. Si ya no esta, no reclama. */
export async function eliminarBoleta(
  nombre: string,
  carpeta = carpetaDeBoletas(),
): Promise<void> {
  if (!nombreValido(nombre)) return;
  await rm(rutaDeBoleta(nombre, carpeta), { force: true });
}

/** Tipo MIME que corresponde servir para un nombre guardado. */
export function tipoDeBoleta(nombre: string): string {
  const extension = nombre.split(".").pop();
  for (const [mime, ext] of Object.entries(TIPOS_PERMITIDOS)) {
    if (ext === extension) return mime;
  }
  return "application/octet-stream";
}
