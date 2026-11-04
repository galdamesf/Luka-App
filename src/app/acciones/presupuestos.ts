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
import { hogarActual } from "@/lib/hogar-actual";

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
  // La categoria no existe o es de otro hogar (llave por categoria y hogar).
  if (texto.includes("presupuestos_categoria_id_hogar_id_fkey")) {
    return "La categoría elegida ya no existe. Recarga la página.";
  }
  return texto;
}

export async function accionCrearPresupuesto(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  // Fuera del try: la redireccion de hogarActual no tiene que volverse error.
  const { hogarId } = await hogarActual();
  const resultado = esquemaPresupuestoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await crearPresupuesto(hogarId, resultado.data);
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
  const { hogarId } = await hogarActual();
  const resultado = esquemaEdicionPresupuestoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa el monto.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await actualizarPresupuesto(hogarId, resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Presupuesto actualizado.", errores: {} };
}

export async function accionEliminarPresupuesto(datos: FormData): Promise<void> {
  const { hogarId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await eliminarPresupuesto(hogarId, id.data);
  revalidatePath("/");
}
