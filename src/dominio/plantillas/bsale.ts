import type { Plantilla } from "./motor";
import { FECHA, PESOS, patron } from "./patrones";

/**
 * Bsale es el sistema de boletas de muchas tiendas chicas: el mismo formato
 * sirve para todas. El comercio va en el asunto, antes de los dos puntos
 * ("COMERCIAL LOS AROMOS SPA: BOLETA ELECTRÓNICA T Nº 4521"). En una boleta la
 * "fecha de vencimiento" es el dia de la compra.
 */
export const PLANTILLAS_BSALE: readonly Plantilla[] = [
  {
    id: "bsale/boleta",
    remitentes: ["@bsale.app", "@bsale.cl"],
    asunto: /BOLETA\s+ELECTR[ÓOóo]NICA/i,
    fuente: "Boleta electrónica (Bsale)",
    tipo: "BOLETA",
    sentido: "gasto",
    campos: {
      monto: { patron: patron`por un monto de:?\s*${PESOS}` },
      fecha: { patron: patron`fecha de (?:vencimiento|emisi[oó]n) es el\s+${FECHA}` },
      comercio: { patron: patron`^(.+?)\s*:\s*BOLETA\s+ELECTR[ÓOóo]NICA`, en: "asunto" },
    },
  },
];
