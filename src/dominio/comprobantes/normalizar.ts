import type { Adjunto, Comprobante } from "./tipos";
import { leerFecha } from "./valores";

/**
 * Antes de leer un comprobante hay que dejarlo parejo: los bancos mandan HTML
 * hecho de tablas (a veces metido dentro de la parte de texto, como
 * BancoEstado), con entidades, espacios duros y caracteres invisibles. Y si la
 * persona lo reenvio a mano, el correo del banco viene adentro del suyo.
 */

const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  ordm: "º", ordf: "ª", deg: "°", iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»",
  euro: "€", middot: "·", bull: "•", hellip: "…", ndash: "–", mdash: "—",
  copy: "©", reg: "®", trade: "™", shy: "",
};

/** "&oacute;" -> "ó", "&#36;" -> "$". Lo que no conoce lo deja como esta. */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (todo, nombre: string) => {
    if (nombre.startsWith("#")) {
      const hexadecimal = nombre[1] === "x" || nombre[1] === "X";
      const codigo = Number.parseInt(nombre.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : todo;
    }
    return ENTIDADES[nombre] ?? ENTIDADES[nombre.toLowerCase()] ?? todo;
  });
}

const BLOQUES = "p|div|tr|li|ul|ol|h[1-6]|table|thead|tbody|tfoot|section|article|header|footer|blockquote|center";

/**
 * HTML a texto, una cosa por linea. Cada celda de una tabla queda en su linea,
 * que es como se leen los comprobantes: "Monto transferido" y abajo "$ 300.000".
 */
