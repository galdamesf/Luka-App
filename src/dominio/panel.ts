import { aPeriodo, diaDelPeriodo, enPeriodo, periodoVecino, type Periodo } from "@/lib/periodo";
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

/**
 * Los tramos de la barra del sueldo: verde hasta la mitad, ambar hasta el
 * 80% y rojo desde ahi. Son mas tempranos que los de un presupuesto (80 y
 * 100) a proposito: el sueldo es todo lo que hay, y llegar al 80% con lo
 * comprometido ya deja poco margen para el resto del mes.
 */
export const TRAMOS_SUELDO = { atencion: 50, cuidado: 80 } as const;

export function tonoDelSueldo(porcentaje: number): Tono {
  if (porcentaje >= TRAMOS_SUELDO.cuidado) return "peligro";
  if (porcentaje >= TRAMOS_SUELDO.atencion) return "alerta";
  return "exito";
}

/** Un pedazo de la barra, en % del sueldo, con el color de su tramo. */
export type PedazoBarra = { desde: number; hasta: number; tono: Tono };

/**
 * Corta el tramo [desde, hasta] de la barra (en % del sueldo) donde cambia
 * el color, para pintar cada pedazo con el suyo. Lo que pasa del 100% no se
 * dibuja: la barra termina ahi, y pasarse ya lo dice el texto.
 */
export function pedazosPorTramo(desde: number, hasta: number): PedazoBarra[] {
  const recortar = (n: number) => Math.min(100, Math.max(0, n));
  const a = recortar(desde);
  const b = recortar(hasta);
  const cortes = [0, TRAMOS_SUELDO.atencion, TRAMOS_SUELDO.cuidado, 100];
  const pedazos: PedazoBarra[] = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    const inicio = Math.max(a, cortes[i]!);
    const fin = Math.min(b, cortes[i + 1]!);
    if (fin > inicio) pedazos.push({ desde: inicio, hasta: fin, tono: tonoDelSueldo(cortes[i]!) });
  }
  return pedazos;
}

export type EntradaPanel = {
  /** El periodo, o un "YYYY-MM" suelto para el mes calendario. */
  mes: string | Periodo;
  /** Hoy, "YYYY-MM-DD". */
  hoy: string;
  balance: Balance;
  resumen: ResumenMensual;
  cuentas: ResumenCuentas;
  /** Gastos del periodo anterior, cuotas incluidas, para comparar al mismo dia. */
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
  /** Tono de lo gastado solo, segun TRAMOS_SUELDO. */
  tonoGastado: Tono;
  /** Tono de lo gastado mas lo comprometido: como vas a terminar el mes. */
  tono: Tono;
  /** Lo gastado y lo por pagar, cortados donde cambia el color. */
  pedazos: { gastado: PedazoBarra[]; porPagar: PedazoBarra[] };
  /** Que parte del mes ya paso, 0 a 100. null si no es el mes en curso. */
  marcadorDia: number | null;
  /** Que dia del periodo es hoy (el primero es el 1). null fuera del mes en curso. */
  diaDeHoy: number | null;
  /** Hoy, "YYYY-MM-DD", si cae en el periodo. */
  fechaDeHoy: string | null;
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
  /** El periodo que se resume: de que fecha a que fecha. */
  periodo: Periodo;
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
  /** Hasta que dia del periodo se comparo con el anterior. */
  diaComparado: number;
  barra: BarraDelSueldo;
};

export function armarResumenPanel({
  mes,
  hoy,
  balance,
  resumen,
  cuentas,
  gastosMesAnterior,
}: EntradaPanel): ResumenPanel {
  const periodo = aPeriodo(mes);
  const anteriorPeriodo = periodoVecino(periodo, -1);
  const diasDelMes = periodo.dias;
  const enCurso = enPeriodo(hoy, periodo);
  const cerrado = hoy > periodo.hasta;

  const sueldo = balance.sueldo;
  const cuotasPagadas = balance.cuotas;
  const gastado = resumen.total + cuotasPagadas;
  const disponible = sueldo - gastado;

  const cuotasPendientes = balance.cuotasDelMes.filter((c) => !c.pagada).length;
  const porPagar = cuentas.totalPendiente + balance.cuotasPorPagar;

  const grupos = agruparPendientes(cuentas, hoy);
  const porVencer = grupos.porVencer.length;
  const programadas = grupos.programadas.length + cuotasPendientes;

  // Mes en curso: hasta hoy. Mes cerrado: el mes entero. Mes futuro: nada.
  // Los dias se cuentan desde el inicio de cada periodo: el dia 7 de este se
  // compara con el dia 7 del anterior.
  const diaComparado = enCurso ? diaDelPeriodo(hoy, periodo) : cerrado ? diasDelMes : 0;
  // Un mes cerrado se compara con el anterior ENTERO, no hasta su ultimo dia:
  // septiembre tiene 30 y cortar ahi dejaria fuera el 31 de agosto.
  const anterior = gastosMesAnterior
    .filter((g) => enPeriodo(g.fecha, anteriorPeriodo))
    .filter((g) => cerrado || diaDelPeriodo(g.fecha, anteriorPeriodo) <= diaComparado)
    .reduce((suma, g) => suma + g.monto, 0);
  // Sin gasto en el mes anterior no se subio un 100%: no hay comparacion.
  const variacion = anterior === 0 ? null : ((gastado - anterior) / anterior) * 100;

  const pct = (parte: number) => (sueldo === 0 ? 0 : (parte / sueldo) * 100);
  const gastadoPct = pct(gastado);
  const comprometidoPct = pct(porPagar);
  const libre = sueldo - gastado - porPagar;
  const diaDeHoy = enCurso ? diaDelPeriodo(hoy, periodo) : null;
  const diasRestantes = diaDeHoy !== null ? diasDelMes - diaDeHoy + 1 : cerrado ? 0 : diasDelMes;
  const marcadorDia = diaDeHoy === null ? null : (diaDeHoy / diasDelMes) * 100;

  return {
    periodo,
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
      tonoGastado: tonoDelSueldo(gastadoPct),
      tono: tonoDelSueldo(gastadoPct + comprometidoPct),
      pedazos: {
        gastado: pedazosPorTramo(0, gastadoPct),
        porPagar: pedazosPorTramo(gastadoPct, gastadoPct + comprometidoPct),
      },
      marcadorDia,
      diaDeHoy,
      fechaDeHoy: enCurso ? hoy : null,
      diasRestantes,
      librePorDia: libre > 0 && diasRestantes > 0 ? Math.floor(libre / diasRestantes) : null,
      ritmo: marcadorDia === null || sueldo === 0 ? null : marcadorDia - gastadoPct,
    },
  };
}
