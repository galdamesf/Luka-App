/**
 * Las reglas del hogar: quien puede hacer que. Logica pura, sin base de datos.
 *
 * - El dueno invita, saca miembros, le pasa el hogar a otro, le cambia el
 *   nombre y elige el dia en que empieza el mes.
 * - Todos anotan, pagan y ven todo lo del hogar.
 * - Un miembro puede salir cuando quiera. El dueno no: antes tiene que pasarle
 *   el hogar a alguien, para que el hogar y sus datos no queden sin dueno.
 * - El dueno que esta solo (nadie mas ha entrado) puede borrar el hogar con
 *   todo lo que tiene, con un codigo que le llega al correo. Es la salida de
 *   quien armo su propio hogar y despues lo invitaron a otro: cada correo
 *   esta en un solo hogar.
 *
 * Cada regla devuelve null si se puede, o el motivo en castellano si no.
 */
import type { Rol } from "./entrada";

export type MiembroDelHogar = {
  id: string;
  correo: string;
  nombre: string | null;
  rol: Rol;
  /** null = invitacion pendiente: todavia no entra. */
  entroEn: string | null;
};

/** Quien hace la accion: el miembro de la sesion. */
export type Quien = { miembroId: string; rol: Rol };

const SOLO_DUENO = "Solo el dueño del hogar puede hacer eso.";

export function puedeInvitar(quien: Quien): string | null {
  return quien.rol === "DUENO" ? null : SOLO_DUENO;
}

export function puedeRenombrar(quien: Quien): string | null {
  return quien.rol === "DUENO" ? null : SOLO_DUENO;
}

export function puedeCambiarDiaDeInicio(quien: Quien): string | null {
  return quien.rol === "DUENO" ? null : "El día de inicio lo elige el dueño del hogar.";
}

/** Sacar a alguien, o cancelar su invitacion: es lo mismo. */
export function puedeQuitar(quien: Quien, objetivo: MiembroDelHogar): string | null {
  if (quien.rol !== "DUENO") return SOLO_DUENO;
  if (objetivo.id === quien.miembroId) return "Para irte del hogar, usa «Salir del hogar».";
  if (objetivo.rol === "DUENO") return "Al dueño del hogar no se le puede sacar.";
  return null;
}

export function puedeHacerDueno(quien: Quien, objetivo: MiembroDelHogar): string | null {
  if (quien.rol !== "DUENO") return SOLO_DUENO;
  if (objetivo.id === quien.miembroId) return "Ya eres el dueño del hogar.";
  if (objetivo.entroEn === null) return "Solo se le puede pasar el hogar a alguien que ya entró.";
  return null;
}

export function puedeSalir(quien: Quien): string | null {
  return quien.rol === "DUENO"
    ? "Antes de salir, pásale el hogar a otro miembro: un hogar no puede quedar sin dueño."
    : null;
}

/**
 * Borrar el hogar. Solo el dueno, y solo si nadie mas ha entrado: con alguien
 * mas, borrarlo le quitaria sus datos (para irse esta pasarle el hogar y
 * salir). Las invitaciones pendientes no cuentan: se cancelan con el hogar.
 */
export function puedeBorrarHogar(quien: Quien, miembros: readonly MiembroDelHogar[]): string | null {
  if (quien.rol !== "DUENO") return SOLO_DUENO;
  const otros = miembros.filter((m) => m.id !== quien.miembroId && m.entroEn !== null);
  if (otros.length > 0) {
    return "Solo se puede borrar un hogar en el que estás solo. Para irte, pásale el hogar a otro miembro y después sal.";
  }
  return null;
}

/**
 * El codigo que confirma que se borra el hogar. Llega al correo del dueno:
 * quien solo tiene la sesion abierta de Luka, sin ese correo, no lo puede
 * borrar. Seis digitos, diez minutos, cinco intentos y un minuto entre
 * envios, para no llenarle el correo a nadie.
 */
