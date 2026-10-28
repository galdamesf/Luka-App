"use server";

import { revalidatePath } from "next/cache";
import {
  desdeFormData,
  erroresDe,
  esquemaEdicionPresupuestoFormulario,
  esquemaId,
  esquemaPresupuestoFormulario,
} from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import {
  actualizarPresupuesto,
  crearPresupuesto,
  eliminarPresupuesto,
} from "@/datos/presupuestos";

function traducirError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);

  // Los CHECK de la base llegan como error de Postgres, no de Prisma.
  if (texto.includes("presupuestos_monto_positivo")) {
    return "El presupuesto debe ser mayor que cero.";
  }
  if (texto.includes("presupuestos_categoria_id_mes_key")) {
    return "Esa categoría ya tiene presupuesto este mes.";
  }
  if (texto.includes("presupuestos_mes_dia_uno")) {
    return "El mes no es válido.";
  }
  return texto;
}

export async function accionCrearPresupuesto(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaPresupuestoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await crearPresupuesto(resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Presupuesto creado.", errores: {} };
}

export async function accionActualizarPresupuesto(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaEdicionPresupuestoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa el monto.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await actualizarPresupuesto(resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Presupuesto actualizado.", errores: {} };
}

export async function accionEliminarPresupuesto(datos: FormData): Promise<void> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await eliminarPresupuesto(id.data);
  revalidatePath("/");
}