export function htmlATexto(html: string): string {
  const sinEtiquetas = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(head|style|script|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(new RegExp(`</?(?:${BLOQUES})\\b[^>]*>`, "gi"), "\n")
    .replace(/<\/(?:td|th)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return limpiarEspacios(decodificarEntidades(sinEtiquetas));
}

const PARECE_HTML = /<\/?(?:html|body|table|tbody|tr|td|th|div|p|br|span|strong|b|font|center|img|a)\b[^>]*>/i;

function limpiarEspacios(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍⁠﻿­]/g, "")
    .split("\n")
    .map((linea) => linea.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto parejo, en lineas: sin HTML aunque venga en la parte de texto. */
export function normalizarTexto(texto: string): string {
  return PARECE_HTML.test(texto) ? htmlATexto(texto) : limpiarEspacios(decodificarEntidades(texto));
}

/**
 * Todo en una sola linea, sin los adornos que dejan las conversiones de HTML
 * (los | de las tablas, los * de las negritas, los # de los titulos). Es sobre
 * esto que buscan las plantillas, asi da lo mismo como venia armada la tabla.
 * Las mascaras de tres o mas asteriscos (************0583) se quedan.
 */
export function aplanar(texto: string): string {
  return texto
    .replace(/\|/g, " ")
    .replace(/(?<!\*)\*{1,2}(?!\*)/g, " ")
    .replace(/(^|\s)#{1,6}(?=\s)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Banco Santander <mensajeria@santander.cl>" -> "mensajeria@santander.cl" */
export function direccionDe(texto: string): string {
  const direccion = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(texto)?.[0];
  return (direccion ?? texto).trim().toLowerCase();
}

/** Saca los "RV:", "Fwd:", "RE:" del comienzo del asunto. */
export function limpiarAsunto(asunto: string): string {
  return aplanar(asunto.replace(/^(?:\s*(?:re|rv|fw|fwd|tr|reenv|res)\s*:\s*)+/i, ""));
}

export type Reenvio = {
  remitente?: string;
  asunto?: string;
  /** La fecha del correo original, AAAA-MM-DD, si se pudo leer. */
  fecha?: string;
  /** El correo original, sin la nota de quien lo reenvio. */
  cuerpo: string;
};

const MARCA_DE_REENVIO =
  /^(?:-{2,}\s*(?:forwarded message|mensaje reenviado|mensaje original|original message)\s*-{2,}|_{10,}|(?:begin forwarded message|inicio del mensaje reenviado|comienza el mensaje reenviado)\s*:?)$/i;
const ENCABEZADO = /^(de|from|enviado|sent|fecha|date|para|to|cc|cco|bcc|asunto|subject)\s*:\s*(.*)$/i;

/**
 * Si el texto trae un correo reenviado a mano (Gmail, Outlook, Apple Mail, en
 * espanol o en ingles), devuelve el original. Si no, null.
 */
export function desenvolverReenvio(texto: string): Reenvio | null {
  const lineas = texto.split("\n");

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!.replace(/\*/g, "").trim();
    const conMarca = MARCA_DE_REENVIO.test(linea);
    if (!conMarca && !/^(?:de|from)\s*:\s*\S/i.test(linea)) continue;

    // Los encabezados del original: De, Fecha, Asunto, Para, uno por linea.
    const encabezados = new Map<string, string>();
    let j = conMarca ? i + 1 : i;
    while (j < lineas.length && lineas[j]!.trim() === "") j++;
    const de = () => encabezados.get("de") ?? encabezados.get("from");
    const asunto = () => encabezados.get("asunto") ?? encabezados.get("subject");
    for (; j < lineas.length; j++) {
      const actual = lineas[j]!.replace(/\*/g, "").trim();
      // Outlook deja lineas en blanco entre encabezados; se saltan mientras
      // falte el De o el Asunto. Con los dos, una linea en blanco cierra.
      if (actual === "") {
        if (de() !== undefined && asunto() !== undefined) break;
        continue;
      }
      const encabezado = ENCABEZADO.exec(actual);
      if (!encabezado) break;
      encabezados.set(encabezado[1]!.toLowerCase(), encabezado[2]!.trim());
    }

    const remitente = de();
    const asuntoOriginal = asunto();
    // Sin De (con su direccion) y Asunto no es un reenvio: un comprobante puede
    // traer sus propias lineas "De: Juan Perez".
    if (remitente === undefined || !remitente.includes("@") || asuntoOriginal === undefined) continue;

    const fecha =
      encabezados.get("fecha") ?? encabezados.get("date") ?? encabezados.get("enviado") ?? encabezados.get("sent");
    const fechaLeida = fecha === undefined ? null : leerFecha(fecha);

    return {
      remitente: direccionDe(remitente),
      asunto: asuntoOriginal,
      ...(fechaLeida ? { fecha: fechaLeida } : {}),
      cuerpo: lineas.slice(j).join("\n").trim(),
    };
  }
  return null;
}

export type AdjuntoNormalizado = Adjunto & { texto: string; plano: string };

export type ComprobanteNormalizado = {
  remitente: string;
  reenviadoPor: string;
  asunto: string;
  recibido: Date;
  /** La fecha del correo original si venia reenviado a mano y se pudo leer. */
  fechaOriginal?: string;
  /** En lineas, sin HTML: lo que lee la IA (despues de la limpieza). */
  texto: string;
  /** En una linea: sobre lo que buscan las plantillas. */
  plano: string;
  adjuntos: AdjuntoNormalizado[];
  reenviadoAMano: boolean;
};

/**
 * Algunos programas reenvian citando cada linea con "> ". Si la mayoria de las
 * lineas viene citada, se saca un nivel de citas.
 */
export function sinCitas(texto: string): string {
  const lineas = texto.split("\n");
  const conTexto = lineas.filter((linea) => linea.trim() !== "");
  const citadas = conTexto.filter((linea) => linea.startsWith(">"));
  if (conTexto.length === 0 || citadas.length / conTexto.length < 0.6) return texto;
  return lineas.map((linea) => linea.replace(/^>[ \t]?/, "")).join("\n");
}

/** Deja el comprobante listo para las plantillas y la IA. */
export function normalizarComprobante(comprobante: Comprobante): ComprobanteNormalizado {
  let remitente = direccionDe(comprobante.remitente);
  let asunto = limpiarAsunto(comprobante.asunto);
  let texto = sinCitas(normalizarTexto(comprobante.texto));
  let fechaOriginal: string | undefined;
  let reenviadoAMano = false;

  // Un reenvio de un reenvio trae dos capas; mas de tres no tiene sentido.
  for (let capa = 0; capa < 3; capa++) {
    const reenvio = desenvolverReenvio(texto);
    if (!reenvio) break;
    reenviadoAMano = true;
    if (reenvio.remitente) remitente = reenvio.remitente;
    if (reenvio.asunto) asunto = limpiarAsunto(reenvio.asunto);
    if (reenvio.fecha) fechaOriginal = reenvio.fecha;
    texto = sinCitas(reenvio.cuerpo);
  }

  const adjuntos = (comprobante.adjuntos ?? []).map((adjunto) => {
    const textoAdjunto = normalizarTexto(adjunto.texto ?? "");
    return { ...adjunto, texto: textoAdjunto, plano: aplanar(textoAdjunto) };
  });

  return {
    remitente,
    reenviadoPor: direccionDe(comprobante.reenviadoPor),
    asunto,
    recibido: comprobante.recibido,
    ...(fechaOriginal ? { fechaOriginal } : {}),
    texto,
    plano: aplanar(texto),
    adjuntos,
    reenviadoAMano,
  };
}
