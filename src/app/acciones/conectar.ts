"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/dominio/formulario";
import { ErrorDelBuzon, leerMiBuzon, revisarElBuzon } from "@/datos/buzon";
import { ErrorDeCartola, guardarClaveDeCartola, quitarClaveDeCartola } from "@/datos/cartolas";
import { ErrorAlConectar, cambiarResumenDiario, cartolaQueEsperaClave, marcarMisBancos } from "@/datos/conectar";
import { configuracionDelBuzon } from "@/lib/buzon";
import { revisionAutomatica } from "@/lib/automatico";
import { hogarActual } from "@/lib/hogar-actual";

// Conectar los correos (seccion E): los bancos de cada persona, el codigo
// de Gmail que aparece solo, la revision del buzon al abrir el panel, la
// clave de la cartola que se pide en Inicio y el resumen diario.
//
// Cada accion pide primero el hogar de quien la usa, fuera de cualquier try:
// si ya no es parte del hogar, hogarActual corta la sesion con una
// redireccion, y un catch la convertiria en un mensaje de error.

function fallo(error: unknown): EstadoFormulario {
  const conocido = error instanceof ErrorAlConectar || error instanceof ErrorDeCartola || error instanceof ErrorDelBuzon;
  if (!conocido) console.error("No se pudo completar la accion de conectar:", error);
  return { ok: false, mensaje: conocido ? error.message : "No se pudo hacer. Intenta de nuevo.", errores: {} };
}

const LISTO = (mensaje: string): EstadoFormulario => ({ ok: true, mensaje, errores: {} });

function enLista(nombres: readonly string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

export async function accionMarcarMisBancos(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  let bancos: string[];
  try {
    bancos = await marcarMisBancos(
      hogarId,
      miembroId,
      datos.getAll("banco").map((b) => String(b)),
    );
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(`Listo: ${enLista(bancos)}.`);
}

/** Cuantas veces se revisa el buzon al abrir el panel: a lo mas una por minuto en cada servidor. */
const ESPERA_ENTRE_REVISIONES_MS = 60_000;
let ultimaRevisionAlEntrar = 0;

/**
 * Al abrir el panel, revisa el buzon (si Luka lo revisa sola: en Vercel si,
 * en tu computador no) y dice si llego algo, para refrescar «Por revisar».
 * No falla nunca: si el buzon no contesta, sera la proxima vez.
 */
export async function accionRevisarAlEntrar(): Promise<{ cambios: number }> {
  await hogarActual();
  if (!revisionAutomatica() || configuracionDelBuzon() === null) return { cambios: 0 };
  const ahora = Date.now();
  if (ahora - ultimaRevisionAlEntrar < ESPERA_ENTRE_REVISIONES_MS) return { cambios: 0 };
  ultimaRevisionAlEntrar = ahora;
  try {
    const resumen = await revisarElBuzon();
    return { cambios: resumen.nuevos + resumen.cartolas + resumen.repetidos + resumen.sinMovimiento };
  } catch (error) {
    console.error("No se pudo revisar el buzon al entrar:", error);
    return { cambios: 0 };
  }
}

/** Mientras alguien espera el codigo de Gmail, el buzon se revisa a lo mas cada 10 segundos en cada servidor. */
const ESPERA_ENTRE_BUSQUEDAS_MS = 10_000;
let ultimaBusqueda = 0;

/**
 * El codigo con que Gmail pide confirmar el reenvio a la direccion de Luka
 * de esta persona, si ya llego. Mientras el asistente lo espera, revisa el
 * buzon: solo si Luka lo revisa sola, o si la persona apreto el boton
 * («aMano»), como con «Revisar ahora». Esperando, no mas seguido que cada
 * 10 segundos: Gmail no quiere que se entre a cada rato.
 */
export async function accionBuscarCodigoDeGmail(aMano: boolean): Promise<{ codigo: string | null; de: string | null }> {
  const { hogarId, miembroId } = await hogarActual();
  const config = configuracionDelBuzon();
  if (config === null) return { codigo: null, de: null };
  const ahora = Date.now();
  if (aMano || (revisionAutomatica() && ahora - ultimaBusqueda >= ESPERA_ENTRE_BUSQUEDAS_MS)) {
    ultimaBusqueda = ahora;
    try {
      await revisarElBuzon();
    } catch (error) {
      if (!(error instanceof ErrorDelBuzon)) console.error("No se pudo revisar el buzon:", error);
    }
  }
  const buzon = await leerMiBuzon(hogarId, miembroId, { base: config.direccion });
  return { codigo: buzon.codigoDeGmail?.codigo ?? null, de: buzon.codigoDeGmail?.de ?? null };
}

/**
 * La clave de la cartola que espera en el buzon, escrita en Inicio: se
 * guarda y se revisa el buzon al tiro, para leerla. Si no la abre, la clave
 * no se queda guardada.
 */
export async function accionLeerCartolaQueEspera(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const banco = String(datos.get("banco") ?? "");
  try {
    await guardarClaveDeCartola(hogarId, miembroId, banco, String(datos.get("clave") ?? ""));
  } catch (error) {
    return fallo(error);
  }

  let mensaje = "Listo: Luka guardó la clave y lee la cartola en la próxima revisión del buzón.";
  if (configuracionDelBuzon() !== null) {
    try {
      const resumen = await revisarElBuzon();
      if (resumen.cartolas > 0) {
        mensaje = "Listo: Luka leyó la cartola. Lo nuevo quedó en «Por revisar».";
      } else if (resumen.esperanClave > 0 && (await cartolaQueEsperaClave(hogarId, miembroId)) !== null) {
        await quitarClaveDeCartola(hogarId, miembroId, banco);
        revalidatePath("/");
        return { ok: false, mensaje: "Esa clave no abre la cartola. Revisa en el correo del banco cuál es.", errores: { clave: ["Esa clave no abre la cartola."] } };
      }
    } catch (error) {
      if (!(error instanceof ErrorDelBuzon)) console.error("No se pudo revisar el buzon:", error);
    }
  }
  revalidatePath("/");
  revalidatePath("/hogar");
  return LISTO(mensaje);
}

export async function accionCambiarResumenDiario(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { hogarId, miembroId } = await hogarActual();
  const activo = datos.get("activo") === "si";
  try {
    await cambiarResumenDiario(hogarId, miembroId, activo);
  } catch (error) {
    return fallo(error);
  }
  revalidatePath("/hogar");
  return LISTO(activo ? "Listo: te llega cada mañana, si hay algo que contar." : "Listo: ya no te llega.");
}
