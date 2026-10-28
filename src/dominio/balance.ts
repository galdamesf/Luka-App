import { compararMeses, mesesEntre, sumarMeses } from "@/lib/fecha";
import type { ResumenMensual } from "./resumen";

/**
 * Deuda en cuotas, como la ve el dominio.
 *
 * Nota de diseno: no se guarda "cuotas pagadas" sino el mes de la PRIMERA
 * cuota. Las dos cosas son equivalentes, pero el mes no se pone viejo: en
 * noviembre la app sola sabe que vas una cuota mas adelante, sin que tengas
 * que marcar nada cada mes.
 *
 * El costo es que asume que las cuotas se pagan al dia. Para planificar el mes
 * eso es lo correcto: la cuota se te va a cobrar igual.
 */
export type DeudaPlana = {
  id: string;
  nombre: string;
  /** Monto de cada cuota, en pesos. */
  montoCuota: number;
  cuotasTotales: number;
  /** Mes de la primera cuota, "YYYY-MM". */
  primeraCuota: string;
  /** false si se pago antes de tiempo o se anulo. */
  activa: boolean;
};

export type CuotaDelMes = {
  deuda: DeudaPlana;
  /** Numero de cuota que toca este mes, partiendo en 1. */
  numero: number;
  /** Cuotas que quedan DESPUES de pagar la de este mes. */
  restantes: number;
  /** Lo que queda por pagar despues de este mes. */
  saldoPendiente: number;
  /** Mes de la ultima cuota, "YYYY-MM". */
  ultimoMes: string;
  /** true si ya se marco pagada. */
  pagada: boolean;
  /** Dia exacto del pago, "YYYY-MM-DD". null si sigue pendiente. */
  pagadaEn: string | null;
  /** Lo que se pago de verdad, que puede diferir de la cuota pactada. */
  montoPagado: number | null;
};

/** Un pago de cuota ya registrado. */
export type PagoCuota = {
  deudaId: string;
  /** Mes de la cuota, "YYYY-MM". */
  mes: string;
  /** Dia exacto del pago, "YYYY-MM-DD". */
  pagadaEn: string;
  monto: number;
};

export type Balance = {
  mes: string;
  sueldo: number;
  /** Gastos del mes en categorias marcadas como esenciales. */
  gastosBasicos: number;
  /**
   * Suma de las cuotas que YA se pagaron este mes. Es lo unico que se
   * descuenta del sueldo: hasta que no confirmes el pago, esa plata sigue en
   * tu cuenta y mostrarla como gastada seria mentir.
   */
  cuotas: number;
  /** Suma de todas las cuotas que caen este mes, pagadas o no. */
  cuotasComprometidas: number;
  /** Lo que falta pagar de cuotas este mes. */
  cuotasPorPagar: number;
  gastosDiscrecionales: number;
  /** sueldo - basicos - cuotas pagadas. Lo que queda para vivir el mes. */
  disponible: number;
  /** disponible - discrecionales. Lo que sobra de verdad. */
  saldo: number;
  enRojo: boolean;
  /** true si todavia no hay sueldo definido: la interfaz lo pide. */
  sinSueldo: boolean;
  /** Que parte del sueldo esta comprometida antes de gastar nada, 0 a 100. */
  porcentajeComprometido: number;
  cuotasDelMes: CuotaDelMes[];
};

/** Mes en que se paga la ultima cuota. */
export function ultimoMesDe(deuda: DeudaPlana): string {
  return sumarMeses(deuda.primeraCuota, deuda.cuotasTotales - 1);
}

/**
 * Cuota que corresponde pagar en `mes`, o null si la deuda no esta vigente
 * ese mes: o todavia no parte, o ya termino, o se marco como inactiva.
 */
export function cuotaEnMes(deuda: DeudaPlana, mes: string): CuotaDelMes | null {
  if (!deuda.activa) return null;
  if (deuda.cuotasTotales < 1) return null;

  const transcurridos = mesesEntre(deuda.primeraCuota, mes);
  if (transcurridos < 0) return null; // todavia no empieza
  if (transcurridos >= deuda.cuotasTotales) return null; // ya termino

  const numero = transcurridos + 1;
  const restantes = deuda.cuotasTotales - numero;

  return {
    deuda,
    numero,
    restantes,
    saldoPendiente: restantes * deuda.montoCuota,
    ultimoMes: ultimoMesDe(deuda),
    // cuotaEnMes solo sabe del calendario de la deuda. Si esta pagada o no
    // lo resuelve calcularBalance, que es quien ve los pagos registrados.
    pagada: false,
    pagadaEn: null,
    montoPagado: null,
  };
}

