import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Los codigos que llegan al correo (el de borrar un hogar y el que confirma
 * un correo registrado) y la clave de cada buzon.
 *
 * El codigo sale de un generador criptografico, no de Math.random: no se
 * puede adivinar el siguiente. En la base se guarda solo su huella, un HMAC
 * con AUTH_SECRET: quien lea la base no tiene el codigo, y sin el secreto no
 * puede probar los millon de codigos posibles contra la huella.
 */

/** Seis digitos al azar, con ceros a la izquierda si tocan: "004217". */
export function codigoAlAzar(digitos = 6): string {
  return randomInt(0, 10 ** digitos).toString().padStart(digitos, "0");
}

/**
 * La huella de un codigo, atada a su hogar y a su proposito: el mismo codigo
 * en otro hogar, o para otra cosa, deja otra huella.
 */
export function huellaDelCodigo(codigo: string, hogarId: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`borrar-hogar:${hogarId}:${codigo}`).digest("hex");
}

/**
 * La huella del codigo que confirma un correo registrado, atada a ese
 * registro: el mismo codigo para otro correo deja otra huella.
 */
export function huellaDelCodigoDeCorreo(codigo: string, correoId: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`confirmar-correo:${correoId}:${codigo}`).digest("hex");
}

/** Letras y numeros que no se confunden entre si (sin i, l, o, 0 ni 1). */
const ALFABETO_DE_CLAVES = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * La clave de un buzon: diez caracteres al azar de un generador
 * criptografico. Son unos 10^15 posibles: nadie le escribe a un buzon
 * adivinando su direccion.
 */
export function claveDeBuzonAlAzar(largo = 10): string {
  let clave = "";
  for (let i = 0; i < largo; i++) clave += ALFABETO_DE_CLAVES[randomInt(0, ALFABETO_DE_CLAVES.length)];
  return clave;
}

/** Compara dos huellas sin delatar, por lo que demora, cuanto se parecen. */
export function mismaHuella(una: string, otra: string): boolean {
  const a = Buffer.from(una, "hex");
  const b = Buffer.from(otra, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** El secreto de las huellas: el mismo AUTH_SECRET con que se firman las sesiones. */
export function secretoDeCodigos(entorno: Record<string, string | undefined> = process.env): string {
  const secreto = entorno.AUTH_SECRET?.trim();
  if (!secreto) throw new Error("Falta AUTH_SECRET en el .env: sin el no se pueden guardar codigos.");
  return secreto;
}
