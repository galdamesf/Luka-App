import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ALFABETO_DE_RESPALDO, DOS_PASOS } from "@/dominio/dos-pasos";

/**
 * La criptografia de la verificacion en dos pasos, con node:crypto y nada mas:
 *
 * - TOTP (RFC 6238, el de Google Authenticator): HMAC-SHA1 de la hora en
 *   pasos de 30 segundos, 6 digitos.
 * - Base32 (RFC 4648) para la clave que se escanea o se escribe a mano.
 * - La clave de cada persona se guarda cifrada (AES-256-GCM), atada a su
 *   miembro: copiarla a otra fila no sirve.
 * - Los codigos de respaldo se guardan como huella (HMAC-SHA256), nunca el
 *   codigo.
 *
 * Todo con una sola variable de entorno, CLAVE_DOS_PASOS (32 bytes en base64:
 * `openssl rand -base64 32`). De ella salen, por separado, la llave de
 * cifrado y la de las huellas. Sin ella no entra nadie: la puerta queda
 * cerrada, no abierta.
 */

/* ---------------------------------------------------------------------------
   Base32 (RFC 4648), sin relleno "=": asi la escriben las apps
   --------------------------------------------------------------------------- */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function aBase32(bytes: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const byte of bytes) {
    // Solo importan los ultimos bits pendientes: se recorta para no desbordar.
    valor = ((valor << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      salida += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

export function deBase32(texto: string): Uint8Array {
  const limpio = texto.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let valor = 0;
  const salida: number[] = [];
  for (const letra of limpio) {
    const indice = BASE32.indexOf(letra);
    if (indice === -1) throw new Error("La clave no es base32.");
    valor = ((valor << 5) | indice) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(salida);
}

/* ---------------------------------------------------------------------------
   TOTP (RFC 6238)
   --------------------------------------------------------------------------- */

/** 20 bytes (160 bits), el largo que recomienda el RFC para HMAC-SHA1. */
export function nuevaClaveDeApp(): Uint8Array {
  return new Uint8Array(randomBytes(20));
}

/** El paso de 30 segundos en que cae un instante. */
export function pasoDe(ahora: Date): number {
  return Math.floor(ahora.getTime() / 1000 / DOS_PASOS.segundosPorPaso);
}

/** El codigo de la app para un paso: HOTP (RFC 4226) con el paso como contador. */
export function codigoDeApp(clave: Uint8Array, paso: number, digitos: number = DOS_PASOS.digitos): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac("sha1", clave).update(contador).digest();
  // Truncado dinamico (RFC 4226, seccion 5.3): 4 bytes desde el desplazamiento
  // que dice el ultimo, sin el bit de signo.
  const desplazamiento = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const numero = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(numero % 10 ** digitos).padStart(digitos, "0");
}

function mismoTexto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Si un codigo de la app vale ahora. Se aceptan el paso actual y uno antes y
 * uno despues (DOS_PASOS.tolerancia), pero nunca uno igual o anterior al
 * ultimo que ya se uso: el mismo codigo no sirve dos veces.
 *
 * Devuelve el paso que calzo, para guardarlo como el ultimo usado.
 */
export function revisarCodigoDeApp(
  clave: Uint8Array,
  codigo: string,
  ahora: Date,
  ultimoPaso: number | null,
): { ok: true; paso: number } | { ok: false } {
  const actual = pasoDe(ahora);
  let calzo: number | null = null;
  // Se revisan todos, sin cortar al primero: tarda lo mismo calce o no.
  for (let paso = actual - DOS_PASOS.tolerancia; paso <= actual + DOS_PASOS.tolerancia; paso++) {
    if (ultimoPaso !== null && paso <= ultimoPaso) continue;
    if (mismoTexto(codigoDeApp(clave, paso), codigo) && calzo === null) calzo = paso;
  }
  return calzo === null ? { ok: false } : { ok: true, paso: calzo };
}

/* ---------------------------------------------------------------------------
   CLAVE_DOS_PASOS y lo que sale de ella
   --------------------------------------------------------------------------- */

export class FaltaClaveDosPasos extends Error {
  constructor() {
    super("Falta CLAVE_DOS_PASOS (32 bytes en base64: openssl rand -base64 32).");
  }
}

/**
 * La clave maestra, de CLAVE_DOS_PASOS. Lanza si falta o es corta: sin ella
 * no se puede ni guardar ni revisar nada, y nadie entra.
 */
export function claveMaestra(entorno: Record<string, string | undefined> = process.env): Buffer {
  const texto = entorno.CLAVE_DOS_PASOS?.trim() ?? "";
  const clave = Buffer.from(texto, "base64");
  if (texto === "" || clave.length < 32) throw new FaltaClaveDosPasos();
  return clave;
}

/** Una llave para un solo uso, derivada de la maestra (HKDF-SHA256). */
function derivar(maestra: Buffer, para: string): Buffer {
  return Buffer.from(hkdfSync("sha256", maestra, Buffer.alloc(0), `luka-dos-pasos:${para}`, 32));
}

/* ---------------------------------------------------------------------------
   La clave de la app, cifrada
   --------------------------------------------------------------------------- */

const VERSION = "v1";

/**
 * Cifra la clave de la app de un miembro: v1.<iv>.<cifrado>.<etiqueta> en
 * base64url. El id del miembro va como dato asociado: descifrarla con otro
 * miembro falla.
 */
export function cifrarClaveDeApp(clave: Uint8Array, miembroId: string, maestra: Buffer): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", derivar(maestra, "cifrado"), iv);
  cifrador.setAAD(Buffer.from(miembroId));
  const cifrado = Buffer.concat([cifrador.update(clave), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return [VERSION, iv, cifrado, etiqueta].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Lo contrario de cifrarClaveDeApp. Lanza si se toco, si es de otro miembro o con otra maestra. */
export function descifrarClaveDeApp(texto: string, miembroId: string, maestra: Buffer): Uint8Array {
  const [version, iv, cifrado, etiqueta, ...sobra] = texto.split(".");
  if (version !== VERSION || !iv || !cifrado || !etiqueta || sobra.length > 0) {
    throw new Error("La clave guardada no tiene el formato esperado.");
  }
  const descifrador = createDecipheriv("aes-256-gcm", derivar(maestra, "cifrado"), Buffer.from(iv, "base64url"));
  descifrador.setAAD(Buffer.from(miembroId));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return new Uint8Array(Buffer.concat([descifrador.update(Buffer.from(cifrado, "base64url")), descifrador.final()]));
}

/* ---------------------------------------------------------------------------
   Codigos de respaldo
   --------------------------------------------------------------------------- */

/** Los codigos de respaldo nuevos, ya limpios (sin guion). */
export function nuevosCodigosDeRespaldo(cuantos: number = DOS_PASOS.codigosDeRespaldo): string[] {
  const codigos = new Set<string>();
  while (codigos.size < cuantos) {
    let codigo = "";
    for (let i = 0; i < DOS_PASOS.largoDeRespaldo; i++) codigo += ALFABETO_DE_RESPALDO[randomInt(ALFABETO_DE_RESPALDO.length)];
    codigos.add(codigo);
  }
  return [...codigos];
}

/**
 * La huella de un codigo de respaldo (HMAC-SHA256 en hexadecimal), atada al
 * miembro. Es lo unico que se guarda: con la base sola no se puede probar
 * codigos por fuerza bruta, porque falta la llave.
 */
export function huellaDeRespaldo(codigoLimpio: string, miembroId: string, maestra: Buffer): string {
  return createHmac("sha256", derivar(maestra, "respaldo")).update(`${miembroId}:${codigoLimpio}`).digest("hex");
}
