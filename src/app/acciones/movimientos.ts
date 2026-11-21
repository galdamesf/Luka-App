"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ResultadoBandeja } from "@/dominio/bandeja";
import { MONTO_MAXIMO, esquemaId, esquemaMes, fechaISO } from "@/dominio/esquemas";
import { nombreDelMes } from "@/componentes/formato";
import {
  ErrorDeMovimiento,
  anotarIgual,
  confirmarMovimiento,
  confirmarVarios,
  crearReglaDeComercio,
  descartarMovimiento,
  deshacerEnLaBandeja,
  type Confirmacion,
} from "@/datos/movimientos";
import { formatearCLP, parsearMonto } from "@/lib/dinero";
import { hogarActual } from "@/lib/hogar-actual";

// Las acciones de la bandeja «Por revisar». Las llama el componente con un
// objeto y no con un <form>: cada una devuelve el aviso que se muestra y, si
// corresponde, lo que necesita el boton «Deshacer».
//
// Cada una pide primero el hogar de quien la usa, fuera de cualquier try: si
// ya no es parte del hogar, hogarActual corta la sesion con una redireccion,
// y un catch la convertiria en un mensaje de error.

function resultado(titulo: string, mensaje: string, extra: Partial<ResultadoBandeja> = {}): ResultadoBandeja {
  return { ok: true, titulo, mensaje, deshacer: null, regla: null, ...extra };
}

function error(mensaje: string): ResultadoBandeja {
  return { ok: false, titulo: null, mensaje, deshacer: null, regla: null };
}

const MENSAJES_CONOCIDOS = ["Esa cuenta ya está pagada.", "Esa cuota ya está pagada."];

function fallo(problema: unknown): ResultadoBandeja {
  if (problema instanceof ErrorDeMovimiento) return error(problema.message);
  if (problema instanceof Error && MENSAJES_CONOCIDOS.includes(problema.message)) return error(problema.message);
  const codigo =
    typeof problema === "object" && problema !== null && "code" in problema ? String((problema as { code: unknown }).code) : null;
  // Llave foranea rota: la categoria no existe o no es de este hogar.
  if (codigo === "P2003") return error("La categoría elegida ya no existe. Recarga la página.");
  // Lo que se iba a pagar o enlazar ya no esta (o es de otro hogar).
  if (codigo === "P2025") return error("Eso ya no existe. Recarga la página.");
  return error("No se pudo guardar. Intenta de nuevo.");
}

const NO_LO_ENCUENTRO = "No pude identificar el movimiento. Recarga la página.";
const CAMPOS_ESCRITOS = ["categoriaId", "descripcion", "monto", "fecha"];

/** El monto escrito a mano, como en los formularios: "45.990" o "$45.990". */
const montoEscrito = z
  .string()
  .trim()
  .transform((valor, ctx) => {
    const monto = parsearMonto(valor);
    if (monto === null || monto > MONTO_MAXIMO) {
      ctx.addIssue({ code: "custom", message: "El monto debe ser un número mayor que cero." });
      return z.NEVER;
    }
    return monto;
  });

const esquemaConfirmacion = z.object({
  id: esquemaId,
  confirmacion: z.discriminatedUnion("como", [
    z.object({
      como: z.literal("gasto"),
      categoriaId: z.string().trim().min(1, "Elige una categoría."),
      descripcion: z.string().trim().min(1, "Escribe una descripción.").max(120).optional(),
      monto: montoEscrito.optional(),
      fecha: fechaISO.optional(),
    }),
    z.object({ como: z.literal("mismo-gasto"), gastoId: esquemaId }),
    z.object({ como: z.literal("pago-de-cuenta"), cuentaId: esquemaId }),
    z.object({ como: z.literal("pago-de-cuota"), deudaId: esquemaId, mes: esquemaMes }),
    z.object({ como: z.literal("deuda") }),
  ]),
});

/** Confirma un movimiento de la bandeja: como gasto, como el mismo de antes, como pago o como deuda. */
export async function accionConfirmarMovimiento(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId, miembroId } = await hogarActual();
  const leido = esquemaConfirmacion.safeParse(entrada);
  if (!leido.success) {
    // Lo que escribio la persona (la categoria, el monto en pesos) se explica;
    // lo demas viene del componente y solo puede fallar con datos viejos.
    const campo = leido.error.issues.find((issue) => CAMPOS_ESCRITOS.includes(String(issue.path.at(-1))));
    return error(campo?.message ?? NO_LO_ENCUENTRO);
  }
  const { id, confirmacion } = leido.data;

  let hecho;
  try {
    hecho = await confirmarMovimiento(hogarId, miembroId, id, confirmacion as Confirmacion);
  } catch (problema) {
    return fallo(problema);
  }

  revalidatePath("/");
  const deshacer = { de: "confirmacion" as const, ids: [id] };
  switch (hecho.destino) {
    case "GASTO_NUEVO":
      return resultado("Gasto anotado", `${hecho.descripcion} · ${formatearCLP(hecho.monto)} en ${hecho.categoria}.`, {
        deshacer,
        regla: hecho.regla,
      });
    case "GASTO_EXISTENTE":
      return resultado("Enlazado", `Era el mismo gasto: ${hecho.descripcion} no se anota dos veces.`, { deshacer });
    case "PAGO_DE_CUENTA":
      return resultado("Cuenta pagada", `${hecho.descripcion} quedó pagada con ${formatearCLP(hecho.monto)}.`, { deshacer });
    case "PAGO_DE_CUOTA":
      return resultado("Cuota pagada", `La cuota de ${hecho.descripcion} quedó pagada.`, { deshacer });
    case "DEUDA": {
      const desde = nombreDelMes(hecho.deuda!.primeraCuota).split(" ")[0];
      return resultado(
        "Deuda creada",
        `${hecho.descripcion}: ${hecho.deuda!.cuotas} cuotas de ${formatearCLP(hecho.monto)} desde ${desde}.`,
        { deshacer },
      );
    }
  }
}

