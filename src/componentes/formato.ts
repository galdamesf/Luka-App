import { formatearCLP } from "@/lib/dinero";
import { sumarMeses } from "@/lib/fecha";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** "2026-10" -> "octubre 2026" */
export function nombreDelMes(mesISO: string): string {
  const [anio, mes] = mesISO.split("-");
  const indice = Number(mes) - 1;
  return `${MESES[indice] ?? mes} ${anio}`;
}

/** "2026-10" -> "oct 2026". Para cuando el nombre largo parte la linea. */
export function nombreDelMesCorto(mesISO: string): string {
  const [anio, mes] = mesISO.split("-");
  const nombre = MESES[Number(mes) - 1];
  return `${nombre?.slice(0, 3) ?? mes} ${anio}`;
}

/** "2026-10-27" -> "27 oct" */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  const nombre = MESES[Number(mes) - 1];
  return `${Number(dia)} ${nombre?.slice(0, 3) ?? mes}`;
}

/** Mes anterior y siguiente, para las flechas del selector. */
export function mesVecino(mesISO: string, salto: 1 | -1): string {
  return sumarMeses(mesISO, salto);
}

/**
 * Porcentaje para mostrar. Evita que algo que existe se vea como "0%", que
 * confunde: si hay monto pero redondea a cero, se muestra "<1%".
 */
export function porcentajeLegible(valor: number): string {
  if (valor === 0) return "0%";
  if (valor < 1) return "<1%";
  return `${Math.round(valor)}%`;
}

/**
 * Variacion para mostrar, con signo y coma decimal: "+4,2%", "−12%".
 * Un decimal bajo 10 y entero desde ahi, como en el resto de la app. El menos
 * es el signo tipografico (U+2212), no el guion. null es "no hay con que
 * comparar" y se muestra como raya, no como cero.
 */
export function variacionLegible(valor: number | null): string {
  if (valor === null) return "—";
  const absoluto = Math.abs(valor);
  const cifra =
    absoluto < 10 ? absoluto.toFixed(1).replace(".", ",") : String(Math.round(absoluto));
  if (cifra === "0,0") return "0%";
  return `${valor > 0 ? "+" : "−"}${cifra}%`;
}

export { formatearCLP };

/**
 * Une nombres en algo que se pueda leer en voz alta: "Ropa", "Ropa y Café",
 * "Ropa, Café y Feria", "Ropa, Café, Feria y 2 más".
 *
 * El corte existe porque estos nombres van en un aviso de una linea: con
 * catorce categorias al limite, listarlas todas tapa el aviso en vez de
 * darlo.
 */
export function listaLegible(nombres: readonly string[], tope = 3): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0] as string;

  if (nombres.length > tope) {
    const sobran = nombres.length - tope;
    return `${nombres.slice(0, tope).join(", ")} y ${sobran} más`;
  }

  const ultimo = nombres[nombres.length - 1] as string;
  return `${nombres.slice(0, -1).join(", ")} y ${ultimo}`;
}
