import { fechaDesdeISO, hoyISO } from "@/lib/fecha";
import type { CategoriaPlana } from "./resumen";

export type CuentaPlana = {
  id: string;
  nombre: string;
  monto: number;
  /** Mes al que corresponde, "YYYY-MM". */
  mes: string;
  /** Dia del mes en que vence, o null si no se indico. */
  diaVencimiento: number | null;
  categoria: CategoriaPlana;
  /** Fecha exacta de pago, "YYYY-MM-DD", o null si sigue pendiente. */
  pagadaEn: string | null;
  gastoId: string | null;
  mensual: boolean;
  boletaArchivo: string | null;
  nota: string | null;
};

export type ResumenCuentas = {
  mes: string;
  pendientes: CuentaPlana[];
  pagadas: CuentaPlana[];
  /** Pendientes cuyo dia de vencimiento ya paso. Solo para el mes en curso. */
  vencidas: CuentaPlana[];
  totalPendiente: number;
  totalPagado: number;
  /** Lo que suma el mes entero, pagado o no. */
  total: number;
};

export function estaPagada(cuenta: CuentaPlana): boolean {
  return cuenta.pagadaEn !== null;
}

/**
 * Fecha de vencimiento como "YYYY-MM-DD", o null si la cuenta no tiene dia.
 *
 * Si el dia no existe en ese mes (un vencimiento el 31 en febrero) se corre al
 * ultimo dia del mes, que es lo que hacen las empresas de servicios.
 */
export function fechaDeVencimiento(cuenta: CuentaPlana, diasDelMes: number): string | null {
  if (cuenta.diaVencimiento === null) return null;
  const dia = Math.min(cuenta.diaVencimiento, diasDelMes);
  return `${cuenta.mes}-${String(dia).padStart(2, "0")}`;
}

/**
 * Ordena las cuentas como conviene mirarlas: primero lo que falta pagar, y
 * dentro de eso lo que vence antes. Las sin fecha de vencimiento van al final
 * de su grupo, no al principio.
 */
function porVencimiento(a: CuentaPlana, b: CuentaPlana): number {
  const diaA = a.diaVencimiento ?? 99;
  const diaB = b.diaVencimiento ?? 99;
  return diaA - diaB || a.nombre.localeCompare(b.nombre, "es");
}

/** Las pagadas se miran al reves: lo ultimo que pagaste, primero. */
function porPago(a: CuentaPlana, b: CuentaPlana): number {
  return (b.pagadaEn ?? "").localeCompare(a.pagadaEn ?? "") ||
    a.nombre.localeCompare(b.nombre, "es");
}

export function resumirCuentas(
  cuentas: readonly CuentaPlana[],
  mes: string,
  diasDelMes: number,
  hoy: string = hoyISO(),
): ResumenCuentas {
  const delMes = cuentas.filter((c) => c.mes === mes);

  const pendientes = delMes.filter((c) => !estaPagada(c)).sort(porVencimiento);
  const pagadas = delMes.filter(estaPagada).sort(porPago);

  // Vencida es la que ya paso su fecha y sigue sin pagarse. Para un mes
  // futuro esto siempre da vacio, que es lo correcto.
  const vencidas = pendientes.filter((c) => {
    const vence = fechaDeVencimiento(c, diasDelMes);
    return vence !== null && vence < hoy;
  });

  const totalPendiente = pendientes.reduce((s, c) => s + c.monto, 0);
  const totalPagado = pagadas.reduce((s, c) => s + c.monto, 0);

  return {
    mes,
    pendientes,
    pagadas,
    vencidas,
    totalPendiente,
    totalPagado,
    total: totalPendiente + totalPagado,
  };
}

/**
 * Cuentas mensuales que deberian existir en `mes` y todavia no estan.
 *
 * Se toman las mensuales del mes anterior: asi la cadena se mantiene sola mes
 * a mes, y el monto que se propone es el ultimo que se pago de verdad, que es
 * mejor referencia que el original.
 *
 * Devuelve los datos a crear, no los crea: la decision de escribir es de la
 * capa de datos.
 */
export function mensualesQueFaltan(
  delMesAnterior: readonly CuentaPlana[],
  yaEnEsteMes: readonly CuentaPlana[],
): Array<{
  nombre: string;
  monto: number;
  diaVencimiento: number | null;
  categoriaId: string;
}> {
  const existentes = new Set(yaEnEsteMes.map((c) => c.nombre));

  return delMesAnterior
    .filter((c) => c.mensual && !existentes.has(c.nombre))
    .map((c) => ({
      nombre: c.nombre,
      monto: c.monto,
      diaVencimiento: c.diaVencimiento,
      categoriaId: c.categoria.id,
    }));
}

/** Una cuenta que vence dentro de estos dias se avisa como "por vencer". */
export const DIAS_POR_VENCER = 7;

export type PendientesAgrupadas = {
  /** Ya paso su fecha y sigue sin pagarse. */
  vencidas: CuentaPlana[];
  /** Vence hoy o dentro de DIAS_POR_VENCER. */
  porVencer: CuentaPlana[];
  /** Mas adelante, o sin dia de vencimiento. */
  programadas: CuentaPlana[];
};

/**
 * Lo pendiente del mes ordenado por urgencia, que es como se mira a fin de
 * mes: primero lo atrasado, despues lo de esta semana, despues el resto. El
 * orden dentro de cada grupo es el de resumirCuentas (por vencimiento).
 */
export function agruparPendientes(
  resumen: ResumenCuentas,
  diasDelMes: number,
  hoy: string = hoyISO(),
): PendientesAgrupadas {
  const idsVencidas = new Set(resumen.vencidas.map((c) => c.id));
  const porVencer: CuentaPlana[] = [];
  const programadas: CuentaPlana[] = [];

  for (const cuenta of resumen.pendientes) {
    if (idsVencidas.has(cuenta.id)) continue;
    const vence = fechaDeVencimiento(cuenta, diasDelMes);
    const dias =
      vence === null
        ? null
        : Math.round((fechaDesdeISO(vence).getTime() - fechaDesdeISO(hoy).getTime()) / 86_400_000);
    if (dias !== null && dias >= 0 && dias <= DIAS_POR_VENCER) porVencer.push(cuenta);
    else programadas.push(cuenta);
  }

  return { vencidas: resumen.pendientes.filter((c) => idsVencidas.has(c.id)), porVencer, programadas };
}
