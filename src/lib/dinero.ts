/** Formateo de montos en pesos chilenos. */

const FORMATO_CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const FORMATO_NUMERO = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
});

/** 45990 -> "$45.990" */
export function formatearCLP(monto: number): string {
  return FORMATO_CLP.format(monto);
}

/** 45990 -> "45.990" (sin simbolo, para tablas con encabezado en pesos) */
export function formatearNumero(monto: number): string {
  return FORMATO_NUMERO.format(monto);
}

/**
 * Lee un monto escrito a mano y lo deja en pesos enteros.
 * Acepta "45990", "45.990", "$45.990", "45 990". Devuelve null si no se puede.
 *
 * Por omision el cero no vale, porque un gasto de cero no es un gasto. Con
 * `permitirCero` si vale: un sueldo de cero es un mes sin ingresos, que para
 * alguien que trabaja a honorarios es una situacion real.
 */
export function parsearMonto(
  entrada: string,
  opciones: { permitirCero?: boolean } = {},
): number | null {
  const limpio = entrada.replace(/[^\d]/g, "");
  if (limpio === "") return null;

  const valor = Number(limpio);
  if (!Number.isSafeInteger(valor)) return null;
  if (valor < 0) return null;
  if (valor === 0 && opciones.permitirCero !== true) return null;

  return valor;
}