export const CODIGO_DE_BORRADO = {
  digitos: 6,
  minutosDeVigencia: 10,
  intentos: 5,
  segundosParaReenviar: 60,
} as const;

/** Lo que escribe la persona, como se compara: los 6 digitos, sin espacios ni guiones. null si no son 6. */
export function limpiarCodigo(texto: string): string | null {
  const digitos = texto.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${CODIGO_DE_BORRADO.digitos}}$`).test(digitos) ? digitos : null;
}

/** Cuantos segundos faltan para poder pedir otro codigo. 0 si ya se puede. */
export function segundosParaReenviar(pedidoEn: Date | null, ahora: Date): number {
  if (pedidoEn === null) return 0;
  const pasaron = (ahora.getTime() - pedidoEn.getTime()) / 1000;
  return Math.max(0, Math.ceil(CODIGO_DE_BORRADO.segundosParaReenviar - pasaron));
}

/** Lo que se sabe del codigo pendiente, sin el codigo. */
export type CodigoPendiente = { miembroId: string; expiraEn: Date; intentos: number };

/**
 * Antes de comparar: que haya un codigo, que lo haya pedido quien lo usa, que
 * siga vigente y que le queden intentos.
 */
export function revisarCodigo(pendiente: CodigoPendiente | null, quien: Quien, ahora: Date): string | null {
  if (pendiente === null || pendiente.miembroId !== quien.miembroId) {
    return "Primero pide el código: te llega al correo.";
  }
  if (pendiente.expiraEn.getTime() <= ahora.getTime()) return "El código venció. Pide uno nuevo.";
  if (pendiente.intentos >= CODIGO_DE_BORRADO.intentos) return "Se acabaron los intentos con ese código. Pide uno nuevo.";
  return null;
}

/** Lo que se le dice cuando el codigo no es, segun los intentos que ya hizo. */
export function codigoEquivocado(intentosHechos: number): string {
  const quedan = CODIGO_DE_BORRADO.intentos - intentosHechos;
  if (quedan <= 0) return "Ese código no es, y se acabaron los intentos. Pide uno nuevo.";
  return `Ese código no es. ${quedan === 1 ? "Te queda 1 intento" : `Te quedan ${quedan} intentos`}.`;
}

/**
 * Como se nombra a un miembro en la pantalla: su nombre de Google, o la parte
 * de su correo antes de la @ si todavia no entra.
 */
export function nombreParaMostrar(miembro: { nombre: string | null; correo: string }): string {
  const nombre = miembro.nombre?.trim();
  if (nombre) return nombre;
  return miembro.correo.split("@")[0] ?? miembro.correo;
}

/** Solo el primer nombre: para etiquetas cortas como «anotado por Ana». */
export function primerNombre(miembro: { nombre: string | null; correo: string }): string {
  return nombreParaMostrar(miembro).split(/\s+/)[0] ?? "";
}

/**
 * El orden de la lista: el dueno, despues los que ya entraron (por nombre) y
 * al final las invitaciones pendientes (la mas antigua primero, por correo
 * si empatan).
 */
export function ordenarMiembros<T extends MiembroDelHogar>(miembros: readonly T[]): T[] {
  const grupo = (m: T) => (m.rol === "DUENO" ? 0 : m.entroEn !== null ? 1 : 2);
  return [...miembros].sort(
    (a, b) =>
      grupo(a) - grupo(b) ||
      nombreParaMostrar(a).localeCompare(nombreParaMostrar(b), "es") ||
      a.correo.localeCompare(b.correo),
  );
}

/** Nombre de hogar valido: con algo escrito y que quepa. null si sirve. */
export function errorDeNombreDeHogar(nombre: string): string | null {
  const limpio = nombre.trim();
  if (limpio.length === 0) return "Escribe un nombre para el hogar.";
  if (limpio.length > 60) return "El nombre puede tener hasta 60 letras.";
  return null;
}
