import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { claveDeBuzonAlAzar } from "@/lib/codigos";
import {
  comprobanteDelCorreo,
  correoAdjunto,
  datosDeLlegada,
  leerCorreo,
  type CorreoEntrante,
} from "@/lib/correo-entrante";
import { configuracionDelBuzon, type ConfiguracionDelBuzon } from "@/lib/buzon";
import { abrirBuzonImap, type FuenteDeCorreos } from "@/lib/buzon-imap";
import { leerConIADelEntorno } from "@/lib/leer-con-ia";
import { darPermisoDeGmail } from "@/lib/permiso-de-gmail";
import { crearLector } from "@/dominio/comprobantes/lector";
import { htmlATexto, normalizarComprobante } from "@/dominio/comprobantes/normalizar";
import type { Comprobante, Lector, Lectura } from "@/dominio/comprobantes/tipos";
import {
  DIAS_DEL_CODIGO_DE_GMAIL,
  LLEGADAS_QUE_SE_GUARDAN,
  claveDelBuzon,
  confirmacionDeGmail,
  direccionDelBuzon,
  esDelBuzon,
  quienLoReenvio,
  type ResultadoDeLlegada,
} from "@/dominio/buzon";
import type { AdjuntoEntrante } from "@/lib/correo-entrante";
import { leerCartolaEnPdf, type ResumenDeCartola } from "./cartolas";
import { correosConfirmados } from "./correos-registrados";
import { huellaDeCorreo, registrarMovimiento } from "./movimientos";

/**
 * Lo que pasa con cada correo que llega al buzon de Luka, y la direccion de
 * cada persona. Las reglas estan en src/dominio/buzon.ts; el IMAP, en
 * src/lib/buzon.ts.
 *
 * Por cada correo que va a una direccion con clave:
 *
 *   1. De quien es la clave. Si no es de nadie, se borra.
 *   2. Si es Gmail pidiendo confirmar el reenvio desde un correo confirmado
 *      de esa persona, Luka da el permiso sola; si no puede, deja el enlace
 *      (o el codigo, como era antes) a la vista para que la persona lo de.
 *   3. Quien lo reenvio: si no es un correo confirmado de esa persona, no se
 *      lee, y queda anotado por que.
 *   4. El lector (plantillas y, si esta, la IA). Si la IA falla por algo
 *      pasajero, el correo se queda para la proxima revision.
 *   5. El movimiento, con su cuenta y quien lo reenvio, «Por revisar». El
 *      mismo correo dos veces es un solo movimiento.
 *
 * Despues de leerlo, el correo se borra del buzon: de cada comprobante Luka
 * guarda solo lo que leyo, y de cada llegada, quien la mando y que paso.
 */

type Db = PrismaClient;

export class ErrorDelBuzon extends Error {}

/** Lo que pasa con un correo despues de procesarlo. */
export type ResultadoDelCorreo =
  /** No va a ningun buzon de Luka (por ejemplo, alguien le escribio a soporte): no se toca. */
  | { tipo: "ajeno" }
  /**
   * Algo pasajero (la IA no contesto): se queda en el buzon para la proxima.
   * porLaClave: es la cartola y espera que alguien guarde la clave de su PDF.
   */
  | { tipo: "reintentar"; motivo: string; porLaClave?: true }
  /** Ya se proceso: se puede borrar del buzon. SIN_DUENO = una clave que no es de nadie. */
  | { tipo: "leido"; resultado: ResultadoDeLlegada | "SIN_DUENO"; movimientoId?: string };

export type OpcionesDelBuzon = {
  db?: Db;
  /** La direccion del buzon, sin clave. */
  base: string;
  /** El lector para un hogar, con los nombres de su gente. Por omision, plantillas y la IA del .env. */
  lectorPara?: (nombres: readonly string[]) => Lector;
  ahora?: Date;
  /** Para descifrar las claves de las cartolas. Por omision, la de CLAVE_DOS_PASOS. */
  maestra?: Buffer;
  /** Abre el enlace con que Gmail pide aceptar el reenvio. Por omision, src/lib/permiso-de-gmail.ts. */
  darPermiso?: (enlace: string) => Promise<boolean>;
};

function lectorDelEntorno(nombres: readonly string[]): Lector {
  return crearLector({ leerConIA: leerConIADelEntorno(process.env, { nombres }) });
}

