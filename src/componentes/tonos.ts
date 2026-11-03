import type { ClaveFactor } from "@/dominio/salud";
import type { NombreIcono } from "./iconos";

/**
 * Los tonos de identidad (--tono-* en globals.css) como clases enteras:
 * Tailwind solo genera las que ve escritas completas, nunca las armadas con
 * un template.
 *
 * Son para lo que no es bueno ni malo, solo distinto: un factor del Health
 * Score, una cifra de la semana. Lo bueno y lo malo siguen siendo verde,
 * ambar y rojo (--exito, --alerta, --peligro).
 */
export type Tono = "esmeralda" | "violeta" | "cielo" | "fucsia" | "naranja";

type ClasesTono = {
  /** Ficha solida con el icono en blanco. */
  ficha: string;
  /** Relleno de barra o franja. */
  barra: string;
  /** El color con que se enciende al pasar el mouse (.tarjeta-viva / .fila-viva). */
  viva: string;
};

export const TONOS: Record<Tono, ClasesTono> = {
  esmeralda: { ficha: "bg-tono-esmeralda text-white", barra: "bg-tono-esmeralda", viva: "viva-esmeralda" },
  violeta: { ficha: "bg-tono-violeta text-white", barra: "bg-tono-violeta", viva: "viva-violeta" },
  cielo: { ficha: "bg-tono-cielo text-white", barra: "bg-tono-cielo", viva: "viva-cielo" },
  fucsia: { ficha: "bg-tono-fucsia text-white", barra: "bg-tono-fucsia", viva: "viva-fucsia" },
  naranja: { ficha: "bg-tono-naranja text-white", barra: "bg-tono-naranja", viva: "viva-naranja" },
};

/**
 * Cada factor del Health Score con su color y su icono. Fijos por factor,
 * no por puntaje: el ahorro es esmeralda este mes y el que viene, suba o
 * baje. Si el factor anda mal, lo dice la barra en ambar o rojo.
 */
export const IDENTIDAD_FACTOR: Record<ClaveFactor, { tono: Tono; icono: NombreIcono }> = {
  ahorro: { tono: "esmeralda", icono: "piggy-bank" },
  presupuestos: { tono: "violeta", icono: "wallet" },
  cuentas: { tono: "cielo", icono: "receipt" },
  deuda: { tono: "fucsia", icono: "credit-card" },
  ritmo: { tono: "naranja", icono: "activity" },
};
