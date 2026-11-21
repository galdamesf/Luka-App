import { MONTO_MAXIMO, type MedioPago } from "@/dominio/esquemas";
import { fechaDesdeISO, hoyISO } from "@/lib/fecha";
import type { Moneda } from "./tipos";

/**
 * Montos, fechas y numeros de cuenta como los escriben los bancos y las tiendas
 * de Chile. Si algo no se entiende con seguridad se devuelve null: es mejor un
 * "no se pudo leer" que un monto o una fecha inventados.
 */

export type MontoLeido = { monto: number; moneda: Moneda };

const DOLARES = /US\$|U\$S|\bUSD\b|d[oó]lares?/i;

/** "1.234.567" o "1.234.567,8": la forma chilena. */
const MILES_CON_PUNTO = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
/** "1,234,567" o "1,234,567.89": la forma gringa. */
const MILES_CON_COMA = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
const DECIMAL_CON_COMA = /^\d+,\d{1,2}$/;
const DECIMAL_CON_PUNTO = /^\d+\.\d{1,2}$/;

/**
 * Lee el primer monto de un texto: "$ 300.000", "$ 14.900,0", "US$ 12,99".
 *
 * En pesos devuelve pesos enteros (Bsale escribe "14.900,0", que son 14900);
 * en dolares, centavos. La moneda se deduce del texto si no se dice.
 */
export function leerMonto(texto: string, moneda?: Moneda): MontoLeido | null {
  const numero = /\d(?:[\d.,]*\d)?/.exec(texto)?.[0];
  if (numero === undefined) return null;

  const valor = valorDe(numero);
  if (valor === null) return null;

  const enDolares = (moneda ?? (DOLARES.test(texto) ? "USD" : "CLP")) === "USD";
  const monto = Math.round(enDolares ? valor * 100 : valor);
  if (!Number.isSafeInteger(monto) || monto <= 0 || monto > MONTO_MAXIMO) return null;

  return { monto, moneda: enDolares ? "USD" : "CLP" };
}

function valorDe(numero: string): number | null {
  if (/^\d+$/.test(numero)) return Number(numero);
  if (MILES_CON_PUNTO.test(numero)) return Number(numero.replaceAll(".", "").replace(",", "."));
  if (MILES_CON_COMA.test(numero)) return Number(numero.replaceAll(",", ""));
  if (DECIMAL_CON_COMA.test(numero)) return Number(numero.replace(",", "."));
  if (DECIMAL_CON_PUNTO.test(numero)) return Number(numero);
  return null;
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const ISO = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
/** Dia primero, como en Chile: 20/11/2026, 16-10-2026, 29.10.26. */
const NUMERICA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
/** 20 de noviembre de 2026, 20 nov 2026, 20-nov-2026. */
const CON_MES = /\b(\d{1,2})(?:\s+de)?[\s.-]+([a-záéíóú]{3,10})\.?(?:\s+del?)?[\s.,-]+(\d{4})\b/gi;
/** Nov 20, 2026: como lo escribe Gmail en ingles al reenviar. */
const MES_PRIMERO = /\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;

/**
 * Lee la primera fecha de un texto y la deja en AAAA-MM-DD. Las fechas con
 * numeros se leen con el dia primero. Devuelve null si no hay una fecha que
 * exista (un 31 de febrero no sirve).
 */
export function leerFecha(texto: string): string | null {
  for (const m of texto.matchAll(ISO)) {
    const fecha = armarFecha(Number(m[1]), Number(m[2]), Number(m[3]));
    if (fecha) return fecha;
  }
  for (const m of texto.matchAll(NUMERICA)) {
    const anio = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const fecha = armarFecha(anio, Number(m[2]), Number(m[1]));
    if (fecha) return fecha;
  }
  for (const m of texto.matchAll(CON_MES)) {
    const mes = MESES[m[2]!.toLowerCase()];
    const fecha = mes ? armarFecha(Number(m[3]), mes, Number(m[1])) : null;
    if (fecha) return fecha;
  }
  for (const m of texto.matchAll(MES_PRIMERO)) {
    const mes = MESES[m[1]!.toLowerCase()];
    const fecha = mes ? armarFecha(Number(m[3]), mes, Number(m[2])) : null;
    if (fecha) return fecha;
  }
  return null;
}

function armarFecha(anio: number, mes: number, dia: number): string | null {
  if (anio < 2000 || anio > 2100) return null;
  const iso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  try {
    fechaDesdeISO(iso);
    return iso;
  } catch {
    return null;
  }
}

/** El dia en Chile en que llego un correo. */
export function fechaEnChile(momento: Date): string {
  return hoyISO("America/Santiago", momento);
}

/**
 * Un comercio o un nombre como se va a mostrar: espacios parejos, sin comas ni
 * dos puntos sueltos en los bordes, y que quepa en la columna (120).
 */
export function pulirComercio(texto: string | undefined, maximo = 120): string | undefined {
  const pulido = texto
    ?.replace(/\s+/g, " ")
    .replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, "")
    .slice(0, maximo)
    .trim();
  return pulido ? pulido : undefined;
}

/** "0-000-12-34567-8" -> "5678". Undefined si no hay 4 digitos. */
export function ultimosCuatro(texto: string | undefined): string | undefined {
  const digitos = texto?.replace(/\D/g, "") ?? "";
  return digitos.length >= 4 ? digitos.slice(-4) : undefined;
}

/** "TARJETA DE DEBITO" -> "DEBITO". Undefined si no se sabe. */
export function leerMedioPago(texto: string | undefined): MedioPago | undefined {
  if (!texto) return undefined;
  if (/cr[eé]dito/i.test(texto)) return "CREDITO";
  if (/d[eé]bito|redcompra|\bDB\b/i.test(texto)) return "DEBITO";
  if (/efectivo/i.test(texto)) return "EFECTIVO";
  if (/transferencia/i.test(texto)) return "TRANSFERENCIA";
  return undefined;
}
