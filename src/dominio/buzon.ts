/**
 * El buzon de Luka: para quien es un correo que llega, quien lo reenvio y si
 * se puede leer. Dominio puro: el MIME lo abre src/lib/correo-entrante.ts, el
 * IMAP src/lib/buzon.ts y lo que se guarda src/datos/buzon.ts.
 *
 * Cada persona tiene su direccion de Luka: el correo del buzon con su clave
 * (luka.support.app+k7q2m9xa4p@gmail.com). Lo que llega ahi es de esa
 * persona, pero se lee solo si lo reenvio uno de sus correos confirmados:
 *
 *   - Reenviado a mano: el correo viene de uno de sus correos, y el servidor
 *     del buzon tiene que decir que trae la firma de ese correo (DKIM o
 *     DMARC). Sin firma cualquiera podria escribir «De: tu correo».
 *   - Reenviado solo, con una regla: el correo sigue diciendo que es del
 *     banco, y lo que dice quien lo reenvio esta en los encabezados que
 *     agregan Gmail y Outlook, o en el destinatario original.
 *
 * Nada de lo que llega se confirma solo: todo queda «Por revisar».
 */

// ---------------------------------------------------------------------------
// La direccion
// ---------------------------------------------------------------------------

/** La clave va en la direccion: minusculas y numeros. */
export function esClaveDeBuzon(clave: string): boolean {
  return /^[a-z0-9]{8,20}$/.test(clave);
}

function partes(direccion: string): { local: string; dominio: string } | null {
  const limpia = direccion.trim().toLowerCase();
  const arroba = limpia.lastIndexOf("@");
  if (arroba <= 0 || arroba === limpia.length - 1) return null;
  return { local: limpia.slice(0, arroba), dominio: limpia.slice(arroba + 1) };
}

const DE_GOOGLE = new Set(["gmail.com", "googlemail.com"]);

/** En Gmail los puntos no cuentan y googlemail.com es gmail.com. */
function canonica({ local, dominio }: { local: string; dominio: string }): { local: string; dominio: string } {
  return DE_GOOGLE.has(dominio) ? { local: local.replace(/\./g, ""), dominio: "gmail.com" } : { local, dominio };
}

/** Si dos direcciones son la misma bandeja: sin mayusculas y, en Gmail, sin los puntos. */
export function mismaDireccion(a: string, b: string): boolean {
  const x = partes(a);
  const y = partes(b);
  if (x === null || y === null) return false;
  const cx = canonica(x);
  const cy = canonica(y);
  return cx.local === cy.local && cx.dominio === cy.dominio;
}

/** "luka.support.app@gmail.com" y "k7q2m9xa4p" -> "luka.support.app+k7q2m9xa4p@gmail.com". */
export function direccionDelBuzon(base: string, clave: string): string {
  const p = partes(base);
  if (p === null) throw new Error(`La direccion del buzon no es un correo: ${base}`);
  const sinEtiqueta = p.local.split("+")[0]!;
  return `${sinEtiqueta}+${clave}@${p.dominio}`;
}

/**
 * La clave del buzon al que se mando el correo: la de la primera direccion
 * que es la del buzon con «+clave». null si no se mando a ninguna (por
 * ejemplo, alguien le escribio al correo de soporte de Luka).
 */
export function claveDelBuzon(direcciones: readonly string[], base: string): string | null {
  const b = partes(base);
  if (b === null) return null;
  const buzon = canonica({ local: b.local.split("+")[0]!, dominio: b.dominio });
  for (const direccion of direcciones) {
    const p = partes(direccion);
    if (p === null) continue;
    const mas = p.local.indexOf("+");
    if (mas <= 0) continue;
    const persona = canonica({ local: p.local.slice(0, mas), dominio: p.dominio });
    const clave = p.local.slice(mas + 1);
    if (persona.local === buzon.local && persona.dominio === buzon.dominio && esClaveDeBuzon(clave)) return clave;
  }
  return null;
}

/** Si la direccion es la del buzon, con o sin clave: esas nunca son de una persona. */
export function esDelBuzon(direccion: string, base: string): boolean {
  const b = partes(base);
  const p = partes(direccion);
  if (b === null || p === null) return false;
  const x = canonica({ local: p.local.split("+")[0]!, dominio: p.dominio });
  const y = canonica({ local: b.local.split("+")[0]!, dominio: b.dominio });
  return x.local === y.local && x.dominio === y.dominio;
}

// ---------------------------------------------------------------------------
// Las firmas
// ---------------------------------------------------------------------------

export type ResultadoDeFirma = {
  /** "dkim", "spf", "dmarc", "arc". */
  metodo: string;
  /** "pass", "fail", "none"... */
  resultado: string;
  /** "header.d", "header.i", "header.from", "smtp.mailfrom". */
  propiedades: Record<string, string>;
};

/** Lo que dice un encabezado Authentication-Results (RFC 8601). */
export type Autenticacion = { servidor: string; resultados: ResultadoDeFirma[] };

