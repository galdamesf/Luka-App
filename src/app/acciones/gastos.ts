"use server";

import { revalidatePath } from "next/cache";
import {
  desdeFormData,
  erroresDe,
  esquemaGastoFormulario,
  esquemaId,
} from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { crearGasto, eliminarGasto } from "@/datos/gastos";
import { guardarBoleta } from "@/lib/boletas";

/** Codigos de Prisma que sabemos traducir a algo legible. */
const MENSAJES_PRISMA: Record<string, string> = {
  // Llave foranea rota: la categoria no existe.
  P2003: "La categoría elegida ya no existe. Recarga la página.",
};

function traducirError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const codigo = String((error as { code: unknown }).code);
    const conocido = MENSAJES_PRISMA[codigo];
    if (conocido !== undefined) return conocido;
  }
  // El CHECK de monto positivo llega como error de base, no de Prisma.
  const texto = error instanceof Error ? error.message : String(error);
  if (texto.includes("gastos_monto_positivo")) {
    return "El monto debe ser mayor que cero.";
  }
  return "No se pudo guardar el gasto. Intenta de nuevo.";
}

export async function accionCrearGasto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const resultado = esquemaGastoFormulario.safeParse(desdeFormData(datos));

  if (!resultado.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados.",
      errores: erroresDe(resultado.error),
    };
  }

  // La foto es opcional: si falla, el gasto igual se guarda y se avisa.
  let boletaArchivo: string | null = null;
  let avisoFoto = "";

  const adjunto = datos.get("boleta");
  if (adjunto !== null && typeof adjunto !== "string" && adjunto.size > 0) {
    const guardado = await guardarBoleta(adjunto);
    if (guardado.ok) boletaArchivo = guardado.archivo;
    else avisoFoto = ` La foto no se guardó: ${guardado.motivo}`;
  }

  try {
    await crearGasto({ ...resultado.data, boletaArchivo });
  } catch (error) {
    return { ok: false, mensaje: traducirError(error), errores: {} };
  }

  revalidatePath("/");
  return { ok: true, mensaje: `Gasto agregado.${avisoFoto}`, errores: {} };
}

function esNoEncontrado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code: unknown }).code) === "P2025"
  );
}

/**
 * Borra un gasto. Recibe solo el FormData porque se usa con `<form action>`
 * directo, sin useActionState: no hay errores por campo que mostrar.
 *
 * Es idempotente a proposito: si el gasto ya no existe (doble clic, o la
 * pestana quedo con datos viejos) la intencion de quien lo borro igual se
 * cumplio, asi que no se trata como error. Cualquier otra falla si se propaga.
 */
export async function accionEliminarGasto(datos: FormData): Promise<void> {
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return;

  try {
    await eliminarGasto(id.data);
  } catch (error) {
    if (!esNoEncontrado(error)) throw error;
  }

  revalidatePath("/");
}
