"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import {
  ErrorDeDosPasos,
  confirmarConfiguracion,
  elegirSinDosPasos,
  verificarCodigo,
} from "@/datos/dos-pasos";
import { RUTA_ELEGIR, RUTA_VERIFICAR, type EstadoConCodigos } from "@/dominio/dos-pasos";
import type { EstadoFormulario } from "@/dominio/formulario";
import { FaltaClaveDosPasos } from "@/lib/dos-pasos";
import { RUTA_SESION_TERMINADA, leerAcceso } from "@/lib/hogar-actual";

// Las acciones del segundo paso. No pueden pedir hogarActual(): esa es la
// puerta que estan abriendo. Cada una revisa primero, con leerAcceso(), que
// la persona este justo en el paso que le toca, fuera de cualquier try: las
// redirecciones no deben convertirse en mensajes de error.

/** Adonde se llega despues del segundo paso: el panel, con el saludo. */
const AL_ENTRAR = "/?bienvenida=1";

/**
 * «Ahora no», al entrar: entra solo con Google y Luka no se lo vuelve a
 * preguntar. La verificacion se puede activar despues en «Tu hogar».
 */
export async function accionAhoraNo(): Promise<void> {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion" || acceso.hogar === null) redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.estado === "elegir") await elegirSinDosPasos(acceso.hogar.miembroId);
  redirect(AL_ENTRAR);
}

function fallo(error: unknown): string {
  if (error instanceof ErrorDeDosPasos) return error.message;
  if (error instanceof FaltaClaveDosPasos) {
    return "La verificación en dos pasos no está configurada en Luka (falta CLAVE_DOS_PASOS). Avísale a quien administra Luka.";
  }
  console.error("Fallo el segundo paso:", error);
  return "No se pudo revisar el código. Intenta de nuevo.";
}

/**
 * El primer codigo de la app recien escaneada: la deja configurada y entrega
 * los codigos de respaldo. Sirve al entrar (si eligio activarla) y desde «Tu
 * hogar», para quien entra solo con Google.
 */
export async function accionConfirmarApp(_previo: EstadoConCodigos, datos: FormData): Promise<EstadoConCodigos> {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion" || acceso.hogar === null || acceso.sesionId === null) redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.appConfigurada) redirect("/");

  try {
    const resultado = await confirmarConfiguracion(acceso.hogar.miembroId, acceso.sesionId, String(datos.get("codigo") ?? ""));
    if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje, errores: {}, codigos: null };
    return { ok: true, mensaje: "Listo: tu app quedó configurada.", errores: {}, codigos: resultado.codigos };
  } catch (error) {
    return { ok: false, mensaje: fallo(error), errores: {}, codigos: null };
  }
}

/** El segundo paso al entrar: el codigo de la app o uno de respaldo. */
export async function accionVerificarCodigo(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion" || acceso.hogar === null || acceso.sesionId === null) redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "elegir") redirect(RUTA_ELEGIR);
  if (acceso.estado === "listo") redirect("/");

  let entro = false;
  try {
    const resultado = await verificarCodigo(acceso.hogar.miembroId, acceso.sesionId, String(datos.get("codigo") ?? ""));
    if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje, errores: {} };
    entro = true;
  } catch (error) {
    return { ok: false, mensaje: fallo(error), errores: {} };
  }
  if (entro) redirect(AL_ENTRAR);
  return { ok: false, mensaje: null, errores: {} };
}

/** Salir sin hacer el segundo paso, por ejemplo para entrar con otra cuenta. */
export async function accionSalirSinVerificar(): Promise<void> {
  // Igual se revisa quien es: salir no necesita mas que la sesion de Google.
  await leerAcceso();
  await signOut({ redirectTo: "/ingresar" });
}
