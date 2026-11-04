/**
 * Las reglas del hogar: quien puede hacer que. Logica pura, sin base de datos.
 *
 * - El dueno invita, saca miembros, le pasa el hogar a otro, le cambia el
 *   nombre y elige el dia en que empieza el mes.
 * - Todos anotan, pagan y ven todo lo del hogar.
 * - Un miembro puede salir cuando quiera. El dueno no: antes tiene que pasarle
 *   el hogar a alguien, para que el hogar y sus datos no queden sin dueno.
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