/**
 * Lee un Authentication-Results:
 *
 *   mx.google.com; dkim=pass header.i=@gmail.com header.s=20230601;
 *   spf=pass (google.com: ...) smtp.mailfrom=ana@gmail.com;
 *   dmarc=pass (p=NONE sp=QUARANTINE dis=NONE) header.from=gmail.com
 *
 * El que vale es el que puso el servidor del buzon al recibir el correo: el
 * primero de arriba. Los de mas abajo vienen con el correo y cualquiera los
 * puede inventar.
 */
export function leerAutenticacion(valor: string): Autenticacion | null {
  // Los comentarios van entre parentesis y no dicen nada que se use.
  let sinComentarios = valor;
  for (let i = 0; i < 5 && /\([^()]*\)/.test(sinComentarios); i++) sinComentarios = sinComentarios.replace(/\([^()]*\)/g, " ");
  const [cabeza = "", ...resto] = sinComentarios.split(";");
  const servidor = cabeza.trim().split(/\s+/)[0] ?? "";
  if (servidor === "" || servidor.includes("=")) return null;

  const resultados: ResultadoDeFirma[] = [];
  for (const parte of resto) {
    const palabras = parte.trim().split(/\s+/).filter((p) => p !== "");
    const primera = /^([a-z0-9-]+)=([a-z]+)$/i.exec(palabras[0] ?? "");
    if (!primera) continue;
    const propiedades: Record<string, string> = {};
    for (const palabra of palabras.slice(1)) {
      const propiedad = /^([a-z0-9.-]+)=(.+)$/i.exec(palabra);
      if (propiedad) propiedades[propiedad[1]!.toLowerCase()] = propiedad[2]!.replace(/^"|"$/g, "").toLowerCase();
    }
    resultados.push({ metodo: primera[1]!.toLowerCase(), resultado: primera[2]!.toLowerCase(), propiedades });
  }
  return { servidor: servidor.toLowerCase(), resultados };
}

