import { diasEnMesISO, fechaDesdeISO, isoDesdeFecha, sumarMeses } from "./fecha";

/**
 * El "mes" de gastos: del dia en que te pagan hasta el dia anterior del mes
 * siguiente. Con dia 1 es el mes calendario de siempre.
 *
 * El nombre del periodo es el mes donde cae la mayor parte de sus dias:
 *
 * - Si empieza entre el 1 y el 15, el mes en que EMPIEZA. Con dia 5,
 *   octubre va del 5 de octubre al 4 de noviembre.
 * - Si empieza del 16 en adelante, el mes en que TERMINA. Con dia 27,
 *   noviembre va del 27 de octubre al 26 de noviembre: el sueldo que llega
 *   el 27 de octubre es el de noviembre.
 *
 * La regla depende solo del dia, nunca del largo de cada mes: asi no hay dos
 * periodos con el mismo nombre ni un mes que se salte.
 *
 * Si el dia de inicio no existe en un mes (el 31 en febrero), ese mes empieza
 * en su ultimo dia. Los periodos quedan pegados uno tras otro, sin huecos ni
 * dias repetidos.
 *
 * Todo trabaja con fechas "YYYY-MM-DD", que se comparan bien como texto.
 */

export const DIA_INICIO_MINIMO = 1;
export const DIA_INICIO_MAXIMO = 31;

/** Desde este dia de inicio, el periodo lleva el nombre del mes en que termina. */
export const DIA_NOMBRE_MES_SIGUIENTE = 16;

export type Periodo = {
  /** "YYYY-MM": su nombre. Ver la regla arriba. */
  mes: string;
  /** El dia de inicio con que se armo, 1 a 31. */
  diaInicio: number;
  /** Primer dia, "YYYY-MM-DD". */
  desde: string;
  /** Ultimo dia, inclusive. */
  hasta: string;
  /** Cuantos dias tiene: entre 28 y 31. */
  dias: number;
};

const UN_DIA = 86_400_000;
const dosDigitos = (n: number) => String(n).padStart(2, "0");

function validarDia(diaInicio: number): void {
  if (!Number.isInteger(diaInicio) || diaInicio < DIA_INICIO_MINIMO || diaInicio > DIA_INICIO_MAXIMO) {
    throw new Error(`Dia de inicio invalido: ${diaInicio}. Debe estar entre 1 y 31.`);
  }
}

/** "2026-10-27" mas `cantidad` dias. */
export function sumarDias(fecha: string, cantidad: number): string {
  return isoDesdeFecha(new Date(fechaDesdeISO(fecha).getTime() + cantidad * UN_DIA));
}

/** Dias de `desde` a `hasta`: del 27 al 28 es 1. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((fechaDesdeISO(hasta).getTime() - fechaDesdeISO(desde).getTime()) / UN_DIA);
}

/** El dia del mes `mes`, corrido al ultimo si ese mes no lo tiene. */
function diaDelMes(mes: string, dia: number): string {
  return `${mes}-${dosDigitos(Math.min(dia, diasEnMesISO(mes)))}`;
}

/** El mes calendario en que empieza el periodo que se llama `mes`. */
function mesDeInicio(mes: string, diaInicio: number): string {
  return diaInicio >= DIA_NOMBRE_MES_SIGUIENTE ? sumarMeses(mes, -1) : mes;
}

/** El periodo que se llama `mes`. */
export function periodoDe(mes: string, diaInicio = 1): Periodo {
  validarDia(diaInicio);
  const inicio = mesDeInicio(mes, diaInicio);
  const desde = diaDelMes(inicio, diaInicio);
  const siguiente = diaDelMes(sumarMeses(inicio, 1), diaInicio);
  return { mes, diaInicio, desde, hasta: sumarDias(siguiente, -1), dias: diasEntre(desde, siguiente) };
}

/** El periodo en que cae una fecha. El 2 de noviembre, con dia 27, es noviembre (27 oct – 26 nov). */
export function periodoDeFecha(fecha: string, diaInicio = 1): Periodo {
  validarDia(diaInicio);
  // El que lleva el nombre del mes de la fecha la contiene, o le toca al de
  // al lado: ningun periodo dura mas de un mes.
  const candidato = periodoDe(fecha.slice(0, 7), diaInicio);
  if (fecha < candidato.desde) return periodoVecino(candidato, -1);
  if (fecha > candidato.hasta) return periodoVecino(candidato, 1);
  return candidato;
}

/**
 * Los calculos aceptan un periodo o un "YYYY-MM" suelto. El mes suelto es el
 * mes calendario (dia 1): es lo que ya usaban y siguen usando los tests.
 */
export function aPeriodo(mes: string | Periodo): Periodo {
  return typeof mes === "string" ? periodoDe(mes, 1) : mes;
}

/** El periodo `salto` meses mas alla (o mas aca, con negativo), con el mismo dia de inicio. */
export function periodoVecino(periodo: Periodo, salto: number): Periodo {
  return periodoDe(sumarMeses(periodo.mes, salto), periodo.diaInicio);
}

export function enPeriodo(fecha: string, periodo: Periodo): boolean {
  return fecha >= periodo.desde && fecha <= periodo.hasta;
}

/** Que dia del periodo es una fecha: el primero es el 1. */
export function diaDelPeriodo(fecha: string, periodo: Periodo): number {
  return diasEntre(periodo.desde, fecha) + 1;
}

/** La fecha del dia `numero` del periodo (el 1 es `desde`). */
export function fechaDelPeriodo(periodo: Periodo, numero: number): string {
  return sumarDias(periodo.desde, numero - 1);
}

/** Rango semiabierto [desde, hasta) en medianoche UTC, para consultar con gte/lt. */
export function rangoDelPeriodo(periodo: Periodo): { desde: Date; hasta: Date } {
  return { desde: fechaDesdeISO(periodo.desde), hasta: fechaDesdeISO(sumarDias(periodo.hasta, 1)) };
}

/**
 * La fecha en que cae, dentro del periodo, algo que vence el dia `dia` de
 * cada mes. Con dia de inicio 27, en noviembre (27 oct – 26 nov) una cuenta
 * que vence el 5 cae el 5 de noviembre, y una que vence el 30, el 30 de
 * octubre.
 *
 * Nunca se sale del periodo: si el dia no existe (el 30 en un periodo que
 * termina el 27 de febrero) queda en el ultimo dia.
 */
export function vencimientoEnPeriodo(periodo: Periodo, dia: number): string {
  const primerMes = periodo.desde.slice(0, 7);
  const enElPrimerMes = diaDelMes(primerMes, dia);
  const fecha = enElPrimerMes >= periodo.desde ? enElPrimerMes : diaDelMes(sumarMeses(primerMes, 1), dia);
  return fecha > periodo.hasta ? periodo.hasta : fecha;
}
