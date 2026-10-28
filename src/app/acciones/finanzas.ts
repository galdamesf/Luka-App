"use server";

import { revalidatePath } from "next/cache";
import {
  desdeFormData,
  erroresDe,
  esquemaDeudaFormulario,
  esquemaEdicionDeudaFormulario,
  esquemaId,
  esquemaMes,
  esquemaPagoCuotaFormulario,
  esquemaSueldoFormulario,
  fechaISO,
} from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { definirSueldo } from "@/datos/sueldos";
import {
  actualizarDeuda,
  crearDeuda,
  desactivarDeuda,
  pagarCuota,
  reactivarDeuda,
  revertirCuota,
} from "@/datos/deudas";

function traducirError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);

  // Los CHECK de la base llegan como error de Postgres, no de Prisma.
  if (texto.includes("sueldos_monto_no_negativo")) return "El sueldo no puede ser negativo.";
  if (texto.includes("deudas_monto_cuota_positivo")) return "La cuota debe ser mayor que cero.";
  if (texto.includes("deudas_cuotas_totales_validas")) return "El número de cuotas no es válido.";
  if (texto.includes("cuotas_pagadas_monto_positivo")) return "El monto debe ser mayor que cero.";
  if (texto.includes("cuotas_pagadas_deuda_id_mes_key")) return "Esa cuota ya está pagada.";
  if (texto.includes("dia_uno")) return "La fecha debe ser el comienzo de un mes.";

  return "No se pudo guardar. Intenta de nuevo.";
}

export async function accionDefinirSueldo(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaSueldoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await definirSueldo(resultado.data.mes, resultado.data.monto, resultado.data.nota);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Sueldo guardado.", errores: {} };
}

export async function accionCrearDeuda(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaDeudaFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await crearDeuda(resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Deuda agregada.", errores: {} };
}

/**
 * Marca una deuda como terminada. No la borra: borrarla descuadraria los
 * meses pasados, donde esa cuota si se pago.
 */
export async function accionDesactivarDeuda(datos: FormData): Promise<void> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await desactivarDeuda(id.data);
  revalidatePath("/");
}

export async function accionReactivarDeuda(datos: FormData): Promise<void> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await reactivarDeuda(id.data);
  revalidatePath("/");
}

/** Marca pagada la cuota del mes y crea el gasto correspondiente. */
export async function accionPagarCuota(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaPagoCuotaFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa la fecha y el monto.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await pagarCuota(
      resultado.data.deudaId,
      resultado.data.mes,
      resultado.data.fechaPago,
      resultado.data.monto,
    );
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Cuota pagada.", errores: {} };
}

/**
 * Marca la cuota pagada de un clic, con la fecha de hoy y el monto pactado.
 *
 * Es el boton "Pagado" de la seccion de deudas.
 */
export async function accionMarcarCuotaPagada(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const deudaId = esquemaId.safeParse(datos.get("deudaId"));
  const mes = esquemaMes.safeParse(datos.get("mes"));
  const fecha = fechaISO.safeParse(datos.get("hoy"));
  if (!deudaId.success || !mes.success || !fecha.success) {
    return { ok: false, mensaje: "No pude identificar la cuota.", errores: {} };
  }

  const monto = Number(datos.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: "El monto de la cuota no es válido.", errores: {} };
  }

  try {
    await pagarCuota(deudaId.data, mes.data, fecha.data, Math.round(monto), null);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: null, errores: {} };
}

/** Deshace el pago de una cuota: borra el registro y su gasto. */
export async function accionRevertirCuota(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const deudaId = esquemaId.safeParse(datos.get("deudaId"));
  const mes = esquemaMes.safeParse(datos.get("mes"));
  if (!deudaId.success || !mes.success) {
    return { ok: false, mensaje: "No pude identificar la cuota.", errores: {} };
  }

  try {
    await revertirCuota(deudaId.data, mes.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: null, errores: {} };
}

/** Edita una deuda. Ver actualizarDeuda: el calendario se bloquea si ya hay pagos. */
export async function accionActualizarDeuda(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaEdicionDeudaFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await actualizarDeuda(resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Deuda actualizada.", errores: {} };
}