const esquemaListas = z.object({
  elegidos: z
    .array(z.object({ id: esquemaId, categoriaId: z.string().trim().min(1) }))
    .min(1)
    .max(100),
});

/** «Confirmar las listas»: todas las que tienen categoria y ninguna pregunta, de una vez. */
export async function accionConfirmarListas(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId, miembroId } = await hogarActual();
  const leido = esquemaListas.safeParse(entrada);
  if (!leido.success) return error(NO_LO_ENCUENTRO);

  let hecho;
  try {
    hecho = await confirmarVarios(hogarId, miembroId, leido.data.elegidos);
  } catch (problema) {
    return fallo(problema);
  }
  if (hecho.confirmados.length === 0) return error("Ya no quedaba nada por confirmar. Recarga la página.");

  revalidatePath("/");
  const cuantos = hecho.confirmados.length;
  const suma = hecho.confirmados.reduce((total, g) => total + g.monto, 0);
  const saltados =
    hecho.saltados === 0 ? "" : ` ${hecho.saltados === 1 ? "Uno ya no estaba" : `${hecho.saltados} ya no estaban`} por revisar.`;
  return resultado(
    cuantos === 1 ? "1 gasto anotado" : `${cuantos} gastos anotados`,
    `${cuantos === 1 ? "Suma" : "Suman"} ${formatearCLP(suma)} en tus gastos del mes.${saltados}`,
    { deshacer: { de: "confirmacion", ids: hecho.confirmados.map((g) => g.id) } },
  );
}

const esquemaUno = z.object({ id: esquemaId });

/** Lo saca de la bandeja sin anotar nada. */
export async function accionDescartarMovimiento(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId } = await hogarActual();
  const leido = esquemaUno.safeParse(entrada);
  if (!leido.success) return error(NO_LO_ENCUENTRO);

  let comercio: string;
  try {
    ({ comercio } = await descartarMovimiento(hogarId, leido.data.id));
  } catch (problema) {
    return fallo(problema);
  }
  revalidatePath("/");
  return resultado("Descartado", `${comercio} no cuenta en tus gastos.`, {
    deshacer: { de: "descarte", ids: [leido.data.id] },
  });
}

/** Vuelve a la bandeja algo que Luka dejo fuera (un traspaso, un giro). */
export async function accionAnotarIgual(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId } = await hogarActual();
  const leido = esquemaUno.safeParse(entrada);
  if (!leido.success) return error(NO_LO_ENCUENTRO);

  let comercio: string;
  try {
    ({ comercio } = await anotarIgual(hogarId, leido.data.id));
  } catch (problema) {
    return fallo(problema);
  }
  revalidatePath("/");
  return resultado("De vuelta en «Por revisar»", `${comercio} espera que lo revises.`, {
    deshacer: { de: "anotar-igual", ids: [leido.data.id] },
  });
}

const esquemaDeshacer = z.object({
  de: z.enum(["confirmacion", "descarte", "anotar-igual"]),
  ids: z.array(esquemaId).min(1).max(100),
});

/** El «Deshacer» del aviso. */
export async function accionDeshacerEnLaBandeja(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId } = await hogarActual();
  const leido = esquemaDeshacer.safeParse(entrada);
  if (!leido.success) return error(NO_LO_ENCUENTRO);

  try {
    await deshacerEnLaBandeja(hogarId, leido.data.de, leido.data.ids);
  } catch (problema) {
    return fallo(problema);
  }
  revalidatePath("/");
  return resultado(
    "Listo",
    leido.data.de === "anotar-igual" ? "Volvió a lo que Luka dejó fuera." : "Volvió a «Por revisar».",
  );
}

const esquemaRegla = z.object({ movimientoId: esquemaId, categoriaId: esquemaId });

/** «Sí, crear regla»: lo que llegue de ese comercio trae esa categoria. */
export async function accionCrearReglaDeComercio(entrada: unknown): Promise<ResultadoBandeja> {
  const { hogarId } = await hogarActual();
  const leido = esquemaRegla.safeParse(entrada);
  if (!leido.success) return error(NO_LO_ENCUENTRO);

  let regla: { etiqueta: string; categoria: string };
  try {
    regla = await crearReglaDeComercio(hogarId, leido.data.movimientoId, leido.data.categoriaId);
  } catch (problema) {
    return fallo(problema);
  }
  revalidatePath("/");
  return resultado("Regla guardada", `${regla.etiqueta} → ${regla.categoria}. Lo que llegue de ahí trae esa categoría.`);
}