/** Total que falta por pagar de una deuda, contando desde `mes` inclusive. */
export function saldoDesde(deuda: DeudaPlana, mes: string): number {
  if (!deuda.activa) return 0;

  const transcurridos = mesesEntre(deuda.primeraCuota, mes);
  // Si aun no parte, se debe entera.
  const pagadas = Math.max(0, Math.min(transcurridos, deuda.cuotasTotales));
  return (deuda.cuotasTotales - pagadas) * deuda.montoCuota;
}

type Entrada = {
  mes: string;
  /** Sueldo vigente ese mes. null si todavia no se ha definido ninguno. */
  sueldo: number | null;
  resumen: ResumenMensual;
  deudas: readonly DeudaPlana[];
  /** Cuotas ya pagadas. Sin esto, ninguna cuota se descuenta. */
  pagos?: readonly PagoCuota[];
};

/**
 * Arma la secuencia del mes: entra el sueldo, se descuentan los gastos
 * basicos y las cuotas, y queda el disponible.
 *
 * Las cuotas NO salen de los gastos registrados: se calculan aparte desde las
 * deudas. Por eso una cuota no se anota tambien como gasto, o se contaria dos
 * veces.
 */
export function calcularBalance({
  mes,
  sueldo,
  resumen,
  deudas,
  pagos = [],
}: Entrada): Balance {
  // Un pago por deuda, el de ESTE mes. Si llegaran dos (no deberia: la base
  // lo impide), manda el primero y no se suma dos veces.
  const pagoPorDeuda = new Map<string, PagoCuota>();
  for (const pago of pagos) {
    if (pago.mes === mes && !pagoPorDeuda.has(pago.deudaId)) {
      pagoPorDeuda.set(pago.deudaId, pago);
    }
  }

  const cuotasDelMes = deudas
    .map((deuda) => cuotaEnMes(deuda, mes))
    .filter((cuota): cuota is CuotaDelMes => cuota !== null)
    .map((cuota) => {
      const pago = pagoPorDeuda.get(cuota.deuda.id);
      return {
        ...cuota,
        pagada: pago !== undefined,
        pagadaEn: pago?.pagadaEn ?? null,
        montoPagado: pago?.monto ?? null,
      };
    })
    // De mayor a menor; a igual monto, por nombre, para que el orden no baile.
    .sort(
      (a, b) =>
        b.deuda.montoCuota - a.deuda.montoCuota ||
        a.deuda.nombre.localeCompare(b.deuda.nombre, "es"),
    );

  // Lo pagado usa el monto REAL del pago, no el pactado: una cuota puede
  // llegar con interes o con un abono distinto.
  const cuotas = cuotasDelMes.reduce(
    (suma, c) => suma + (c.montoPagado ?? 0),
    0,
  );
  const cuotasComprometidas = cuotasDelMes.reduce(
    (suma, c) => suma + c.deuda.montoCuota,
    0,
  );
  const cuotasPorPagar = cuotasDelMes
    .filter((c) => !c.pagada)
    .reduce((suma, c) => suma + c.deuda.montoCuota, 0);

  const montoSueldo = sueldo ?? 0;
  const disponible = montoSueldo - resumen.esenciales - cuotas;
  const saldo = disponible - resumen.discrecionales;

  return {
    mes,
    sueldo: montoSueldo,
    gastosBasicos: resumen.esenciales,
    cuotas,
    cuotasComprometidas,
    cuotasPorPagar,
    gastosDiscrecionales: resumen.discrecionales,
    disponible,
    saldo,
    enRojo: saldo < 0,
    sinSueldo: sueldo === null,
    porcentajeComprometido:
      montoSueldo === 0
        ? 0
        : ((resumen.esenciales + cuotasComprometidas) / montoSueldo) * 100,
    cuotasDelMes,
  };
}

/**
 * Sueldo vigente en un mes dado.
 *
 * Los sueldos se guardan con el mes desde el que rigen; vale el mas reciente
 * que no sea posterior al mes consultado. Asi un aumento en marzo no reescribe
 * lo que ganabas en febrero.
 */
export function sueldoVigente(
  sueldos: readonly { monto: number; vigenteDesde: string }[],
  mes: string,
): number | null {
  const aplicables = sueldos
    .filter((s) => compararMeses(s.vigenteDesde, mes) <= 0)
    .sort((a, b) => compararMeses(b.vigenteDesde, a.vigenteDesde));

  return aplicables.length === 0 ? null : (aplicables[0] as { monto: number }).monto;
}
