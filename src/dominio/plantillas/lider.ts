import type { Plantilla } from "./motor";
import { FECHA, PESOS_SIN_SIGNO, patron } from "./patrones";

/**
 * Lider manda la boleta en un PDF adjunto: el cuerpo del correo no trae el
 * monto. Todo se lee del texto del PDF, que saca el buzon. Antes de la boleta
 * llegan correos del pedido (recibido, preparado, entregado) que no son el
 * gasto: si se leyeran, la compra quedaria dos veces.
 */
export const PLANTILLAS_LIDER: readonly Plantilla[] = [
  {
    id: "lider/boleta-digital",
    remitentes: ["@lider.cl"],
    asunto: /boleta/i,
    fuente: "Boleta digital de Líder",
    tipo: "BOLETA",
    sentido: "gasto",
    campos: {
      // TOTAL NETO y TOTAL IVA no calzan: despues de TOTAL tiene que venir el numero.
      monto: { patron: patron`\bTOTAL:?\s+${PESOS_SIN_SIGNO}`, en: "adjuntos", ultima: true },
      fecha: { patron: patron`\bFecha:?\s*${FECHA}`, en: "adjuntos" },
      comercio: { fijo: "Líder" },
      medioPago: { patron: patron`\b(TARJETA DE (?:D[EÉ]BITO|CR[EÉ]DITO)|EFECTIVO|REDCOMPRA)\b`, en: "adjuntos" },
      // La tarjeta viene enmascarada con muchos asteriscos; el "Rut Mi Club: ****1111" no calza.
      ultimos4: { patron: /[*•xX]{8,}\s*(\d{4})\b/, en: "adjuntos" },
    },
  },
  {
    id: "lider/estado-del-pedido",
    remitentes: ["@lider.cl"],
    asunto: /solicitud de compra|tu pedido|entregamos|despacho|en camino/i,
    descartar: "no-es-comprobante",
    porque: "Estado del pedido: el gasto llega con la boleta.",
  },
];
