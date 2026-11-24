import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * La clave del PDF de la cartola, cifrada. Santander cifra la cartola con el
 * RUT de la persona: es un dato personal y no se guarda tal cual.
 *
 * AES-256-GCM con una llave que sale de CLAVE_DOS_PASOS (la misma maestra de
 * la verificacion en dos pasos, con otro uso), y la persona y el banco como
 * dato asociado: la clave de una persona no abre como la de otra, ni la de
 * un banco como la de otro.
 */

const VERSION = "v1";

function llave(maestra: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", maestra, Buffer.alloc(0), "luka-cartolas:clave-del-pdf", 32));
}

function asociado(miembroId: string, banco: string): Buffer {
  return Buffer.from(`${miembroId}|${banco}`);
}

/** v1.<iv>.<cifrado>.<etiqueta>, en base64url. */
export function cifrarClaveDeCartola(clave: string, miembroId: string, banco: string, maestra: Buffer): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", llave(maestra), iv);
  cifrador.setAAD(asociado(miembroId, banco));
  const cifrado = Buffer.concat([cifrador.update(clave, "utf8"), cifrador.final()]);
  return [VERSION, iv, cifrado, cifrador.getAuthTag()].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Lo contrario de cifrarClaveDeCartola. Lanza si se toco, si es de otra persona, de otro banco o con otra maestra. */
export function descifrarClaveDeCartola(texto: string, miembroId: string, banco: string, maestra: Buffer): string {
  const [version, iv, cifrado, etiqueta, ...sobra] = texto.split(".");
  if (version !== VERSION || !iv || !cifrado || !etiqueta || sobra.length > 0) {
    throw new Error("La clave guardada no tiene el formato esperado.");
  }
  const descifrador = createDecipheriv("aes-256-gcm", llave(maestra), Buffer.from(iv, "base64url"));
  descifrador.setAAD(asociado(miembroId, banco));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([descifrador.update(Buffer.from(cifrado, "base64url")), descifrador.final()]).toString("utf8");
}
