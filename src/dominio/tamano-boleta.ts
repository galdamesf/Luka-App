/**
 * Cuanto puede pesar una boleta y que se hace en el navegador con un archivo
 * mas pesado, antes de subirlo. Logica pura: la usan el campo de la boleta
 * (en el navegador) y la validacion del servidor (src/lib/boletas.ts).
 *
 * En la nube, Vercel no acepta envios de mas de 4,5 MB, y el formulario
 * lleva tambien los otros campos: por eso el tope es 4 MB.
 */

export const TAMANO_MAXIMO_BOLETA = 4 * 1024 * 1024;

/** Desde cuanto una foto se achica en el navegador: deja aire bajo el tope. */
export const ACHICAR_DESDE = 3 * 1024 * 1024;

/** El lado mas largo de una foto achicada: de sobra para leer una boleta. */
export const LADO_MAXIMO = 2400;

/** Las fotos que el navegador puede volver a dibujar como JPG. Un PDF no. */
const FOTOS = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export type QueHacerConLaBoleta = "subir" | "achicar" | "rechazar";

export function queHacerConLaBoleta(tipo: string, tamano: number): QueHacerConLaBoleta {
  if (tamano <= ACHICAR_DESDE) return "subir";
  if (FOTOS.has(tipo)) return "achicar";
  return tamano > TAMANO_MAXIMO_BOLETA ? "rechazar" : "subir";
}

/** "3,2 MB", como se le muestra a la persona. */
export function megas(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
}

/** El nombre de la foto achicada: el mismo, terminado en .jpg. */
export function nombreAchicado(nombre: string): string {
  const base = nombre.replace(/\.[^.\/\\]*$/, "").trim() || "boleta";
  return `${base}.jpg`;
}
