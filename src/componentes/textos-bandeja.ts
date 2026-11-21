import type { ItemDejadoFuera, ItemPorRevisar } from "@/dominio/bandeja";
import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { TEXTO_DEL_MOTIVO } from "@/dominio/movimientos";
import { diasEntre } from "@/lib/periodo";
import { diaDeLaSemana, fechaCorta, formatearCLP, nombreDelMes } from "./formato";

/**
 * Los textos de la bandeja «Por revisar»: cuando fue, con que se pago, y que
 * dice cada movimiento sobre lo que Luka propone. Aparte del componente para
 * poder probarlos sin dibujar nada.
 */

const FORMATO_USD = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** "$23.480" o, si es en dolares, "US$15,99". */
export function montoDe(item: Pick<ItemPorRevisar, "monto" | "moneda">): string {
  return item.moneda === "USD" ? FORMATO_USD.format(item.monto / 100) : formatearCLP(item.monto);
}

/** "Hoy", "Ayer", "Jueves 19" esta semana, y despues "19 nov". */
export function cuandoFue(fecha: string, hoy: string): string {
  const dias = diasEntre(fecha, hoy);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias > 1 && dias < 7) {
    const dia = diaDeLaSemana(fecha);
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${Number(fecha.slice(8, 10))}`;
  }
  return fechaCorta(fecha);
}

/** "Crédito •••• 4821", "Transferencia", "•••• 5678", o null si el comprobante no dice. */
export function medioDe(item: Pick<ItemPorRevisar, "medioPago" | "ultimos4">): string | null {
  const tarjeta = item.ultimos4 === null ? null : `•••• ${item.ultimos4}`;
  if (item.medioPago === null) return tarjeta;
  const medio = ETIQUETA_MEDIO_PAGO[item.medioPago];
  return tarjeta === null || item.medioPago === "TRANSFERENCIA" ? medio : `${medio} ${tarjeta}`;
}

export type Ficha = { texto: string; tono: "alerta" | "acento" | "neutro" };

/**
 * Lo primero que dice cada movimiento: por que esta asi. Ambar si hay una
 * pregunta (un posible duplicado, una compra en cuotas), durazno si Luka
 * necesita que se mire algo, gris si esta listo. `categoria` es el nombre de
 * la que se propone, para decir «Tu regla: Copec → Bencina».
 */
export function fichaDe(item: ItemPorRevisar, categoria: string | null = null): Ficha {
  const { propuesta, avisos } = item.revision;
  const sugerida = item.revision.categoria;
  const hacia = categoria === null ? "" : ` → ${categoria}`;
  if (propuesta.como === "deuda") return { texto: `Compra en ${propuesta.deuda.cuotas} cuotas`, tono: "alerta" };
  if (propuesta.como === "mismo-gasto") return { texto: "Posible duplicado", tono: "alerta" };
  if (propuesta.como === "pago-de-cuenta") return { texto: "Pago de una cuenta", tono: "acento" };
  if (propuesta.como === "pago-de-cuota") return { texto: "Pago de una cuota", tono: "acento" };
  if (avisos.includes("estaba-fuera")) return { texto: "Lo anotas aunque Luka lo dejó fuera", tono: "acento" };
  if (avisos.includes("dolares")) return { texto: "En dólares: anota cuánto fue en pesos", tono: "acento" };
  if (avisos.includes("ia")) return { texto: "Leído con IA: revisa los datos", tono: "acento" };
  if (avisos.includes("sin-detalle")) return { texto: "Aviso sin detalle", tono: "acento" };
  if (sugerida?.porque === "regla") return { texto: `Tu regla: ${sugerida.de}${hacia}`, tono: "neutro" };
  if (sugerida?.porque === "historial") {
    return { texto: categoria === null ? "Como la última vez" : `Como la última vez: ${categoria}`, tono: "neutro" };
  }
  if (item.revision.clave !== null) return { texto: "Comercio nuevo: elige su categoría", tono: "acento" };
  return { texto: "Elige su categoría", tono: "acento" };
}

/** La linea que explica la ficha, cuando hace falta. */
export function detalleDe(item: ItemPorRevisar, hoy: string): string | null {
  const { propuesta, avisos } = item.revision;
  switch (propuesta.como) {
    case "deuda": {
      const desde = nombreDelMes(propuesta.deuda.primeraCuota).split(" ")[0];
      return `${propuesta.deuda.cuotas} cuotas de ${formatearCLP(propuesta.deuda.montoCuota)} desde ${desde}: en Luka una cuota no es un gasto, es una deuda.`;
    }
    case "mismo-gasto": {
      const { gasto } = propuesta;
      const cuando = cuandoFue(gasto.fecha, hoy).toLowerCase();
      if (gasto.pagoDe?.tipo === "cuenta") {
        return `Ya pagaste «${gasto.pagoDe.nombre}» por ${formatearCLP(gasto.monto)} (${cuando}).`;
      }
      if (gasto.pagoDe?.tipo === "cuota") {
        return `Ya pagaste la cuota de «${gasto.pagoDe.nombre}» por ${formatearCLP(gasto.monto)} (${cuando}).`;
      }
      const anotaste = cuando === "hoy" || cuando === "ayer" ? `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)} anotaste` : `El ${cuando} anotaste`;
      return `${anotaste} «${gasto.descripcion}» por ${formatearCLP(gasto.monto)}.`;
    }
    case "pago-de-cuenta":
      return propuesta.cuenta.monto === item.monto
        ? `Parece el pago de «${propuesta.cuenta.nombre}», que tenías por pagar.`
        : `Parece el pago de «${propuesta.cuenta.nombre}», que tenías en ${formatearCLP(propuesta.cuenta.monto)}.`;
    case "pago-de-cuota":
      return `Parece la cuota ${propuesta.cuota.numero} de ${propuesta.cuota.de} de «${propuesta.cuota.nombre}».`;
    case "gasto":
      if (avisos.includes("sin-detalle")) {
        return "El banco no dice con quién. Si llega el comprobante, se juntan solos; si no, ponle un nombre.";
      }
      if (avisos.includes("ia") && item.confianza !== null && item.confianza < 0.7) {
        return "Luka no está segura de esta lectura: mira el monto y la fecha.";
      }
      return null;
  }
}

/** "También llegó: Aviso de cargo de Consorcio. Es el mismo movimiento: cuenta una vez." */
export function textoJuntados(juntados: readonly string[]): string | null {
  if (juntados.length === 0) return null;
  return `También llegó: ${juntados.join(", ")}. Es el mismo movimiento: cuenta una vez.`;
}

export function porQueQuedoFuera(item: ItemDejadoFuera): string {
  return TEXTO_DEL_MOTIVO[item.motivo];
}
