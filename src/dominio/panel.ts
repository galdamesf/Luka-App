import type { Balance } from "./balance";
import { agruparPendientes, DIAS_POR_VENCER, type ResumenCuentas } from "./cuentas";
import type { GastoPlano, ResumenMensual } from "./resumen";

/**
 * El resumen de arriba del dashboard: las cuatro cifras del mes y la barra
 * del sueldo (gastado, comprometido y libre).
 *
 * No calcula nada nuevo sobre los gastos: junta lo que ya sacan resumirMes,
 * calcularBalance y resumirCuentas, para que las tarjetas y la secuencia del
 * balance digan siempre lo mismo. La regla que lo amarra es
 * sueldo - gastado = disponible = el "Te queda" del balance.
 */

export type Tono = "exito" | "alerta" | "peligro";

/** Desde donde lo usado pasa a advertencia. El mismo 80% de los presupuestos. */
export const UMBRAL_ATENCION = 80;

export { DIAS_POR_VENCER };

export function tonoDeUso(porcentaje: number): Tono {
  if (porcentaje >= 100) return "peligro";
  if (porcentaje >= UMBRAL_ATENCION) return "alerta";
  return "exito";
}

export type EntradaPanel = {
  mes: string;
  /** Hoy, "YYYY-MM-DD". */
  hoy: string;
  diasDelMes: number;
  balance: Balance;
  resumen: ResumenMensual;
  cuentas: ResumenCuentas;
  /** Gastos del mes anterior, cuotas incluidas, para comparar al mismo dia. */
  gastosMesAnterior: readonly GastoPlano[];
};

export type BarraDelSueldo = {
  /** Lo gastado como parte del sueldo. Sin tope: pasarse se tiene que ver. */
  gastadoPct: number;
  /** Lo que falta pagar como parte del sueldo. */
  comprometidoPct: number;
  /** Lo que queda libre, 0 a 100. */
  librePct: number;
  /** sueldo - gastado - por pagar. Negativo si no alcanza. */
  libre: number;
  /** Tono de lo gastado solo. */
  tonoGastado: Tono;
  /** Tono de lo gastado mas lo comprometido: como vas a terminar el mes. */
  tono: Tono;
  /** Que parte del mes ya paso, 0 a 100. null si no es el mes en curso. */
  marcadorDia: number | null;
  diaDeHoy: number | null;
  /** Dias que quedan contando hoy. 0 en un mes cerrado. */
  diasRestantes: number;
  /** Lo libre repartido en los dias que quedan. null si no hay que repartir. */
  librePorDia: number | null;
  /**
   * Puntos entre lo que paso del mes y lo que ya gastaste. Positivo: vas bajo
   * el ritmo. null fuera del mes en curso, donde no hay ritmo que comparar.
   */
  ritmo: number | null;
};

export type ResumenPanel = {
  sinSueldo: boolean;
  sueldo: number;
  /** Gastos del mes mas cuotas ya pagadas: toda la plata que salio. */
  gastado: number;
  /** La parte de `gastado` que fue cuotas. */
  cuotasPagadas: number;
  /** sueldo - gastado. */
  disponible: number;
  /** Cuentas pendientes mas cuotas sin pagar. */
  porPagar: number;
  /** disponible - porPagar. */
  trasPagar: number;
  cuentasVencidas: number;
  montoVencido: number;
  /** Cuentas pendientes que vencen hoy o en los proximos DIAS_POR_VENCER. */
  porVencer: number;
  /** El resto de lo pendiente: cuentas mas adelante o sin fecha, y cuotas. */
  programadas: number;
  /**
   * Cuanto subio o bajo el gasto contra el mes anterior hasta el mismo dia,
   * en %. null si el mes anterior no tiene con que comparar.
   */
  variacion: number | null;
  /** Hasta que dia se comparo con el mes anterior. */
  diaComparado: number;
  barra: BarraDelSueldo;
};

function diaDe(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function armarResumenPanel({
  mes,
  hoy,
  diasDelMes,
  balance,
  resumen,
  cuentas,
  gastosMesAnterior,
}: EntradaPanel): ResumenPanel {
  const mesDeHoy = hoy.slice(0, 7);
  const enCurso = mes === mesDeHoy;
  const cerrado = mes < mesDeHoy;

  const sueldo = balance.sueldo;
  const cuotasPagadas = balance.cuotas;
  const gastado = resumen.total + cuotasPagadas;
  const disponible = sueldo - gastado;

  const cuotasPendientes = balance.cuotasDelMes.filter((c) => !c.pagada).length;
  const porPagar = cuentas.totalPendiente + balance.cuotasPorPagar;

  const grupos = agruparPendientes(cuentas, diasDelMes, hoy);
  const porVencer = grupos.porVencer.length;
  const programadas = grupos.programadas.length + cuotasPendientes;

  // Mes en curso: hasta hoy. Mes cerrado: el mes entero. Mes futuro: nada.
  const diaComparado = enCurso ? diaDe(hoy) : cerrado ? diasDelMes : 0;
  // Un mes cerrado se compara con el anterior ENTERO, no hasta su ultimo dia:
  // septiembre tiene 30 y cortar ahi dejaria fuera el 31 de agosto.
  const anterior = gastosMesAnterior
    .filter((g) => cerrado || diaDe(g.fecha) <= diaComparado)
    .reduce((suma, g) => suma + g.monto, 0);
  // Sin gasto en el mes anterior no se subio un 100%: no hay comparacion.
  const variacion = anterior === 0 ? null : ((gastado - anterior) / anterior) * 100;

  const pct = (parte: number) => (sueldo === 0 ? 0 : (parte / sueldo) * 100);
  const gastadoPct = pct(gastado);
  const comprometidoPct = pct(porPagar);
  const libre = sueldo - gastado - porPagar;
  const diaDeHoy = enCurso ? diaDe(hoy) : null;
  const diasRestantes = enCurso ? diasDelMes - diaDe(hoy) + 1 : cerrado ? 0 : diasDelMes;
  const marcadorDia = diaDeHoy === null ? null : (diaDeHoy / diasDelMes) * 100;

  return {
    sinSueldo: balance.sinSueldo,
    sueldo,
    gastado,
    cuotasPagadas,
    disponible,
    porPagar,
    trasPagar: disponible - porPagar,
    cuentasVencidas: cuentas.vencidas.length,
    montoVencido: cuentas.vencidas.reduce((suma, c) => suma + c.monto, 0),
    porVencer,
    programadas,
    variacion,
    diaComparado,
    barra: {
      gastadoPct,
      comprometidoPct,
      librePct: sueldo === 0 ? 0 : Math.max(0, pct(libre)),
      libre,
      tonoGastado: tonoDeUso(gastadoPct),
      tono: tonoDeUso(gastadoPct + comprometidoPct),
      marcadorDia,
      diaDeHoy,
      diasRestantes,
      librePorDia: libre > 0 && diasRestantes > 0 ? Math.floor(libre / diasRestantes) : null,
      ritmo: marcadorDia === null || sueldo === 0 ? null : marcadorDia - gastadoPct,
    },
  };
}
