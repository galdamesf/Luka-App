/**
 * Pedazos de patron que se repiten entre plantillas. Van como texto para
 * poder armarlos con `patron`, que deja cada barra invertida tal cual.
 */

/** Arma un patron que no distingue mayusculas: patron`Monto:?\s*${PESOS}`. */
export function patron(partes: TemplateStringsArray, ...pedazos: string[]): RegExp {
  return new RegExp(String.raw(partes, ...pedazos), "i");
}

/** "$ 300.000", "$14.900,0": el grupo es el numero. */
export const PESOS = String.raw`\$\s*(\d[\d.]*(?:,\d+)?)`;

/** Igual, pero el signo puede no estar: "TOTAL 34.990". */
export const PESOS_SIN_SIGNO = String.raw`\$?\s*(\d[\d.]*(?:,\d+)?)`;

/** 20/11/2026, 16-10-2026, 29.10.26, sin grupo. */
export const FECHA_SUELTA = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}`;

/** Con el grupo, y tambien 2026-02-20, como escribe Consorcio. */
export const FECHA = String.raw`(\d{4}-\d{1,2}-\d{1,2}|${FECHA_SUELTA})`;

/** "0-000-12-34567-8": digitos con guiones o espacios, el grupo entero. */
export const NUMERO_DE_CUENTA = String.raw`(\d[\d -]*\d)`;

/** "Nº de cuenta", "N° de cuenta", "Nro. de cuenta". */
export const N_DE_CUENTA = String.raw`\bN(?:[º°]|ro\.?|o\.?)?\s*de\s+cuenta`;
