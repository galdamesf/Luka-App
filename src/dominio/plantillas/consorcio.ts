import type { Campo, Plantilla } from "./motor";
import { FECHA, NUMERO_DE_CUENTA, N_DE_CUENTA, PESOS_SIN_SIGNO, patron } from "./patrones";

/**
 * Banco Consorcio manda el comprobante de cada transferencia, la que haces y
 * la que te hacen, con el mismo asunto ("Transferencia de Fondos - Banco
 * Consorcio"): las distingue la frase "has realizado" o "has recibido". El
 * monto viene sin signo y la fecha como 2026-02-20.
 *
 * Ademas avisa cada cargo y cada abono de la cuenta, sin decir con quien. Un
 * cargo llega junto con el comprobante de su transferencia: los dos quedan
 * leidos, el aviso marcado sinDetalle, y las reglas de los movimientos los
 * juntan. Los asuntos de esos avisos llegan con la o de "Notificacion" rota,
 * por eso se reconocen por el texto.
 *
 * Cada compra con la tarjeta de debito llega en su propio aviso, con el
 * comercio y los ultimos 4 de la tarjeta (no los de la cuenta): "se ha
 * realizado una compra con cargo a tu Tarjeta". El comercio viene con el
 * pais al final ("Cafe Los Aromos Providencia CHL"), que se quita.
 */

const MONTO_DE_LA_TRANSFERENCIA: Campo = { patron: patron`Monto Transacci[oó]n:?\s*${PESOS_SIN_SIGNO}` };
const FECHA_DE_LA_TRANSFERENCIA: Campo = { patron: patron`Fecha Transacci[oó]n:?\s*${FECHA}` };

const DESTINATARIO: Campo = { patron: patron`al siguiente destinatario:?\s+(.+?)\s*,\s*te enviamos` };
const QUIEN_TE_TRANSFIRIO: Campo = { patron: patron`por parte de:?\s+(.+?)\s*,\s*te enviamos` };

const AVISOS = ["mensajes@bancoconsorcio.cl"];

/** "Nombre comercio: Cafe Los Aromos Providencia CHL": el nombre, sin el pais. */
const COMERCIO_DE_LA_COMPRA: Campo = {
  patron: patron`Nombre (?:del )?comercio:?\s*([^\n]+?)(?:\s+(?:CHL|CL))?\s*(?:\n|Un cordial saludo|$)`,
};

