import type { MedioPago } from "@/dominio/esquemas";

/**
 * El lector de comprobantes: dominio puro, sin Prisma ni red.
 *
 * Un comprobante es un correo de un banco o de una tienda que llega al buzon
 * de Luka, reenviado por alguien del hogar. El lector lo convierte en una
 * Lectura: que paso, cuanto, cuando y con quien. Que se hace despues con esa
 * lectura (si cuenta como gasto, si es un duplicado, si es una cuota, si es un
 * traspaso entre cuentas propias) lo deciden las reglas de los movimientos,
 * no el lector.
 */

/** Los mismos valores del enum TipoMovimiento de Prisma. */
export const TIPOS_MOVIMIENTO = [
  /** Aviso del banco de una compra con tarjeta. */
  "COMPRA",
  /** Transferiste a otra persona o empresa. */
  "TRANSFERENCIA",
  /** Pagaste una cuenta o un servicio (luz, agua, boton de pago). */
  "PAGO",
  /** Boleta o factura de una tienda. */
  "BOLETA",
  /** Pagaste el estado de cuenta de la tarjeta de credito. */
  "PAGO_TARJETA",
  /** Entre tus cuentas o dentro del hogar. Lo decide una regla, nunca el lector. */
  "TRASPASO_PROPIO",
  /** Te transfirieron o te depositaron. */
  "ABONO",
  /** Sacaste plata del cajero. */
  "GIRO",
  /**
   * Un cargo en tu cuenta que el aviso no explica: puede ser una compra, una
   * transferencia o una comision. Consorcio lo manda junto con el comprobante
   * de cada transferencia.
   */
  "CARGO",
] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/**
 * Para donde va la plata: "gasto" si sale, "ingreso" si entra, "ninguno" si
 * no se mueve. Que algo salga no significa que cuente como gasto del mes: el
 * pago de la tarjeta sale y se ignora, porque cada compra ya conto.
 */
export type Sentido = "gasto" | "ingreso" | "ninguno";

export type Moneda = "CLP" | "USD";

export type Adjunto = {
  nombre: string;
  /** El tipo MIME, por ejemplo "application/pdf". */
  tipo: string;
  /** El texto del adjunto, si se pudo sacar. Un PDF con clave no trae. */
  texto?: string;
};

export type Comprobante = {
  /** El remitente original: el banco o la tienda. */
  remitente: string;
  /** El correo registrado del miembro que lo reenvio. */
  reenviadoPor: string;
  asunto: string;
  recibido: Date;
  /** El cuerpo del correo. Si viene en HTML, el lector lo pasa a texto. */
  texto: string;
  adjuntos?: Adjunto[];
};

/** Con quien fue el movimiento, si el correo lo dice. */
export type Contraparte = {
  nombre?: string;
  banco?: string;
  /** Los ultimos 4 digitos de su cuenta. Nunca el numero completo. */
  ultimos4?: string;
};

export type LecturaLeida = {
  ok: true;
  tipo: TipoMovimiento;
  sentido: Sentido;
  /**
   * Entero, en la unidad minima de la moneda: pesos si es CLP (como
   * Gasto.monto), centavos si es USD.
   */
  monto: number;
  moneda: Moneda;
  /** AAAA-MM-DD, el dia del movimiento en Chile. */
  fecha: string;
  comercio: string;
  /** De donde vino, para mostrarlo: "Comprobante de Santander". */
  fuente: string;
  via: "plantilla" | "ia";
  /** Que plantilla lo leyo, para saber cual arreglar si un banco cambia el formato. */
  plantilla?: string;
  /** De 0 a 1. Solo si lo leyo la IA. */
  confianza?: number;
  cuotas?: number;
  medioPago?: MedioPago;
  /** Los ultimos 4 digitos de tu cuenta o tarjeta, para saber cual fue. */
  ultimos4?: string;
  contraparte?: Contraparte;
  /**
   * Un aviso de cargo o de abono que no dice con quien. Puede ser el mismo
   * movimiento que otro comprobante que si lo dice (Consorcio avisa el cargo y
   * ademas manda el comprobante de la transferencia): las reglas de los
   * movimientos los juntan para no contarlo dos veces.
   */
  sinDetalle?: true;
  /**
   * Llego reenviado a mano: el remitente original sale del texto del correo,
   * no de su firma, asi que nunca se confirma solo.
   */
  reenviadoAMano?: true;
};

export type MotivoSinLectura =
  /** Publicidad, avisos de seguridad, estados de un pedido. */
  | "no-es-comprobante"
  /** Parece un comprobante pero no se pudo sacar el monto, la fecha o el comercio. */
  | "no-se-pudo-leer"
  /** La cartola o el estado de cuenta del mes: se lee aparte, con su clave. */
  | "es-cartola";

export type SinLectura = {
  ok: false;
  motivo: MotivoSinLectura;
  /** Por que, en palabras, para el registro del buzon. */
  detalle?: string;
};

export type Lectura = LecturaLeida | SinLectura;

/** Primero las plantillas; si ninguna sirve, la IA. Siempre la misma Lectura. */
export type Lector = (comprobante: Comprobante) => Promise<Lectura>;
