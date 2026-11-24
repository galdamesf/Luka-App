import type { LecturaLeida, TipoMovimiento } from "@/dominio/comprobantes/tipos";
import type { MedioPago } from "@/dominio/esquemas";
import { pulirComercio } from "@/dominio/comprobantes/valores";
import type { CartolaLeida, FilaDeCartola } from "./tipos";

/**
 * De una fila de la cartola a la misma Lectura que entrega el lector de
 * comprobantes: asi pasa por las mismas reglas de los movimientos (que queda
 * fuera, que se junta, que se pregunta) que un correo.
 *
 * El lado de la fila dice si la plata salio o entro; la glosa dice que fue:
 *
 *   "Compra Nacional MD LIDER EXPRESS"        compra con la tarjeta de debito
 *   "Pagos Rec. Internacional MD NETFLIX"     cargo automatico a la tarjeta
 *   "Transf a Ana Rojas" / "Transf de ..."    transferencias
 *   "Giro Cajero Automatico"                  giro
 *   "Pago Tarjeta de Credito"                 pago de la tarjeta
 *   "RECUP COM PLAN MES ANT ..."              comisiones e impuestos del banco
 */

type Clase = { tipo: TipoMovimiento; comercio: string; medioPago?: MedioPago; contraparte?: string };

const COMPRA = /^(?:compras?|pagos?\s+rec\.?(?:urrentes?)?|pago\s+automatico|cargo\s+automatico)\s+(?:(?:nacional|internacional|nac\.?|int\.?)\s+)?(?:(?:md|mc|vd|vi|db|cd|tdb|tdc)\s+)?(.+)$/i;
const TRANSFERENCIA = /^transf(?:erencia)?\.?\s*(?:(?:a|de|desde|hacia|para)\s+)?(.+)$/i;
const GIRO = /^giro\b/i;
const PAGO_DE_TARJETA = /^pago\s+(?:de\s+)?(?:la\s+)?(?:tarjeta|tc\b|t\.?\s*cr[eé]dito|tarj)/i;
const DEL_BANCO = /\b(?:com(?:ision)?|recup\s+com|mantencion|impto|impuesto|intereses?|seguro|cargo\s+por)\b/i;

function clasificar(fila: FilaDeCartola, banco: string): Clase {
  const glosa = fila.descripcion.replace(/\s+/g, " ").trim();
  if (GIRO.test(glosa)) return { tipo: "GIRO", comercio: "Giro" };
  if (fila.lado === "cargo" && PAGO_DE_TARJETA.test(glosa)) return { tipo: "PAGO_TARJETA", comercio: `Pago de la tarjeta ${banco}` };

  const transferencia = TRANSFERENCIA.exec(glosa);
  if (transferencia && /^transf/i.test(glosa)) {
    const nombre = pulirComercio(transferencia[1]) ?? glosa;
    return fila.lado === "cargo"
      ? { tipo: "TRANSFERENCIA", comercio: nombre, medioPago: "TRANSFERENCIA", contraparte: nombre }
      : { tipo: "ABONO", comercio: nombre, contraparte: nombre };
  }

  if (fila.lado === "abono") return { tipo: "ABONO", comercio: glosa };

  const compra = COMPRA.exec(glosa);
  if (compra) return { tipo: "COMPRA", comercio: pulirComercio(compra[1]) ?? glosa, medioPago: "DEBITO" };
  // Lo que cobra el banco: con su nombre adelante, para que una sola regla los ordene a todos.
  if (DEL_BANCO.test(glosa)) return { tipo: "PAGO", comercio: `${banco} · ${glosa}` };
  return { tipo: "CARGO", comercio: glosa };
}

export const FUENTE_DE_LA_CARTOLA = (banco: string) => `Cartola de ${banco}`;

/** La lectura de una fila: con la cuenta de la cartola y la plantilla que la leyo. */
export function lecturaDeLaFila(fila: FilaDeCartola, cartola: Pick<CartolaLeida, "banco" | "plantilla" | "ultimos4">): LecturaLeida {
  const clase = clasificar(fila, cartola.banco);
  return {
    ok: true,
    tipo: clase.tipo,
    sentido: fila.lado === "cargo" ? "gasto" : "ingreso",
    monto: fila.monto,
    moneda: "CLP",
    fecha: fila.fecha,
    comercio: (pulirComercio(clase.comercio) ?? "Movimiento de la cartola").slice(0, 120),
    fuente: FUENTE_DE_LA_CARTOLA(cartola.banco),
    via: "plantilla",
    plantilla: cartola.plantilla,
    ultimos4: cartola.ultimos4,
    ...(clase.medioPago ? { medioPago: clase.medioPago } : {}),
    ...(clase.contraparte ? { contraparte: { nombre: clase.contraparte.slice(0, 120) } } : {}),
  };
}

/** La glosa como se compara entre dos cartolas: sin espacios de mas ni mayusculas. */
export function glosaNormal(descripcion: string): string {
  return descripcion
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Lo que identifica cada fila de una cartola, para que leer la misma cartola
 * dos veces (o otra version del mismo PDF) no la anote dos veces. Dos filas
 * iguales el mismo dia (dos cafes de $1.000) se distinguen por su orden.
 */
export function clavesDeLasFilas(cartola: Pick<CartolaLeida, "banco" | "ultimos4" | "filas">): string[] {
  const vistas = new Map<string, number>();
  return cartola.filas.map((fila) => {
    const base = ["cartola", cartola.banco, cartola.ultimos4, fila.fecha, fila.lado, fila.monto, glosaNormal(fila.descripcion), fila.documento ?? ""].join("|");
    const orden = vistas.get(base) ?? 0;
    vistas.set(base, orden + 1);
    return `${base}|${orden}`;
  });
}

/** Lo que identifica la cartola entera: la cuenta, su numero y el periodo. */
export function claveDeLaCartola(cartola: Pick<CartolaLeida, "banco" | "ultimos4" | "numero" | "desde" | "hasta">): string {
  return ["cartola", cartola.banco, cartola.ultimos4, cartola.numero ?? "", cartola.desde, cartola.hasta].join("|");
}
