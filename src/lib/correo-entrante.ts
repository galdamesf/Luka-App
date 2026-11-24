import PostalMime, { type Address } from "postal-mime";
import { extractText } from "unpdf";
import type { Adjunto, Comprobante } from "@/dominio/comprobantes/tipos";
import { leerAutenticacion, type DatosDeLlegada } from "@/dominio/buzon";

/**
 * Abrir un correo tal como llega al buzon (RFC 5322 con sus partes MIME) y
 * convertirlo en lo que necesitan el buzon y el lector: los encabezados que
 * dicen para quien es y quien lo reenvio, el cuerpo y el texto de sus PDF.
 *
 * Luka nunca abre los enlaces ni ejecuta los adjuntos: de un PDF solo saca
 * su texto, y un PDF con clave queda sin texto (la cartola, que se lee en la
 * seccion D con su clave).
 */

export type AdjuntoEntrante = { nombre: string; tipo: string; contenido: Uint8Array };

export type CorreoEntrante = {
  /** El Message-ID, sin los < >. */
  idDelMensaje: string | null;
  /** La direccion del From, en minusculas. */
  de: string | null;
  asunto: string;
  fecha: Date | null;
  /** To y Cc, en minusculas. */
  destinatarios: string[];
  /** Delivered-To, X-Original-To y X-Forwarded-To: a donde se entrego. */
  entregadoA: string[];
  /** X-Forwarded-For (el primero) y Resent-From / Resent-Sender. */
  reenviadoPor: string[];
  /** El primer Authentication-Results: el del servidor que lo recibio al final. */
  autenticacion: string | null;
  html: string | null;
  texto: string | null;
  adjuntos: AdjuntoEntrante[];
};

const UN_CORREO = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/** Todas las direcciones que aparecen en un encabezado. */
function direccionesEn(valor: string): string[] {
  return [...valor.matchAll(UN_CORREO)].map((m) => m[0].toLowerCase());
}

function direccionesDe(lista: Address[] | undefined): string[] {
  return (lista ?? [])
    .flatMap((a) => (a.group ? a.group : [a]))
    .map((a) => a.address?.trim().toLowerCase() ?? "")
    .filter((a) => a.includes("@"));
}

function primeraDireccion(direccion: Address | undefined): string | null {
  return direccionesDe(direccion ? [direccion] : [])[0] ?? null;
}

function aBytes(contenido: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof contenido === "string") return new TextEncoder().encode(contenido);
  return contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);
}

/**
 * Abre el correo. Los message/rfc822 (un correo reenviado como archivo
 * adjunto) quedan como adjuntos: el buzon decide si es el original.
 */
export async function leerCorreo(fuente: Uint8Array | string): Promise<CorreoEntrante> {
  const correo = await PostalMime.parse(fuente, { forceRfc822Attachments: true });
  const valores = (clave: string) => correo.headers.filter((h) => h.key === clave).map((h) => h.value);

  const fecha = correo.date ? new Date(correo.date) : null;
  const reenviadoPorGmail = valores("x-forwarded-for").map((v) => direccionesEn(v)[0]).filter((d): d is string => d !== undefined);

  return {
    idDelMensaje: correo.messageId?.trim().replace(/^<|>$/g, "") || null,
    de: primeraDireccion(correo.from),
    asunto: (correo.subject ?? "").trim(),
    fecha: fecha !== null && !Number.isNaN(fecha.getTime()) ? fecha : null,
    destinatarios: [...direccionesDe(correo.to), ...direccionesDe(correo.cc)],
    entregadoA: ["delivered-to", "x-original-to", "x-forwarded-to"].flatMap((clave) => valores(clave).flatMap(direccionesEn)),
    reenviadoPor: [...reenviadoPorGmail, ...valores("resent-from").flatMap(direccionesEn), ...valores("resent-sender").flatMap(direccionesEn)],
    autenticacion: valores("authentication-results")[0] ?? null,
    html: correo.html?.trim() ? correo.html : null,
    texto: correo.text?.trim() ? correo.text : null,
    adjuntos: correo.attachments.map((adjunto) => ({
      nombre: adjunto.filename ?? "",
      tipo: adjunto.mimeType,
      contenido: aBytes(adjunto.content),
    })),
  };
}

/** Lo que el buzon mira para saber quien lo reenvio (src/dominio/buzon.ts). */
export function datosDeLlegada(correo: CorreoEntrante, esDelBuzon: (direccion: string) => boolean): DatosDeLlegada {
  return {
    de: correo.de,
    destinatarios: correo.destinatarios.filter((d) => !esDelBuzon(d)),
    rastros: [...correo.reenviadoPor, ...correo.entregadoA].filter((d) => !esDelBuzon(d)),
    autenticacion: correo.autenticacion === null ? null : leerAutenticacion(correo.autenticacion),
  };
}

const ES_PDF = (adjunto: { nombre: string; tipo: string }) => /pdf/i.test(adjunto.tipo) || /\.pdf$/i.test(adjunto.nombre);
const ES_CORREO = (adjunto: { nombre: string; tipo: string }) => /^message\/rfc822$/i.test(adjunto.tipo) || /\.eml$/i.test(adjunto.nombre);

/** Mas grande que esto, no es una boleta: no se lee. */
const PDF_MAXIMO = 8 * 1024 * 1024;

/**
 * El texto de un PDF, o undefined si no se puede: con clave, danado, muy
 * grande o sin texto (una foto escaneada).
 */
export async function textoDelPdf(contenido: Uint8Array): Promise<string | undefined> {
  if (contenido.byteLength === 0 || contenido.byteLength > PDF_MAXIMO) return undefined;
  try {
    // Una copia: pdf.js se queda con el buffer que recibe.
    const { text } = await extractText(new Uint8Array(contenido), { mergePages: true });
    return text.trim() === "" ? undefined : text;
  } catch {
    return undefined;
  }
}

/** El correo reenviado como archivo adjunto, si viene uno solo. */
export async function correoAdjunto(correo: CorreoEntrante): Promise<CorreoEntrante | null> {
  const adjuntos = correo.adjuntos.filter(ES_CORREO);
  if (adjuntos.length !== 1) return null;
  try {
    return await leerCorreo(adjuntos[0]!.contenido);
  } catch {
    return null;
  }
}

/**
 * El comprobante que lee el lector. Si es un correo reenviado como archivo,
 * el comprobante es el del adjunto. Los PDF van con su texto; las imagenes
 * y los correos adjuntos no van.
 */
export async function comprobanteDelCorreo(correo: CorreoEntrante, reenviadoPor: string, ahora = new Date()): Promise<Comprobante> {
  const adjuntos: Adjunto[] = [];
  for (const adjunto of correo.adjuntos) {
    if (ES_CORREO(adjunto) || /^image\//i.test(adjunto.tipo)) continue;
    const texto = ES_PDF(adjunto) ? await textoDelPdf(adjunto.contenido) : undefined;
    adjuntos.push({ nombre: adjunto.nombre, tipo: adjunto.tipo, ...(texto !== undefined ? { texto } : {}) });
  }
  return {
    remitente: correo.de ?? "",
    reenviadoPor,
    asunto: correo.asunto,
    recibido: correo.fecha ?? ahora,
    texto: correo.html ?? correo.texto ?? "",
    ...(adjuntos.length > 0 ? { adjuntos } : {}),
  };
}
