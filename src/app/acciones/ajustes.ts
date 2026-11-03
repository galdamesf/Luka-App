"use server";

import { revalidatePath } from "next/cache";
import { desdeFormData, erroresDe, esquemaDiaInicioFormulario } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { definirDiaInicioMes } from "@/datos/ajustes";

export async function accionDefinirDiaInicio(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaDiaInicioFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa el día.", errores: erroresDe(resultado.error) };
  }

  try {
    await definirDiaInicioMes(resultado.data.diaInicioMes);
  } catch {
    return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo.", errores: {} };
  }

  // Cambia el corte de todos los meses: dashboard, informes y reportes.
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Día de inicio guardado.", errores: {} };
}
