import type { Campo, Plantilla } from "./motor";
import { FECHA, FECHA_SUELTA, NUMERO_DE_CUENTA, N_DE_CUENTA, PESOS, patron } from "./patrones";

/**
 * Santander no manda correo por cada compra con tarjeta: manda el comprobante
 * de cada transferencia que haces, el aviso de las que te hacen, el del Boton
 * de Pago y la cartola del mes (las compras con tarjeta salen de ahi).
 */

const DESTINATARIO: Campo = {
  patron: patron`Datos de destino\s+Nombre:?\s+(.+?)(?=\s+(?:RUT|Banco|Tipo de cuenta|${N_DE_CUENTA}|E-?mail)\b)`,
};

const QUIEN_TE_TRANSFIRIO: Campo = {
  patron: patron`instruido por nuestro cliente:?\s+(.+?),?\s+le informamos`,
};

export const PLANTILLAS_SANTANDER: readonly Plantilla[] = [
  {
    id: "santander/cartola",
    remitentes: ["mensajeria@santander.cl"],
    contiene: /\b(?:revisar|ver)\s+tu\s+cartola\b|\bcartola\s+mensual\b/i,
    descartar: "es-cartola",
    porque: "La cartola del mes: se lee aparte, con su clave.",
  },
  {
    id: "santander/transferencia-enviada",
    remitentes: ["mensajeria@santander.cl"],
    asunto: /comprobante\s+(?:de\s+)?transferencia/i,
    fuente: "Comprobante de Santander",
    tipo: "TRANSFERENCIA",
    sentido: "gasto",
    campos: {
      monto: { patron: patron`Monto transferido:?\s*${PESOS}` },
      fecha: { patron: patron`transferencia realizada el\s+${FECHA}` },
      comercio: DESTINATARIO,
      medioPago: { fijo: "TRANSFERENCIA" },
      ultimos4: { patron: patron`Datos de origen.*?${N_DE_CUENTA}:?\s+${NUMERO_DE_CUENTA}` },
      contraparte: {
        nombre: DESTINATARIO,
        banco: { patron: patron`Datos de destino.*?\bBanco:?\s+(.+?)(?=\s+(?:Tipo de cuenta|${N_DE_CUENTA}|E-?mail)\b)` },
        ultimos4: { patron: patron`Datos de destino.*?${N_DE_CUENTA}:?\s+${NUMERO_DE_CUENTA}` },
      },
    },
  },
  {
    id: "santander/transferencia-recibida",
    remitentes: ["mensajeria@santander.cl"],
    asunto: /aviso\s+de\s+transferencia/i,
    fuente: "Aviso de Santander",
    tipo: "ABONO",
    sentido: "ingreso",
    campos: {
      monto: { patron: patron`Monto transferido(?:\s+${FECHA_SUELTA})?:?\s*${PESOS}` },
      fecha: { patron: patron`con\s+fecha:?\s*${FECHA}` },
      comercio: QUIEN_TE_TRANSFIRIO,
      medioPago: { fijo: "TRANSFERENCIA" },
      ultimos4: { patron: patron`hacia su cuenta\b.*?\bnro\.?\s*${NUMERO_DE_CUENTA}` },
      contraparte: {
        nombre: QUIEN_TE_TRANSFIRIO,
        banco: { patron: patron`Banco de Origen\s+(?:N[uú]mero de la operaci[oó]n\s+)?(.+?)\s+\d{6,}` },
      },
    },
  },
  {
    id: "santander/pago-de-cuenta",
    remitentes: ["bdp@santander.cl"],
    asunto: /comprobante\s+de\s+pago/i,
    fuente: "Botón de Pago de Santander",
    tipo: "PAGO",
    sentido: "gasto",
    campos: {
      monto: { patron: patron`por un total de:?\s*${PESOS}` },
      fecha: { patron: patron`con\s+fecha\s+${FECHA}` },
      comercio: {
        patron: patron`\bServicio:?\s+(.+?)(?=\s+(?:Hora Transacci[oó]n|Producto|NOR|Identificador|Cliente)\b)`,
      },
      ultimos4: { patron: patron`\bCuenta\s+N(?:ro|[º°]|o)?\.?:?\s*${NUMERO_DE_CUENTA}` },
    },
  },
  {
    id: "santander/publicidad",
    remitentes: ["@comunicaciones.santander.cl"],
    descartar: "no-es-comprobante",
    porque: "Publicidad de Santander.",
  },
  {
    id: "santander/avisos-de-la-cuenta",
    remitentes: ["mensajeria@santander.cl"],
    asunto: /clave|dispositivo|actualiza\s+tu\s+app|estafa|seguridad|fraude/i,
    descartar: "no-es-comprobante",
    porque: "Aviso de seguridad o de la app, sin movimientos.",
  },
];