export const PLANTILLAS_CONSORCIO: readonly Plantilla[] = [
  {
    id: "consorcio/cartola",
    remitentes: ["bancoconsorcio@bancoconsorcio.cl"],
    asunto: /cartola/i,
    descartar: "es-cartola",
    porque: "La cartola del mes: se lee aparte, con su clave.",
  },
  {
    id: "consorcio/transferencia-enviada",
    remitentes: AVISOS,
    asunto: /transferencia\s+de\s+fondos/i,
    contiene: /has\s+realizado\s+una\s+transferencia/i,
    fuente: "Comprobante de Consorcio",
    tipo: "TRANSFERENCIA",
    sentido: "gasto",
    campos: {
      monto: MONTO_DE_LA_TRANSFERENCIA,
      fecha: FECHA_DE_LA_TRANSFERENCIA,
      comercio: DESTINATARIO,
      medioPago: { fijo: "TRANSFERENCIA" },
      ultimos4: { patron: patron`Datos de origen:?.*?${N_DE_CUENTA}:?\s*${NUMERO_DE_CUENTA}` },
      contraparte: {
        nombre: DESTINATARIO,
        banco: { patron: patron`Datos de destino:?.*?\bBanco:?\s+(.+?)\s+(?=${N_DE_CUENTA})` },
        ultimos4: { patron: patron`Datos de destino:?.*?${N_DE_CUENTA}:?\s*${NUMERO_DE_CUENTA}` },
      },
    },
  },
  {
    id: "consorcio/transferencia-recibida",
    remitentes: AVISOS,
    asunto: /transferencia\s+de\s+fondos/i,
    contiene: /has\s+recibido\s+una\s+transferencia/i,
    fuente: "Comprobante de Consorcio",
    tipo: "ABONO",
    sentido: "ingreso",
    campos: {
      monto: MONTO_DE_LA_TRANSFERENCIA,
      fecha: FECHA_DE_LA_TRANSFERENCIA,
      comercio: QUIEN_TE_TRANSFIRIO,
      medioPago: { fijo: "TRANSFERENCIA" },
      ultimos4: { patron: patron`Cuenta Destino:?\s*${NUMERO_DE_CUENTA}` },
      contraparte: {
        nombre: QUIEN_TE_TRANSFIRIO,
        banco: { patron: patron`Datos originador:?.*?\bBanco:?\s+(.+?)\s+(?=Cuenta Origen)` },
        ultimos4: { patron: patron`Cuenta Origen:?\s*${NUMERO_DE_CUENTA}` },
      },
    },
  },
  {
    id: "consorcio/abono",
    remitentes: AVISOS,
    asunto: /abono/i,
    contiene: /se\s+ha\s+realizado\s+un\s+abono\s+a\s+tu\s+cuenta/i,
    fuente: "Aviso de abono de Consorcio",
    tipo: "ABONO",
    sentido: "ingreso",
    sinDetalle: true,
    campos: {
      monto: { patron: patron`Monto (?:de )?abono:?\s*${PESOS_SIN_SIGNO}` },
      fecha: { patron: patron`Fecha (?:de )?abono:?\s*${FECHA}` },
      comercio: { fijo: "Abono en cuenta Consorcio" },
      ultimos4: { patron: patron`N[uú]mero de cuenta:?\s*${NUMERO_DE_CUENTA}` },
    },
  },
  {
    id: "consorcio/cargo",
    remitentes: AVISOS,
    asunto: /cargo/i,
    contiene: /se\s+ha\s+realizado\s+un\s+cargo\s+a\s+tu\s+cuenta/i,
    fuente: "Aviso de cargo de Consorcio",
    tipo: "CARGO",
    sentido: "gasto",
    sinDetalle: true,
    campos: {
      monto: { patron: patron`Monto (?:de )?cargo:?\s*${PESOS_SIN_SIGNO}` },
      fecha: { patron: patron`Fecha (?:de )?cargo:?\s*${FECHA}` },
      comercio: { fijo: "Cargo en cuenta Consorcio" },
      ultimos4: { patron: patron`N[uú]mero de cuenta:?\s*${NUMERO_DE_CUENTA}` },
    },
  },
  {
    id: "consorcio/compra",
    remitentes: AVISOS,
    asunto: /compra/i,
    // La de credito, si un dia avisa igual, no se lee como debito.
    contiene: /se\s+ha\s+realizado\s+una\s+compra\s+con\s+cargo\s+a\s+tu\s+tarjeta(?!\s+de\s+cr[eé]dito)/i,
    fuente: "Aviso de compra de Consorcio",
    tipo: "COMPRA",
    sentido: "gasto",
    campos: {
      monto: { patron: patron`Monto de la compra:?\s*${PESOS_SIN_SIGNO}` },
      fecha: { patron: patron`Fecha de la compra:?\s*${FECHA}` },
      comercio: COMERCIO_DE_LA_COMPRA,
      medioPago: { fijo: "DEBITO" },
      ultimos4: { patron: patron`N[uú]mero de tarjeta:?\s*[*•xX.\s]*${NUMERO_DE_CUENTA}` },
    },
  },
  {
    id: "consorcio/publicidad",
    remitentes: ["@info.consorcio.cl"],
    descartar: "no-es-comprobante",
    porque: "Publicidad de Consorcio.",
  },
  {
    id: "consorcio/avisos-de-la-cuenta",
    remitentes: ["mensajes@bancoconsorcio.cl", "clave@consorcio.cl", "noreply@consorcio.cl"],
    asunto: /clave|enrolamiento|tu\s+pass|dispositivo|activada|finaliza\s+tu\s+proceso|obt[eé]n\s+tu\s+cuenta/i,
    descartar: "no-es-comprobante",
    porque: "Aviso de seguridad o de la cuenta, sin movimientos.",
  },
];
