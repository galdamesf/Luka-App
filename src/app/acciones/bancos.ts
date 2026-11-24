"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BANCOS, TIPOS_DE_CUENTA } from "@/dominio/bancos";
import { esquemaId } from "@/dominio/esquemas";
import type { EstadoFormulario } from "@/dominio/formulario";
import { ErrorDeBanco, agregarCuentas, editarCuenta, quitarCuenta } from "@/datos/bancos";
import { hogarActual } from "@/lib/hogar-actual";

// Las cuentas y tarjetas del hogar, desde «Tus bancos y tarjetas» en Hogar.
//
// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

function fallo(error: unknown): EstadoFormulario {
  if (!(error instanceof ErrorDeBanco)) console.error("No se pudo guardar la cuenta:", error);
  const mensaje = error instanceof ErrorDeBanco ? error.message : "No se pudo guardar. Intenta de nuevo.";
  return { ok: false, mensaje, errores: {} };
}

const LISTO = (mensaje: string): EstadoFormulario => ({ ok: true, mensaje, errores: {} });

const esquemaCuenta = z.object({
  tipo: z.enum(TIPOS_DE_CUENTA),
  ultimos4: z.string().max(20),
  apodo: z.string().max(120).nullish(),
});

/** Las cuentas que arma el formulario, en un campo oculto con JSON. */
function leerCuentas(texto: string): z.infer<typeof esquemaCuenta>[] | null {
  try {
    const leidas = z.array(esquemaCuenta).min(1).max(12).safeParse(JSON.parse(texto));
    return leidas.success ? leidas.data : null;
  } catch {
    return null;
  }
}

/** Un banco del catalogo (por su id) o el que se escribio en «Otro». */
function bancoElegido(datos: FormData): string {
  const elegido = String(datos.get("banco") ?? "");
  if (elegido === "otro") return String(datos.get("bancoOtro") ?? "");
  return BANCOS.find((banco) => banco.id === elegido)?.nombre ?? "";
}

export async function accionAgregarBanco(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const cuentas = leerCuentas(String(datos.get("cuentas") ?? ""));
  if (cuentas === null) return { ok: false, mensaje: "Agrega al menos una cuenta o tarjeta, con sus últimos 4 dígitos.", errores: {} };
  const banco = bancoElegido(datos);

  let agregado: { banco: string; agregadas: number };
  try {
    agregado = await agregarCuentas(hogarId, miembroId, cuentas.map((cuenta) => ({ banco, ...cuenta })));
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  revalidatePath("/");
  return LISTO(
    agregado.agregadas === 1
      ? `${agregado.banco} quedó agregado, con su cuenta.`
      : `${agregado.banco} quedó agregado, con sus ${agregado.agregadas} cuentas.`,
  );
}

export async function accionEditarCuentaBancaria(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  const cuenta = esquemaCuenta.safeParse({
    tipo: datos.get("tipo"),
    ultimos4: String(datos.get("ultimos4") ?? ""),
    apodo: String(datos.get("apodo") ?? ""),
  });
  if (!id.success || !cuenta.success) return { ok: false, mensaje: "Revisa el tipo y los 4 dígitos.", errores: {} };

  try {
    await editarCuenta(hogarId, id.data, cuenta.data);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  revalidatePath("/");
  return LISTO("Cuenta guardada.");
}

export async function accionQuitarCuentaBancaria(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId } = await hogarActual();
  const id = esquemaId.safeParse(datos.get("id"));
  if (!id.success) return { ok: false, mensaje: "No pude identificar la cuenta. Recarga la página.", errores: {} };

  let quitada: { banco: string };
  try {
    quitada = await quitarCuenta(hogarId, id.data);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  revalidatePath("/");
  return LISTO(`Cuenta de ${quitada.banco} quitada. Lo que ya llegó se queda.`);
}