function sha256(texto: string | Uint8Array): string {
  return createHash("sha256").update(texto).digest("hex");
}

/**
 * La huella que dice si un comprobante ya llego. La del Message-ID del
 * correo del banco (el que llega reenviado solo, o adjunto, lo conserva). Un
 * reenvio a mano trae otro Message-ID, asi que su huella es la del original
 * que viene adentro: el mismo comprobante reenviado dos veces deja la misma.
 */
export function huellaDelComprobante(
  correo: CorreoEntrante,
  original: CorreoEntrante | null,
  comprobante: Comprobante,
  fuente: Uint8Array | string,
): string {
  if (original !== null) {
    return original.idDelMensaje ? huellaDeCorreo(original.idDelMensaje) : huellaDeCorreo(`sin-id:${sha256(comprobante.texto)}`);
  }
  const normalizado = normalizarComprobante(comprobante);
  if (normalizado.reenviadoAMano) {
    return huellaDeCorreo(`reenvio:${sha256([normalizado.remitente, normalizado.asunto, normalizado.plano].join("\n"))}`);
  }
  return correo.idDelMensaje ? huellaDeCorreo(correo.idDelMensaje) : huellaDeCorreo(`sin-id:${sha256(fuente)}`);
}

const RESULTADO_SIN_LECTURA = {
  "no-es-comprobante": "NO_ES_COMPROBANTE",
  "no-se-pudo-leer": "NO_SE_PUDO_LEER",
  "es-cartola": "CARTOLA",
} as const satisfies Record<string, ResultadoDeLlegada>;

