"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/dominio/formulario";
import { ErrorDeCartola, guardarClaveDeCartola, leerCartolaEnPdf, quitarClaveDeCartola, type ResumenDeCartola } from "@/datos/cartolas";
import { hogarActual } from "@/lib/hogar-actual";

// La cartola del mes, desde «Tus bancos y tarjetas» en Hogar: la clave de su
// PDF y subir una a mano.
//
// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

/** Lo que deja pasar Vercel por formulario es 4,5 MB; una cartola pesa unos cientos de KB. */
const CARTOLA_MAXIMA = 4 * 1024 * 1024;

function fallo(error: unknown): EstadoFormulario {
  if (!(error instanceof ErrorDeCartola)) console.error("No se pudo completar la accion de la cartola:", error);
  const mensaje = error instanceof ErrorDeCartola ? error.message : "No se pudo hacer. Intenta de nuevo.";
  return { ok: false, mensaje, errores: {} };
}

const LISTO = (mensaje: string): EstadoFormulario => ({ ok: true, mensaje, errores: {} });

function refrescar() {
  revalidatePath("/hogar");
  revalidatePath("/");
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** "5 quedaron en «Por revisar», 9 ya estaban anotados y 5 quedaron fuera (ingresos y traspasos)." */
function loQuePaso(cartola: ResumenDeCartola): string {
  const partes = [
    `${plural(cartola.nuevas, "quedó", "quedaron")} en «Por revisar»`,
    `${plural(cartola.yaEstaban, "ya estaba anotado", "ya estaban anotados")}`,
  ];
  if (cartola.fuera > 0) partes.push(`${plural(cartola.fuera, "quedó", "quedaron")} fuera (ingresos, traspasos y giros)`);
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}.`;
}

export async function accionGuardarClaveDeCartola(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  let banco: string;
  try {
    ({ banco } = await guardarClaveDeCartola(hogarId, miembroId, String(datos.get("banco") ?? ""), String(datos.get("clave") ?? "")));
  } catch (error) {
    return fallo(error);
  }
  refrescar();
  return LISTO(`Listo. Las cartolas de ${banco} que lleguen a tu dirección de Luka se van a leer solas.`);
}

export async function accionQuitarClaveDeCartola(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  try {
    // Desde el cuadro de confirmar, el banco llega como "id".
    await quitarClaveDeCartola(hogarId, miembroId, String(datos.get("banco") ?? datos.get("id") ?? ""));
  } catch (error) {
    return fallo(error);
  }
  refrescar();
  return LISTO("Listo, Luka olvidó esa clave.");
}

export async function accionSubirCartola(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const archivo = datos.get("cartola");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, mensaje: "Elige el PDF de la cartola.", errores: {} };
  }
  if (archivo.size > CARTOLA_MAXIMA) {
    return { ok: false, mensaje: "El archivo pesa más de 4 MB: no parece una cartola.", errores: {} };
  }

  let resultado: Awaited<ReturnType<typeof leerCartolaEnPdf>>;
  try {
    resultado = await leerCartolaEnPdf(hogarId, {
      pdf: new Uint8Array(await archivo.arrayBuffer()),
      miembroId,
      clave: String(datos.get("clave") ?? ""),
      recordarClave: datos.get("recordar") === "on",
    });
  } catch (error) {
    return fallo(error);
  }
  if (!resultado.ok) {
    const pideClave = resultado.motivo === "falta-la-clave" || resultado.motivo === "clave-incorrecta";
    return { ok: false, mensaje: resultado.mensaje, errores: pideClave ? { clave: [resultado.mensaje] } : {} };
  }
  refrescar();
  const { cartola } = resultado;
  if (resultado.yaLeida) return LISTO(`Esa cartola ya estaba leída: no se anotó nada de nuevo.`);
  return LISTO(`Listo: la cartola trae ${plural(cartola.filas, "movimiento", "movimientos")}. ${loQuePaso(cartola)}`);
}
