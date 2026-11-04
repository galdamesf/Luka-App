"use server";

import { revalidatePath } from "next/cache";
import { desdeFormData, erroresDe, esquemaDiaInicioFormulario } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { definirDiaInicioMes } from "@/datos/ajustes";
import { hogarActual } from "@/lib/hogar-actual";
import { puedeCambiarDiaDeInicio } from "@/dominio/hogar";

// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

export async function accionDefinirDiaInicio(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { hogarId, miembroId, rol } = await hogarActual();
  // El dia de inicio cambia el mes de todos en el hogar: lo elige el dueno.
  const motivo = puedeCambiarDiaDeInicio({ miembroId, rol });
  if (motivo !== null) return { ok: false, mensaje: motivo, errores: {} };

  const resultado = esquemaDiaInicioFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa el día.", errores: erroresDe(resultado.error) };
  }

  try {
    await definirDiaInicioMes(hogarId, resultado.data.diaInicioMes);
  } catch {
    return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo.", errores: {} };
  }

  // Cambia el corte de todos los meses: dashboard, informes y reportes.
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Día de inicio guardado.", errores: {} };
}