/** 30 sep, del 2026-09-30. */
function diaCorto(iso: string): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(iso.slice(8, 10))} ${meses[Number(iso.slice(5, 7)) - 1]}`;
}

/** "Cartola de Santander del 30 sep al 30 oct: 5 nuevos, 9 ya estaban." */
export function detalleDeLaCartola(cartola: ResumenDeCartola): string {
  const partes = [`${cartola.nuevas} por revisar`, `${cartola.yaEstaban} ya estaban`];
  if (cartola.fuera > 0) partes.push(`${cartola.fuera} fuera`);
  return `Cartola de ${cartola.banco} del ${diaCorto(cartola.desde)} al ${diaCorto(cartola.hasta)}: ${partes.join(", ")}.`;
}

function esPdf(adjunto: AdjuntoEntrante): boolean {
  return adjunto.tipo === "application/pdf" || /\.pdf$/i.test(adjunto.nombre);
}

/** Anota la llegada y deja solo las ultimas de esa persona. */
async function anotarLlegada(
  db: Db,
  miembroId: string,
  llegada: { resultado: ResultadoDeLlegada; remitente: string; detalle?: string | null; movimientoId?: string | null },
  ahora: Date,
): Promise<void> {
  await db.llegadaAlBuzon.create({
    data: {
      miembroId,
      llegoEn: ahora,
      resultado: llegada.resultado,
      remitente: (llegada.remitente.trim().toLowerCase() || "sin remitente").slice(0, 254),
      detalle: llegada.detalle?.trim().slice(0, 200) || null,
      movimientoId: llegada.movimientoId ?? null,
    },
  });
  const viejas = await db.llegadaAlBuzon.findMany({
    where: { miembroId },
    orderBy: [{ llegoEn: "desc" }, { id: "desc" }],
    skip: LLEGADAS_QUE_SE_GUARDAN,
    select: { id: true },
  });
  if (viejas.length > 0) await db.llegadaAlBuzon.deleteMany({ where: { id: { in: viejas.map((v) => v.id) } } });
}

/** Procesa un correo tal como llego al buzon. Ver la explicacion arriba. */
export async function procesarCorreo(fuente: Uint8Array | string, opciones: OpcionesDelBuzon): Promise<ResultadoDelCorreo> {
  const { db = prisma, base, lectorPara = lectorDelEntorno, ahora = new Date(), darPermiso = darPermisoDeGmail } = opciones;

  let correo: CorreoEntrante;
  try {
    correo = await leerCorreo(fuente);
  } catch {
    // Un correo que ni siquiera se puede abrir no se va a poder leer nunca.
    return { tipo: "leido", resultado: "SIN_DUENO" };
  }

  const clave = claveDelBuzon([...correo.entregadoA, ...correo.destinatarios], base);
  if (clave === null) return { tipo: "ajeno" };

  const buzon = await db.buzon.findUnique({
    where: { clave },
    select: { miembroId: true, miembro: { select: { hogarId: true, hogar: { select: { miembros: { select: { nombre: true } } } } } } },
  });
  if (!buzon) return { tipo: "leido", resultado: "SIN_DUENO" };
  const { miembroId } = buzon;
  const hogarId = buzon.miembro.hogarId;

  const esDeLuka = (direccion: string) => esDelBuzon(direccion, base);
  const llegada = datosDeLlegada(correo, esDeLuka);

  // Gmail pide confirmar el reenvio. Si lo pidio un correo confirmado de
  // esta persona, Luka da el permiso sola. Si no pudo, el enlace (o el
  // codigo, con el Gmail de antes) queda a la vista para que lo de ella. Un
  // enlace pedido desde otro correo no se abre ni se muestra.
  const gmail = confirmacionDeGmail(
    { de: correo.de, asunto: correo.asunto, texto: correo.texto ?? htmlATexto(correo.html ?? ""), autenticacion: llegada.autenticacion },
    esDeLuka,
  );
  if (gmail !== null) {
    const suyo = gmail.solicitante !== null && (await correosConfirmados(miembroId, db)).includes(gmail.solicitante);
    const remitenteDeGmail = gmail.solicitante ?? correo.de ?? "gmail";
    if (suyo && gmail.enlace !== null && (await darPermiso(gmail.enlace))) {
      await db.buzon.update({
        where: { miembroId },
        data: { codigoDeGmail: null, enlaceDeGmail: null, codigoDeGmailDe: gmail.solicitante, codigoDeGmailEn: ahora },
      });
      await anotarLlegada(db, miembroId, { resultado: "REENVIO_CONFIRMADO", remitente: remitenteDeGmail }, ahora);
      return { tipo: "leido", resultado: "REENVIO_CONFIRMADO" };
    }
    const enlace = suyo ? gmail.enlace : null;
    if (gmail.codigo === null && enlace === null) {
      await anotarLlegada(db, miembroId, { resultado: "SIN_CONFIRMAR", remitente: remitenteDeGmail }, ahora);
      return { tipo: "leido", resultado: "SIN_CONFIRMAR" };
    }
    await db.buzon.update({
      where: { miembroId },
      data: { codigoDeGmail: gmail.codigo, enlaceDeGmail: enlace, codigoDeGmailDe: gmail.solicitante, codigoDeGmailEn: ahora },
    });
    await anotarLlegada(db, miembroId, { resultado: "CONFIRMACION_DE_GMAIL", remitente: remitenteDeGmail }, ahora);
    return { tipo: "leido", resultado: "CONFIRMACION_DE_GMAIL" };
  }

  const remitencia = quienLoReenvio(llegada, await correosConfirmados(miembroId, db));
  if (remitencia.tipo === "sin-confirmar" || remitencia.tipo === "sin-firma") {
    const resultado = remitencia.tipo === "sin-confirmar" ? "SIN_CONFIRMAR" : "SIN_FIRMA";
    await anotarLlegada(db, miembroId, { resultado, remitente: remitencia.desde }, ahora);
    return { tipo: "leido", resultado };
  }

  // Reenviado a mano como archivo adjunto: el comprobante es el adjunto.
  const original = remitencia.tipo === "a-mano" ? await correoAdjunto(correo) : null;
  const comprobante = await comprobanteDelCorreo(original ?? correo, remitencia.reenviadoPor, ahora);
  const remitente = normalizarComprobante(comprobante).remitente || correo.de || remitencia.reenviadoPor;

  let lectura: Lectura;
  try {
    const nombres = buzon.miembro.hogar.miembros.flatMap((m) => (m.nombre ? [m.nombre] : []));
    lectura = await lectorPara(nombres)(comprobante);
  } catch (error) {
    return { tipo: "reintentar", motivo: error instanceof Error ? error.message : String(error) };
  }

  if (!lectura.ok && lectura.motivo === "es-cartola") {
    return await leerLaCartola(original ?? correo, { db, ahora, hogarId, miembroId, remitente, maestra: opciones.maestra });
  }

  if (!lectura.ok) {
    const resultado = RESULTADO_SIN_LECTURA[lectura.motivo];
    await anotarLlegada(db, miembroId, { resultado, remitente, detalle: lectura.detalle ?? null }, ahora);
    return { tipo: "leido", resultado };
  }

  const leida = original !== null ? { ...lectura, reenviadoAMano: true as const } : lectura;
  const registrado = await registrarMovimiento(
    hogarId,
    {
      huella: huellaDelComprobante(correo, original, comprobante, fuente),
      lectura: leida,
      recibidoEn: (original ?? correo).fecha ?? ahora,
      miembroId,
      reenviadoPor: remitencia.reenviadoPor,
      remitente,
    },
    db,
  );
  const resultado = registrado.nuevo ? "NUEVO" : "REPETIDO";
  await anotarLlegada(db, miembroId, { resultado, remitente, detalle: leida.fuente, movimientoId: registrado.id }, ahora);
  return { tipo: "leido", resultado, movimientoId: registrado.id };
}

/**
 * La cartola del mes que llego al buzon: se lee con la clave que la persona
 * (o alguien de su hogar) guardo para ese banco. Si todavia no la guarda, el
 * correo se queda en el buzon y se vuelve a intentar en la proxima revision,
 * hasta que la escriba; la llegada se anota una vez.
 */
async function leerLaCartola(
  correo: CorreoEntrante,
  contexto: { db: Db; ahora: Date; hogarId: string; miembroId: string; remitente: string; maestra?: Buffer },
): Promise<ResultadoDelCorreo> {
  const { db, ahora, hogarId, miembroId, remitente } = contexto;
  const anotar = (resultado: ResultadoDeLlegada, detalle: string) => anotarLlegada(db, miembroId, { resultado, remitente, detalle }, ahora);

  const pdf = correo.adjuntos.find(esPdf);
  if (!pdf) {
    await anotar("CARTOLA", "Habla de la cartola, pero no trae el PDF.");
    return { tipo: "leido", resultado: "CARTOLA" };
  }

  const leida = await leerCartolaEnPdf(
    hogarId,
    { pdf: pdf.contenido, miembroId, recibidoEn: correo.fecha ?? ahora, remitente },
    { db, maestra: contexto.maestra },
  );
  if (leida.ok) {
    await anotar("CARTOLA_LEIDA", detalleDeLaCartola(leida.cartola));
    return { tipo: "leido", resultado: "CARTOLA_LEIDA" };
  }
  if (leida.motivo === "falta-la-clave" || leida.motivo === "clave-incorrecta") {
    // Se anota una vez, y otra si despues alguien del hogar guardo una clave
    // que tampoco la abre: asi Inicio vuelve a pedirla.
    const [ultima, claveMasNueva] = await Promise.all([
      db.llegadaAlBuzon.findFirst({
        where: { miembroId },
        orderBy: [{ llegoEn: "desc" }, { id: "desc" }],
        select: { resultado: true, remitente: true, llegoEn: true },
      }),
      db.claveDeCartola.findFirst({ where: { miembro: { hogarId } }, orderBy: { creadaEn: "desc" }, select: { creadaEn: true } }),
    ]);
    const yaAvisada =
      ultima?.resultado === "CARTOLA_SIN_CLAVE" &&
      ultima.remitente === remitente.trim().toLowerCase() &&
      (claveMasNueva === null || claveMasNueva.creadaEn <= ultima.llegoEn);
    if (!yaAvisada) await anotar("CARTOLA_SIN_CLAVE", leida.mensaje);
    return { tipo: "reintentar", motivo: "Falta la clave del PDF de la cartola.", porLaClave: true };
  }
  if (leida.motivo === "no-cuadra" || leida.motivo === "incompleta") {
    await anotar("CARTOLA_NO_CUADRA", leida.mensaje);
    return { tipo: "leido", resultado: "CARTOLA_NO_CUADRA" };
  }
  await anotar("CARTOLA", leida.mensaje);
  return { tipo: "leido", resultado: "CARTOLA" };
}

/** Lo que paso en una revision del buzon. */
export type ResumenDeRevision = {
  /** Los que iban a una direccion de Luka. */
  revisados: number;
  nuevos: number;
  repetidos: number;
  /** Los que no eran comprobantes, no se pudieron leer o eran la cartola. */
  sinMovimiento: number;
  /** Los que llegaron desde un correo sin confirmar o sin su firma. */
  rechazados: number;
  /** Los que quedaron para la proxima, por algo pasajero. */
  pendientes: number;
  /** Las cartolas que se leyeron. */
  cartolas: number;
  /** Las cartolas que esperan en el buzon la clave de su PDF. */
  esperanClave: number;
};

/**
 * Revisa el buzon una vez: procesa lo que va a una direccion de Luka y borra
 * lo que ya se proceso. Lo demas (lo de soporte, lo que hay que reintentar)
 * queda donde estaba.
 */
export async function revisarBuzon(fuente: FuenteDeCorreos, opciones: OpcionesDelBuzon): Promise<ResumenDeRevision> {
  const resumen: ResumenDeRevision = {
    revisados: 0,
    nuevos: 0,
    repetidos: 0,
    sinMovimiento: 0,
    rechazados: 0,
    pendientes: 0,
    cartolas: 0,
    esperanClave: 0,
  };
  const listos = [];

  for (const correo of await fuente.listar()) {
    if (claveDelBuzon(correo.destinatarios, opciones.base) === null) continue;
    resumen.revisados += 1;
    let resultado: ResultadoDelCorreo;
    try {
      resultado = await procesarCorreo(await fuente.traer(correo), opciones);
    } catch (error) {
      // Algo que no se esperaba (la base no contesto): se intenta en la proxima.
      console.error("No se pudo procesar un correo del buzon:", error);
      resumen.pendientes += 1;
      continue;
    }
    if (resultado.tipo === "ajeno") {
      resumen.revisados -= 1;
      continue;
    }
    if (resultado.tipo === "reintentar") {
      if (resultado.porLaClave) resumen.esperanClave += 1;
      else resumen.pendientes += 1;
      continue;
    }
    listos.push(correo);
    if (resultado.resultado === "NUEVO") resumen.nuevos += 1;
    else if (resultado.resultado === "CARTOLA_LEIDA") resumen.cartolas += 1;
    else if (resultado.resultado === "REPETIDO") resumen.repetidos += 1;
    else if (resultado.resultado === "SIN_CONFIRMAR" || resultado.resultado === "SIN_FIRMA") resumen.rechazados += 1;
    else if (
      resultado.resultado !== "CONFIRMACION_DE_GMAIL" &&
      resultado.resultado !== "REENVIO_CONFIRMADO" &&
      resultado.resultado !== "SIN_DUENO"
    )
      resumen.sinMovimiento += 1;
  }

  if (listos.length > 0) await fuente.borrar(listos);
  return resumen;
}

/** Una revision a la vez en este servidor: si ya hay una, se espera esa. */
let revisionEnCurso: Promise<ResumenDeRevision> | null = null;

/** Revisa el buzon del .env (src/lib/buzon.ts). */
export async function revisarElBuzon(
  { config = configuracionDelBuzon(), abrir = abrirBuzonImap }: { config?: ConfiguracionDelBuzon | null; abrir?: typeof abrirBuzonImap } = {},
): Promise<ResumenDeRevision> {
  if (config === null) {
    throw new ErrorDelBuzon("El buzón de Luka todavía no está configurado: falta CORREO_SMTP_USUARIO y CORREO_SMTP_CLAVE en el .env.");
  }
  if (revisionEnCurso !== null) return revisionEnCurso;
  revisionEnCurso = (async () => {
    let fuente: FuenteDeCorreos;
    try {
      fuente = await abrir(config);
    } catch (error) {
      console.error("No se pudo entrar al buzon por IMAP:", error);
      throw new ErrorDelBuzon("No se pudo entrar al buzón de Luka. Revisa la contraseña de aplicación del .env o intenta en un rato.");
    }
    try {
      return await revisarBuzon(fuente, { base: config.direccion });
    } finally {
      await fuente.cerrar().catch(() => undefined);
    }
  })();
  try {
    return await revisionEnCurso;
  } finally {
    revisionEnCurso = null;
  }
}

// ---------------------------------------------------------------------------
// La direccion de cada persona
// ---------------------------------------------------------------------------

export type LlegadaParaMostrar = {
  id: string;
  llegoEn: Date;
  resultado: ResultadoDeLlegada;
  remitente: string;
  detalle: string | null;
};

export type MiBuzon = {
  direccion: string;
  /**
   * Lo que mando Gmail para confirmar el reenvio y falta, si llego hace poco:
   * el codigo (el Gmail de antes) o el enlace para dar el permiso.
   */
  codigoDeGmail: { codigo: string | null; enlace: string | null; de: string | null; llegoEn: Date } | null;
  /** Si Luka ya acepto el reenvio de Gmail, desde que correo y cuando. */
  reenvioAceptado: { de: string; llegoEn: Date } | null;
  /** Lo ultimo que llego, lo mas nuevo primero. */
  llegadas: LlegadaParaMostrar[];
};

async function buzonDe(db: Db, hogarId: string, miembroId: string) {
  const miembro = await db.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { id: true } });
  if (!miembro) throw new ErrorDelBuzon("Ya no eres parte de este hogar.");
  const ya = await db.buzon.findUnique({ where: { miembroId } });
  if (ya) return ya;
  // La primera vez: una clave al azar. Si choca con otra (casi imposible) o
  // con otra pestana que la creo al mismo tiempo, se vuelve a leer.
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await db.buzon.create({ data: { miembroId, clave: claveDeBuzonAlAzar() } });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const otro = await db.buzon.findUnique({ where: { miembroId } });
      if (otro) return otro;
    }
  }
  throw new ErrorDelBuzon("No se pudo crear tu dirección de Luka. Intenta de nuevo.");
}

/**
 * La direccion de Luka de la persona (se crea la primera vez), el codigo de
 * Gmail si llego hace poco y lo ultimo que llego a su buzon.
 */
export async function leerMiBuzon(
  hogarId: string,
  miembroId: string,
  { base, db = prisma, ahora = new Date(), cuantas = 6 }: { base: string; db?: Db; ahora?: Date; cuantas?: number },
): Promise<MiBuzon> {
  const buzon = await buzonDe(db, hogarId, miembroId);
  const llegadas = await db.llegadaAlBuzon.findMany({
    where: { miembroId },
    orderBy: [{ llegoEn: "desc" }, { id: "desc" }],
    take: cuantas,
    select: { id: true, llegoEn: true, resultado: true, remitente: true, detalle: true },
  });
  const falta = buzon.codigoDeGmail !== null || buzon.enlaceDeGmail !== null;
  const vigente =
    falta &&
    buzon.codigoDeGmailEn !== null &&
    ahora.getTime() - buzon.codigoDeGmailEn.getTime() < DIAS_DEL_CODIGO_DE_GMAIL * 24 * 60 * 60_000;
  // Aceptado: quedo quien lo pidio y cuando, sin nada que falte.
  const aceptado = !falta && buzon.codigoDeGmailDe !== null && buzon.codigoDeGmailEn !== null;
  return {
    direccion: direccionDelBuzon(base, buzon.clave),
    codigoDeGmail: vigente
      ? { codigo: buzon.codigoDeGmail, enlace: buzon.enlaceDeGmail, de: buzon.codigoDeGmailDe, llegoEn: buzon.codigoDeGmailEn! }
      : null,
    reenvioAceptado: aceptado ? { de: buzon.codigoDeGmailDe!, llegoEn: buzon.codigoDeGmailEn! } : null,
    llegadas,
  };
}

/**
 * Le da a la persona una direccion nueva. La anterior deja de servir: lo que
 * llegue ahi se borra sin leer. Sirve si la direccion se filtro.
 */
export async function cambiarMiDireccion(hogarId: string, miembroId: string, base: string, db: Db = prisma): Promise<string> {
  await buzonDe(db, hogarId, miembroId);
  for (let intento = 0; intento < 3; intento++) {
    const clave = claveDeBuzonAlAzar();
    try {
      await db.buzon.update({
        where: { miembroId },
        data: { clave, codigoDeGmail: null, enlaceDeGmail: null, codigoDeGmailDe: null, codigoDeGmailEn: null },
      });
      return direccionDelBuzon(base, clave);
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new ErrorDelBuzon("No se pudo cambiar tu dirección de Luka. Intenta de nuevo.");
}

/** Saca el codigo o el enlace de Gmail de la pantalla, cuando ya se uso. */
export async function olvidarCodigoDeGmail(hogarId: string, miembroId: string, db: Db = prisma): Promise<void> {
  await buzonDe(db, hogarId, miembroId);
  await db.buzon.update({
    where: { miembroId },
    data: { codigoDeGmail: null, enlaceDeGmail: null, codigoDeGmailDe: null, codigoDeGmailEn: null },
  });
}
