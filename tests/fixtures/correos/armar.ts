import MailComposer from "nodemailer/lib/mail-composer";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { cargarEjemplo } from "../comprobantes/cargar";

/**
 * Correos de prueba tal como llegan al buzon: armados con el mismo
 * compositor de MIME que usa Luka para mandar (nodemailer), con sus partes,
 * sus codificaciones y sus adjuntos de verdad. Encima van los encabezados que
 * agregan quien lo reenvia y quien lo recibe, como hacen los servidores.
 *
 * Todos los datos son inventados: los cuerpos salen de los ejemplos de la
 * Seccion A (tests/fixtures/comprobantes).
 */

export type Adjunto = { nombre: string; tipo: string; contenido: Buffer | Uint8Array | string };

export type OpcionesDeCorreo = {
  de: string;
  para?: string | string[];
  asunto: string;
  html?: string;
  texto?: string;
  idDelMensaje?: string;
  fecha?: Date;
  adjuntos?: readonly Adjunto[];
  /** Los encabezados que se agregan en el camino, de arriba hacia abajo: van encima de todo. */
  arriba?: readonly (readonly [string, string])[];
  /** Mas encabezados del correo mismo. */
  encabezados?: Record<string, string>;
  /** Como va el texto: por omision, lo que elija nodemailer. */
  codificacion?: "quoted-printable" | "base64";
};

export async function armarCorreo(o: OpcionesDeCorreo): Promise<Buffer> {
  const mensaje = await new MailComposer({
    from: o.de,
    to: o.para,
    subject: o.asunto,
    html: o.html,
    text: o.texto,
    messageId: o.idDelMensaje,
    date: o.fecha,
    headers: o.encabezados,
    textEncoding: o.codificacion,
    attachments: o.adjuntos?.map((a) => ({ filename: a.nombre, contentType: a.tipo, content: Buffer.from(a.contenido) })),
  })
    .compile()
    .build();
  const arriba = (o.arriba ?? []).map(([clave, valor]) => `${clave}: ${valor}\r\n`).join("");
  return Buffer.concat([Buffer.from(arriba, "utf8"), mensaje]);
}

/** Un PDF de verdad con ese texto, una linea por renglon (como la boleta de Lider). */
export async function pdfConTexto(texto: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const lineas = texto.split("\n");
  let pagina = pdf.addPage([420, 842]);
  let y = 810;
  for (const linea of lineas) {
    if (y < 30) {
      pagina = pdf.addPage([420, 842]);
      y = 810;
    }
    // La fuente estandar solo tiene Latin-1: lo demas no aparece en las boletas.
    const limpia = linea.replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
    if (limpia.trim() !== "") pagina.drawText(limpia, { x: 20, y, size: 9, font: fuente });
    y -= 12;
  }
  return Buffer.from(await pdf.save());
}

/**
 * Un ejemplo de la Seccion A como lo manda el banco o la tienda: el cuerpo en
 * HTML o en texto, y sus PDF de verdad con el texto del ejemplo.
 */
export async function correoDelEjemplo(ruta: string, o: Partial<OpcionesDeCorreo> = {}): Promise<Buffer> {
  const ejemplo = cargarEjemplo(ruta);
  const adjuntos: Adjunto[] = [];
  for (const adjunto of ejemplo.adjuntos ?? []) {
    adjuntos.push({
      nombre: adjunto.nombre,
      tipo: adjunto.tipo,
      contenido: adjunto.texto !== undefined && /pdf/i.test(adjunto.tipo) ? await pdfConTexto(adjunto.texto) : Buffer.from("%PDF-1.4 con clave"),
    });
  }
  const esHtml = /<\/?(?:html|body|table|div|p|br)\b/i.test(ejemplo.texto);
  return armarCorreo({
    de: ejemplo.remitente,
    para: "camila@ejemplo.cl",
    asunto: ejemplo.asunto,
    fecha: ejemplo.recibido,
    ...(esHtml ? { html: ejemplo.texto } : { texto: ejemplo.texto }),
    ...(adjuntos.length > 0 ? { adjuntos } : {}),
    ...o,
  });
}

/** Lo que pone Gmail arriba cuando el correo trae la firma de ese dominio. */
export function firmaDe(dominio: string): string {
  return [
    "mx.google.com",
    `       dkim=pass header.i=@${dominio} header.s=s2026 header.b=AbCdEf12`,
    `       spf=pass (google.com: domain of avisos@${dominio} designates 209.85.220.41 as permitted sender) smtp.mailfrom=avisos@${dominio}`,
    `       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=${dominio}`,
  ].join(";\r\n");
}

/** Lo que pone Gmail arriba cuando el correo dice ser de ese dominio pero no trae su firma. */
export function sinFirmaDe(dominio: string): string {
  return `mx.google.com; dkim=none; spf=softfail (google.com: domain of transitioning x@otro.example does not designate 203.0.113.9 as permitted sender) smtp.mailfrom=x@otro.example; dmarc=fail (p=NONE sp=NONE dis=NONE) header.from=${dominio}`;
}

/**
 * Los encabezados que deja un reenvio automatico de Gmail (un filtro con
 * «Reenviarlo a»): arriba lo de la llegada al buzon y abajo la bandeja por
 * donde paso.
 */
export function reenvioDeGmail(desde: string, hacia: string, dominioDelBanco: string): [string, string][] {
  return [
    ["Delivered-To", hacia],
    ["Authentication-Results", firmaDe(dominioDelBanco)],
    ["X-Forwarded-To", hacia],
    ["X-Forwarded-For", `${desde} ${hacia}`],
    ["Delivered-To", desde],
  ];
}
