"use server";

import { revalidatePath } from "next/cache";
import { desdeFormData, erroresDe, esquemaAhorroFormulario, esquemaId } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { crearAhorro, eliminarAhorro } from "@/datos/ahorros";
import { hogarActual } from "@/lib/hogar-actual";

// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

function traducirError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  // Los CHECK de la base llegan como error de Postgres, no de Prisma.
  if (texto.includes("ahorros_monto_positivo")) return "El monto debe ser mayor que cero.";
  if (texto.includes("ahorros_mes_dia_uno")) return "El mes no es válido.";
  return "No se pudo guardar. Intenta de nuevo.";
}

export async function accionCrearAhorro(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId } = await hogarActual();
  const resultado = esquemaAhorroFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: erroresDe(resultado.error) };
  }

  try {
    await crearAhorro(hogarId, resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Ahorro agregado.", errores: {} };
}

export async function accionEliminarAhorro(datos: FormData): Promise<void> {
  const { hogarId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await eliminarAhorro(hogarId, id.data);
  revalidatePath("/");
}
