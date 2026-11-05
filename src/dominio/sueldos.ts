import { compararMeses, sumarMeses } from "@/lib/fecha";
import { sueldoVigente } from "./balance";
import { primerNombre } from "./hogar";

/**
 * Los sueldos del hogar, sin base de datos: cada persona anota el suyo, y lo
 * que entra al hogar en un mes es la suma de los de todos. Lo que lee y
 * escribe la base esta en src/datos/sueldos.ts.
 *
 * Cada sueldo rige desde un mes hasta que su dueno anote otro. Cuando alguien
 * sale del hogar, su sueldo se cierra: cada fila queda con el ultimo mes en
 * que rige. Los meses en que estuvo siguen sumando lo que ganaba (el
 * historial no cambia); desde el mes siguiente a su salida, ya no suma.
 */

/** Una fila de sueldo, con los meses como "YYYY-MM". */
export type FilaDeSueldo = {
  /**
   * Quien lo gana. null en el sueldo cerrado de alguien que ya salio, y en el
   * de antes de los hogares mientras «Mi hogar» espera a su dueno (lo recibe
   * al entrar por primera vez).
   */
  miembroId: string | null;
  monto: number;
  vigenteDesde: string;
  /** El ultimo mes en que rige. Solo en un sueldo cerrado. */
  vigenteHasta: string | null;
};

/** Lo que entra al hogar en un mes. */
export type IngresosDelMes = {
  /**
   * La suma de todos. null si ese mes no rige ningun sueldo: "sin sueldo".
   * Incluye el sueldo que todavia espera a su dueno, que no es de ningun miembro.
   */
  total: number | null;
  /** El sueldo de cada miembro que lo tiene anotado para ese mes. */
  porMiembro: ReadonlyMap<string, number>;
  /** Lo que suman, ese mes, quienes ya salieron del hogar. 0 si nadie. */
  deQuienesSalieron: number;
};

function cerrado(fila: FilaDeSueldo): boolean {
  return fila.vigenteHasta !== null;
}

/** Si un sueldo cerrado rige en ese mes: entre su primer y su ultimo mes. */
function rigeCerrado(fila: FilaDeSueldo, mes: string): boolean {
  return compararMeses(fila.vigenteDesde, mes) <= 0 && compararMeses(mes, fila.vigenteHasta as string) <= 0;
}

/** Las filas abiertas sin miembro se agrupan aqui: el sueldo que espera a su dueno. */
const SIN_DUENO = "";

export function ingresosDelMes(sueldos: readonly FilaDeSueldo[], mes: string): IngresosDelMes {
  const deCadaUno = new Map<string, FilaDeSueldo[]>();
  let deQuienesSalieron = 0;
  let rigeAlgunCerrado = false;

  for (const fila of sueldos) {
    if (cerrado(fila)) {
      if (rigeCerrado(fila, mes)) {
        deQuienesSalieron += fila.monto;
        rigeAlgunCerrado = true;
      }
    } else {
      const quien = fila.miembroId ?? SIN_DUENO;
      const suyas = deCadaUno.get(quien) ?? [];
      suyas.push(fila);
      deCadaUno.set(quien, suyas);
    }
  }

  const porMiembro = new Map<string, number>();
  let sinDueno: number | null = null;
  for (const [quien, suyas] of deCadaUno) {
    const monto = sueldoVigente(suyas, mes);
    if (monto === null) continue;
    if (quien === SIN_DUENO) sinDueno = monto;
    else porMiembro.set(quien, monto);
  }

  const sinNada = porMiembro.size === 0 && !rigeAlgunCerrado && sinDueno === null;
  let total = deQuienesSalieron + (sinDueno ?? 0);
  for (const monto of porMiembro.values()) total += monto;

  return { total: sinNada ? null : total, porMiembro, deQuienesSalieron };
}

/**
 * Como se cierra el sueldo de alguien que sale del hogar en `mes`: su sueldo
 * cuenta hasta ese mes, inclusive (el presupuesto del mes en curso no cambia
 * de golpe), y desde el siguiente ya no.
 *
 * - Lo que anoto para meses posteriores se borra: nunca llego a regir.
 * - Cada fila que queda rige hasta el mes antes de la siguiente; la ultima,
 *   hasta `mes`.
 */
export function cierreDeSueldos(
  filas: readonly { id: string; vigenteDesde: string }[],
  mes: string,
): { borrar: string[]; cerrar: { id: string; vigenteHasta: string }[] } {
  const enOrden = [...filas].sort((a, b) => compararMeses(a.vigenteDesde, b.vigenteDesde));
  const borrar = enOrden.filter((f) => compararMeses(f.vigenteDesde, mes) > 0).map((f) => f.id);
  const quedan = enOrden.filter((f) => compararMeses(f.vigenteDesde, mes) <= 0);

  const cerrar = quedan.map((fila, i) => {
    const siguiente = quedan[i + 1];
    return { id: fila.id, vigenteHasta: siguiente === undefined ? mes : sumarMeses(siguiente.vigenteDesde, -1) };
  });

  return { borrar, cerrar };
}

/** El sueldo de un miembro, como se muestra en el balance. */
export type Aporte = {
  miembroId: string;
  /** El primer nombre, o el correo si Google no lo dio. */
  nombre: string;
  /** null si no ha anotado su sueldo para ese mes. */
  monto: number | null;
  /** Si es el de quien mira: es el unico que puede cambiar. */
  esTuyo: boolean;
};

/**
 * Una fila por cada miembro que ya entro al hogar, en el orden en que llegan
 * (el del hogar: el dueno primero). Los que tienen la invitacion pendiente no
 * aparecen: todavia no pueden anotar nada.
 */
export function aportesDelMes(
  miembros: readonly { id: string; nombre: string | null; correo: string; entroEn: Date | string | null }[],
  ingresos: IngresosDelMes,
  yo: string,
): Aporte[] {
  return miembros
    .filter((m) => m.entroEn !== null)
    .map((m) => ({
      miembroId: m.id,
      nombre: primerNombre(m),
      monto: ingresos.porMiembro.get(m.id) ?? null,
      esTuyo: m.id === yo,
    }));
}

/**
 * Si el balance muestra el detalle por persona: solo cuando hay mas de una
 * fila que mostrar. Con una sola persona, el detalle diria lo mismo que el total.
 */
export function mostrarAportes(aportes: readonly Aporte[], deQuienesSalieron: number): boolean {
  return aportes.length + (deQuienesSalieron > 0 ? 1 : 0) > 1;
}
