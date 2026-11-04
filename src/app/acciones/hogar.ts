"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { esquemaId } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import {
  ErrorDeHogar,
  hacerDueno,
  invitarMiembro,
  quitarMiembro,
  renombrarHogar,
  salirDelHogar,
} from "@/datos/hogares";
import { hogarActual } from "@/lib/hogar-actual";

// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.
//
// Las reglas de quien puede que (src/dominio/hogar.ts) las aplican las
// funciones de datos con el rol que dice la base; aqui solo se traducen sus
// errores para mostrarlos.

function fallo(error: unknown): EstadoFormulario {
  const mensaje = error instanceof ErrorDeHogar ? error.message : "No se pudo hacer. Intenta de nuevo.";
  return { ok: false, mensaje, errores: {} };
}

const LISTO = (mensaje: string): EstadoFormulario => ({ ok: true, mensaje, errores: {} });

export async function accionRenombrarHogar(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  try {
    await renombrarHogar(hogarId, miembroId, String(datos.get("nombre") ?? ""));
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO("Nombre guardado.");
}

export async function accionInvitar(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  let correo: string;
  try {
    correo = (await invitarMiembro(hogarId, miembroId, String(datos.get("correo") ?? ""))).correo;
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Listo. Cuando ${correo} entre a Luka con su cuenta de Google, quedará en tu hogar.`);
}

export async function accionQuitarMiembro(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return fallo(null);
  try {
    await quitarMiembro(hogarId, miembroId, id.data);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO("Listo.");
}

export async function accionHacerDueno(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return fallo(null);
  try {
    await hacerDueno(hogarId, miembroId, id.data);
  } catch (error) {
    return fallo(error);
  }
  // Cambia lo que puede hacer cada uno en todas las paginas (el dia de inicio).
  revalidatePath("/", "layout");
  return LISTO("Listo: ahora el hogar tiene otro dueño.");
}

export async function accionSalirDelHogar(
  _previo: EstadoFormulario,
  _datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  try {
    await salirDelHogar(hogarId, miembroId);
  } catch (error) {
    return fallo(error);
  }
  // Ya no es parte del hogar: la sesion se cierra aqui mismo y la pantalla de
  // ingreso lo explica. Va fuera del try a proposito: cerrar la sesion
  // termina con una redireccion, y un catch la volveria un error.
  await signOut({ redirectTo: "/ingresar?error=Salida" });
  return LISTO("Saliste del hogar.");
}
