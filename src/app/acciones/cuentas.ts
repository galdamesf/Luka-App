"use server";

import { revalidatePath } from "next/cache";
import {
  desdeFormData,
  erroresDe,
  esquemaCuentaFormulario,
  esquemaEdicionCuentaFormulario,
  esquemaId,
  esquemaPagoFormulario,
  fechaISO,
} from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import {
  actualizarCuenta,
  adjuntarBoletaACuenta,
  adjuntarBoletaAGasto,
  crearCuenta,
  eliminarCuenta,
  pagarCuenta,
  revertirPago,
} from "@/datos/cuentas";
import { guardarBoleta } from "@/lib/boletas";

function traducirError(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);

  if (texto.includes("cuentas_nombre_mes_key")) {
    return "Ya tienes una cuenta con ese nombre en ese mes.";
  }
  if (texto.includes("cuentas_monto_positivo")) return "El monto debe ser mayor que cero.";
  if (texto.includes("cuentas_dia_vencimiento_valido")) return "El día de vencimiento va entre 1 y 31.";
  if (texto.includes("ya está pagada")) return "Esa cuenta ya está pagada.";

  return "No se pudo guardar. Intenta de nuevo.";
}

/**
 * Saca el archivo del formulario y lo guarda, si vino alguno.
 * Devuelve null si no se adjunto nada, o el motivo del rechazo.
 */
async function procesarBoleta(
  datos: FormData,
): Promise<{ archivo: string | null } | { error: string }> {
  const adjunto = datos.get("boleta");

  if (adjunto === null || typeof adjunto === "string") return { archivo: null };
  if (adjunto.size === 0) return { archivo: null };

  const guardado = await guardarBoleta(adjunto);
  return guardado.ok ? { archivo: guardado.archivo } : { error: guardado.motivo };
}

export async function accionCrearCuenta(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaCuentaFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: erroresDe(resultado.error) };
  }

  try {
    const cuenta = await crearCuenta(resultado.data);

    const boleta = await procesarBoleta(datos);
    if ("error" in boleta) {
      // La cuenta ya quedo creada: se avisa de la foto sin perder lo demas.
      revalidatePath("/");
      return { ok: true, mensaje: `Cuenta creada, pero la foto no: ${boleta.error}`, errores: {} };
    }
    if (boleta.archivo !== null) {
      await adjuntarBoletaACuenta(cuenta.id, boleta.archivo);
    }
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Cuenta agregada.", errores: {} };
}

/** Edita una cuenta pendiente. No toca las pagadas: ver actualizarCuenta. */
export async function accionActualizarCuenta(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaEdicionCuentaFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  try {
    await actualizarCuenta(resultado.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Cuenta actualizada.", errores: {} };
}

/**
 * Marca pagada de un clic, con la fecha de hoy y el monto esperado.
 *
 * Es el boton "Pagado". Si el monto real fue otro, se corrige despues
 * editando la cuenta: el gasto se actualiza junto con ella.
 */
export async function accionMarcarPagada(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const id = esquemaId.safeParse(datos.get("id"));
  const fecha = fechaISO.safeParse(datos.get("hoy"));
  if (!id.success || !fecha.success) {
    return { ok: false, mensaje: "No pude identificar la cuenta.", errores: {} };
  }

  const monto = Number(datos.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: "El monto de la cuenta no es válido.", errores: {} };
  }

  try {
    await pagarCuenta(id.data, fecha.data, Math.round(monto), null);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: null, errores: {} };
}

/** Marca pagada con la fecha exacta y crea el gasto. */
export async function accionPagarCuenta(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaPagoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return { ok: false, mensaje: "Revisa la fecha y el monto.", errores: erroresDe(resultado.error) };
  }

  const boleta = await procesarBoleta(datos);
  if ("error" in boleta) {
    return { ok: false, mensaje: boleta.error, errores: {} };
  }

  try {
    await pagarCuenta(
      resultado.data.id,
      resultado.data.fechaPago,
      resultado.data.monto,
      boleta.archivo,
    );
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Cuenta pagada.", errores: {} };
}

/**
 * Deshace el pago: borra el gasto y la cuenta vuelve a pendiente.
 *
 * Devuelve estado en vez de void para que, si algo falla, el motivo se vea en
 * la interfaz. Antes un id invalido o un error de la base terminaban en un
 * `return` mudo: para quien aprieta el boton, "no pasa nada".
 */
export async function accionRevertirPago(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) {
    return { ok: false, mensaje: "No pude identificar la cuenta.", errores: {} };
  }

  try {
    await revertirPago(id.data);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: null, errores: {} };
}

export async function accionEliminarCuenta(datos: FormData): Promise<void> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  await eliminarCuenta(id.data);
  revalidatePath("/");
}

/** Adjunta o reemplaza la foto de un gasto ya registrado. */
export async function accionAdjuntarBoletaAGasto(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return { ok: false, mensaje: "Falta el gasto.", errores: {} };

  const boleta = await procesarBoleta(datos);
  if ("error" in boleta) return { ok: false, mensaje: boleta.error, errores: {} };
  if (boleta.archivo === null) return { ok: false, mensaje: "No elegiste ninguna foto.", errores: {} };

  try {
    await adjuntarBoletaAGasto(id.data, boleta.archivo);
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: "Boleta adjuntada.", errores: {} };
}
