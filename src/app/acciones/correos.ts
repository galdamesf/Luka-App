"use server";

import { revalidatePath } from "next/cache";
import { esquemaId } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import {
  ErrorDeCorreo,
  agregarCorreo,
  confirmarCorreo,
  pedirCodigoDeCorreo,
  quitarCorreo,
} from "@/datos/correos-registrados";
import {
  ErrorDelBuzon,
  cambiarMiDireccion,
  olvidarCodigoDeGmail,
  revisarElBuzon,
  type ResumenDeRevision,
} from "@/datos/buzon";
import { configuracionDelBuzon } from "@/lib/buzon";
import { hogarActual } from "@/lib/hogar-actual";

// Los correos donde a cada persona le llegan comprobantes y su direccion de
// Luka, desde «Tus correos y tu buzón» en Hogar. Cada persona maneja solo los
// suyos: todo va con su miembro, nunca con lo que mande el navegador.
//
// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

function fallo(error: unknown): EstadoFormulario {
  const conocido = error instanceof ErrorDeCorreo || error instanceof ErrorDelBuzon;
  if (!conocido) console.error("No se pudo completar la accion de correos:", error);
  return { ok: false, mensaje: conocido ? error.message : "No se pudo hacer. Intenta de nuevo.", errores: {} };
}

const LISTO = (mensaje: string): EstadoFormulario => ({ ok: true, mensaje, errores: {} });
const SIN_ID: EstadoFormulario = { ok: false, mensaje: "No pude identificar el correo. Recarga la página.", errores: {} };

export async function accionAgregarCorreo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  let direccion: string;
  try {
    direccion = (await agregarCorreo(hogarId, miembroId, String(datos.get("correo") ?? ""))).direccion;
  } catch (error) {
    revalidatePath("/hogar");
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Te mandamos un código a ${direccion}. Escríbelo aquí para confirmarlo.`);
}

export async function accionPedirCodigoDeCorreo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return SIN_ID;
  let direccion: string;
  try {
    direccion = (await pedirCodigoDeCorreo(hogarId, miembroId, id.data)).direccion;
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Te mandamos otro código a ${direccion}.`);
}

export async function accionConfirmarCorreo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return SIN_ID;
  let direccion: string;
  try {
    direccion = (await confirmarCorreo(hogarId, miembroId, id.data, String(datos.get("codigo") ?? ""))).direccion;
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Listo: ${direccion} quedó confirmado. Lo que reenvíe a tu dirección de Luka se va a leer.`);
}

export async function accionQuitarCorreo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return SIN_ID;
  let direccion: string;
  try {
    direccion = (await quitarCorreo(hogarId, miembroId, id.data)).direccion;
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`${direccion} ya no está conectado.`);
}

/** El resumen de una revision, en palabras. */
function contarRevision(resumen: ResumenDeRevision): string {
  if (resumen.revisados === 0) return "Revisé el buzón: no hay correos nuevos.";
  const partes = [
    resumen.nuevos > 0 ? (resumen.nuevos === 1 ? "1 comprobante nuevo" : `${resumen.nuevos} comprobantes nuevos`) : null,
    resumen.cartolas > 0 ? (resumen.cartolas === 1 ? "1 cartola leída" : `${resumen.cartolas} cartolas leídas`) : null,
    resumen.repetidos > 0 ? (resumen.repetidos === 1 ? "1 que ya había llegado" : `${resumen.repetidos} que ya habían llegado`) : null,
    resumen.sinMovimiento > 0 ? (resumen.sinMovimiento === 1 ? "1 que no era un comprobante" : `${resumen.sinMovimiento} que no eran comprobantes`) : null,
    resumen.rechazados > 0 ? (resumen.rechazados === 1 ? "1 desde un correo sin confirmar" : `${resumen.rechazados} desde correos sin confirmar`) : null,
    resumen.pendientes > 0 ? `${resumen.pendientes} para la próxima` : null,
    resumen.esperanClave > 0
      ? `${resumen.esperanClave === 1 ? "1 cartola que espera" : `${resumen.esperanClave} cartolas que esperan`} la clave de su PDF (guárdala en «Tus bancos y tarjetas»)`
      : null,
  ].filter((p): p is string => p !== null);
  return partes.length === 0 ? "Revisé el buzón: todo al día." : `Revisé el buzón: ${partes.join(", ")}.`;
}

export async function accionRevisarBuzon(_previo: EstadoFormulario, _datos: FormData): Promise<EstadoFormulario> {
  await hogarActual();
  let resumen: ResumenDeRevision;
  try {
    resumen = await revisarElBuzon();
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  revalidatePath("/");
  return LISTO(contarRevision(resumen));
}

export async function accionCambiarMiDireccion(_previo: EstadoFormulario, _datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const config = configuracionDelBuzon();
  if (config === null) return { ok: false, mensaje: "El buzón de Luka todavía no está configurado.", errores: {} };
  let direccion: string;
  try {
    direccion = await cambiarMiDireccion(hogarId, miembroId, config.direccion);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Tu dirección nueva es ${direccion}. Cámbiala también en el filtro o la regla de tu correo.`);
}

export async function accionOlvidarCodigoDeGmail(_previo: EstadoFormulario, _datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  try {
    await olvidarCodigoDeGmail(hogarId, miembroId);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO("Listo.");
}