/** "mail.santander.cl" y "santander.cl" son de la misma organizacion. */
function alineados(a: string, b: string): boolean {
  const x = a.replace(/^@/, "").replace(/\.$/, "");
  const y = b.replace(/^@/, "").replace(/\.$/, "");
  return x !== "" && y !== "" && (x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`));
}

function dominioDeFirma(propiedad: string | undefined): string {
  if (propiedad === undefined) return "";
  return propiedad.includes("@") ? propiedad.slice(propiedad.lastIndexOf("@") + 1) : propiedad;
}

/**
 * Si el correo trae la firma del dominio de su remitente: DMARC aprobado para
 * ese dominio, o una firma DKIM aprobada de ese dominio (o de uno suyo).
 */
export function firmadoPor(autenticacion: Autenticacion | null, dominio: string): boolean {
  if (autenticacion === null || dominio === "") return false;
  return autenticacion.resultados.some((r) => {
    if (r.resultado !== "pass") return false;
    if (r.metodo === "dmarc") return alineados(dominioDeFirma(r.propiedades["header.from"]), dominio);
    if (r.metodo === "dkim") {
      return alineados(dominioDeFirma(r.propiedades["header.d"] ?? r.propiedades["header.i"]), dominio);
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Quien lo reenvio
// ---------------------------------------------------------------------------

/** Lo que se mira de un correo que llega para saber quien lo reenvio. */
export type DatosDeLlegada = {
  /** El From: el banco si se reenvio solo, la persona si lo reenvio a mano. */
  de: string | null;
  /** To y Cc del correo: a quien se lo mando el banco. */
  destinatarios: readonly string[];
  /**
   * Lo que dejan los que reenvian: X-Forwarded-For (Gmail), Resent-From
   * (Outlook) y los Delivered-To de la bandeja por donde paso. Cualquiera
   * los puede escribir: solo dicen a quien buscar entre los confirmados.
   */
  rastros: readonly string[];
  /** El Authentication-Results del servidor del buzon. */
  autenticacion: Autenticacion | null;
};

export type Remitencia =
  /** La persona lo reenvio a mano, desde un correo confirmado y con su firma. */
  | { tipo: "a-mano"; reenviadoPor: string }
  /** Lo reenvio una regla de un correo confirmado. */
  | { tipo: "automatico"; reenviadoPor: string }
  /** No aparece ningun correo confirmado: no se lee. */
  | { tipo: "sin-confirmar"; desde: string }
  /** Dice venir de un correo confirmado, pero sin su firma: no se lee. */
  | { tipo: "sin-firma"; desde: string };

/**
 * Quien reenvio el correo, entre los correos confirmados de la persona. El
 * From manda: si es uno de sus correos, lo reenvio a mano y tiene que traer
 * su firma; si no, se busca uno suyo en los rastros y en los destinatarios.
 */
export function quienLoReenvio(llegada: DatosDeLlegada, confirmados: readonly string[]): Remitencia {
  const confirmado = (direccion: string) => confirmados.find((c) => mismaDireccion(c, direccion));

  if (llegada.de !== null) {
    const suyo = confirmado(llegada.de);
    if (suyo !== undefined) {
      const dominio = llegada.de.slice(llegada.de.lastIndexOf("@") + 1);
      return firmadoPor(llegada.autenticacion, dominio)
        ? { tipo: "a-mano", reenviadoPor: suyo }
        : { tipo: "sin-firma", desde: llegada.de };
    }
  }

  for (const direccion of [...llegada.rastros, ...llegada.destinatarios]) {
    const suyo = confirmado(direccion);
    if (suyo !== undefined) return { tipo: "automatico", reenviadoPor: suyo };
  }

  const desde = llegada.rastros[0] ?? llegada.destinatarios[0] ?? llegada.de ?? "sin remitente";
  return { tipo: "sin-confirmar", desde: desde.toLowerCase() };
}

// ---------------------------------------------------------------------------
// La confirmacion de reenvio de Gmail
// ---------------------------------------------------------------------------

export const REMITENTE_DE_GMAIL = "forwarding-noreply@google.com";

/** Cuantos dias se muestra el codigo de Gmail despues de que llego. */
export const DIAS_DEL_CODIGO_DE_GMAIL = 7;

const UN_CORREO = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/**
 * Cuando alguien agrega su direccion de Luka como direccion de reenvio,
 * Gmail le escribe al buzon con un codigo de confirmacion: «(#123456789)
 * Confirmación de reenvío de Gmail - Recibir correo de ana@gmail.com». Luka
 * no abre el enlace que trae: muestra el codigo para que la persona lo
 * escriba en Gmail. Tiene que venir firmado por Google.
 */
export function confirmacionDeGmail(
  correo: { de: string | null; asunto: string; texto: string; autenticacion: Autenticacion | null },
  esDeLuka: (direccion: string) => boolean,
): { codigo: string; solicitante: string | null } | null {
  if (correo.de === null || correo.de.toLowerCase() !== REMITENTE_DE_GMAIL) return null;
  if (!firmadoPor(correo.autenticacion, "google.com")) return null;

  const codigo =
    /\(\s*(?:#|n\.?\s*[º°o]\.?)?\s*(\d{6,12})\s*\)/i.exec(correo.asunto)?.[1] ??
    /(?:c[oó]digo\s+de\s+confirmaci[oó]n|confirmation\s+code)\s*:?\s*(\d{6,12})/i.exec(correo.texto)?.[1] ??
    null;
  if (codigo === null) return null;

  const candidatos = [...correo.asunto.matchAll(UN_CORREO), ...correo.texto.matchAll(UN_CORREO)].map((m) => m[0].toLowerCase());
  const solicitante = candidatos.find((c) => !esDeLuka(c) && !/@(?:[a-z0-9-]+\.)*google\.com$/.test(c)) ?? null;
  return { codigo, solicitante };
}

// ---------------------------------------------------------------------------
// Lo que se muestra de cada llegada
// ---------------------------------------------------------------------------

/** Los mismos valores del enum ResultadoDeLlegada de Prisma. */
export type ResultadoDeLlegada =
  | "NUEVO"
  | "REPETIDO"
  | "NO_ES_COMPROBANTE"
  | "NO_SE_PUDO_LEER"
  | "CARTOLA"
  | "CARTOLA_LEIDA"
  | "CARTOLA_SIN_CLAVE"
  | "CARTOLA_NO_CUADRA"
  | "SIN_CONFIRMAR"
  | "SIN_FIRMA"
  | "CONFIRMACION_DE_GMAIL";

/** Cuantas llegadas se guardan de cada persona: las ultimas. */
export const LLEGADAS_QUE_SE_GUARDAN = 30;

export const TEXTO_DE_LA_LLEGADA: Record<ResultadoDeLlegada, string> = {
  NUEVO: "Lo leyó: quedó en «Por revisar».",
  REPETIDO: "Ya había llegado: no se anotó otra vez.",
  NO_ES_COMPROBANTE: "No es un comprobante (publicidad o un aviso): no se anotó.",
  NO_SE_PUDO_LEER: "Parece un comprobante, pero Luka no lo pudo leer.",
  CARTOLA: "Es la cartola del mes, pero Luka todavía no sabe leer las de este banco.",
  CARTOLA_LEIDA: "Leyó la cartola del mes: lo nuevo quedó en «Por revisar».",
  CARTOLA_SIN_CLAVE: "Llegó la cartola del mes, pero falta la clave de su PDF: escríbela en Inicio y Luka la lee al tiro.",
  CARTOLA_NO_CUADRA: "Llegó la cartola del mes, pero lo que Luka leyó no suma lo que dice el banco: no anotó nada.",
  SIN_CONFIRMAR: "Llegó desde un correo que no está confirmado: no se leyó.",
  SIN_FIRMA: "Dice venir de tu correo, pero sin su firma: no se leyó.",
  CONFIRMACION_DE_GMAIL: "Gmail pidió confirmar el reenvío: el código está arriba.",
};

/** Las llegadas que necesitan que la persona haga algo. */
export function pideAlgo(resultado: ResultadoDeLlegada): boolean {
  return (
    resultado === "SIN_CONFIRMAR" ||
    resultado === "SIN_FIRMA" ||
    resultado === "NO_SE_PUDO_LEER" ||
    resultado === "CARTOLA_SIN_CLAVE" ||
    resultado === "CARTOLA_NO_CUADRA"
  );
}
