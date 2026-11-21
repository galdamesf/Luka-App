import type { Campo, Plantilla } from "./motor";
import { FECHA, NUMERO_DE_CUENTA, PESOS, patron } from "./patrones";

/**
 * BancoEstado le avisa a quien recibe una transferencia de uno de sus
 * clientes. Ojo: la parte de texto de ese correo trae HTML adentro; la
 * normalizacion lo convierte igual.
 */

const QUIEN_TE_TRANSFIRIO: Campo = {
  patron: patron`instruida por nuestro cliente:?\s+(.+?)(?=\s+(?:Datos de la Operaci[oó]n|Nombre Destinatario)\b)`,
};

export const PLANTILLAS_BANCOESTADO: readonly Plantilla[] = [
  {
    id: "bancoestado/transferencia-recibida",
    remitentes: ["notificaciones@correo.bancoestado.cl"],
    asunto: /aviso\s+de\s+transferencia/i,
    contiene: /instruida\s+por\s+nuestro\s+cliente/i,
    fuente: "Aviso de BancoEstado",
    tipo: "ABONO",
    sentido: "ingreso",
    campos: {
      monto: { patron: patron`\bMonto:?\s*${PESOS}` },
      fecha: { patron: patron`Fecha de Pago:?\s*${FECHA}` },
      comercio: QUIEN_TE_TRANSFIRIO,
      medioPago: { fijo: "TRANSFERENCIA" },
      ultimos4: { patron: patron`\bNro\.?\s*(?:de\s+)?Cuenta:?\s*[*•xX]*\s*${NUMERO_DE_CUENTA}` },
      contraparte: { nombre: QUIEN_TE_TRANSFIRIO },
    },
  },
];
