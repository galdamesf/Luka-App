import { diasEnMesISO, isoDesdeFecha, mesActual } from "@/lib/fecha";
import type { MedioPago } from "./esquemas";

export type CategoriaPlana = {
  id: string;
  nombre: string;
  color: string;
  icono: string;
  esencial: boolean;
};

export type GastoPlano = {
  id: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  monto: number;
  medioPago: MedioPago;
  notas: string | null;
  /** Nombre del archivo de la boleta, si tiene. */
  boletaArchivo: string | null;
  categoria: CategoriaPlana;
  /**
   * La cuota de deuda que genero este gasto, si vino de ahi.
   *
   * Los gastos de cuota NO se suman con los demas: el balance ya descuenta
   * las cuotas por su lado, y contarlas tambien aqui restaria la misma plata
   * dos veces. Por eso viven en su propia seccion.
   */
  cuota: { deudaId: string; deudaNombre: string } | null;
};

export type LineaCategoria = {
  categoria: CategoriaPlana;
  total: number;
  cantidad: number;
  /** 0 a 100, sin redondear: la interfaz decide cuantos decimales muestra. */
  porcentaje: number;
};

export type ResumenMensual = {
  mes: string;
  total: number;
  cantidad: number;
  /** Suma de las categorias marcadas como esenciales. */
  esenciales: number;
  /** El resto. esenciales + discrecionales === total, siempre. */
  discrecionales: number;
  porCategoria: LineaCategoria[];
  /** Los gastos que son pago de una cuota. Van aparte de los demas. */
  cuotasPagadas: GastoPlano[];
  /** Suma de esos pagos de cuota. */
  totalCuotas: number;
  /** Dias distintos en que hubo al menos un gasto. */
  diasConGasto: number;
  /**
   * Promedio por dia. Para el mes en curso divide por los dias transcurridos,
   * no por los del mes completo: dividir $300.000 por 31 un dia 5 daria una
   * cifra que no significa nada.
   */
  promedioDiario: number;
  /** Divisor usado, para poder explicarlo en la interfaz. */
  diasConsiderados: number;
  /** true si el promedio se calculo sobre dias transcurridos. */
  mesEnCurso: boolean;
  mayorGasto: GastoPlano | null;
};

/**
 * Arma el resumen de un mes a partir de los gastos ya filtrados.
 *
 * No consulta la base: recibe las filas y calcula. Asi se puede probar con
 * datos armados a mano y sin Postgres de por medio.
 *
 * @param gastos Gastos del mes. Se ignoran los que caigan fuera.
 * @param mes    "YYYY-MM".
 * @param hoy    Dia de referencia para el mes en curso. Inyectable para tests.
 */
export function resumirMes(
  gastos: readonly GastoPlano[],
  mes: string,
  hoy: Date = new Date(),
  zona = "America/Santiago",
): ResumenMensual {
  const todos = gastos.filter((g) => g.fecha.startsWith(mes));

  // Los pagos de cuota se apartan antes de sumar nada. Si entraran al total,
  // el balance restaria la cuota dos veces: una como cuota y otra como gasto.
  const cuotasPagadas = todos.filter((g) => g.cuota !== null);
  const delMes = todos.filter((g) => g.cuota === null);

  const totalCuotas = cuotasPagadas.reduce((suma, g) => suma + g.monto, 0);
  const total = delMes.reduce((suma, g) => suma + g.monto, 0);
  const esenciales = delMes
    .filter((g) => g.categoria.esencial)
    .reduce((suma, g) => suma + g.monto, 0);

  // Agrupar por categoria conservando los datos de la categoria.
  const acumulado = new Map<string, { categoria: CategoriaPlana; total: number; cantidad: number }>();
  for (const gasto of delMes) {
    const actual = acumulado.get(gasto.categoria.id);
    if (actual) {
      actual.total += gasto.monto;
      actual.cantidad += 1;
    } else {
      acumulado.set(gasto.categoria.id, {
        categoria: gasto.categoria,
        total: gasto.monto,
        cantidad: 1,
      });
    }
  }

  const porCategoria: LineaCategoria[] = [...acumulado.values()]
    .map((fila) => ({
      ...fila,
      // Sin gastos el total es 0: no se divide por cero.
      porcentaje: total === 0 ? 0 : (fila.total / total) * 100,
    }))
    // De mayor a menor; a igual monto, por nombre, para que el orden sea estable.
    .sort((a, b) => b.total - a.total || a.categoria.nombre.localeCompare(b.categoria.nombre, "es"));

  const diasConGasto = new Set(delMes.map((g) => g.fecha)).size;

  const mesDeHoy = mesActual(zona, hoy);
  const mesEnCurso = mes === mesDeHoy;
  const diasDelMes = diasEnMesISO(mes);
  const diasConsiderados = mesEnCurso
    ? Number(isoDesdeFechaLocal(hoy, zona).slice(8, 10))
    : diasDelMes;

  const mayorGasto =
    delMes.length === 0
      ? null
      : delMes.reduce((mayor, g) => (g.monto > mayor.monto ? g : mayor), delMes[0] as GastoPlano);

  return {
    mes,
    total,
    cantidad: delMes.length,
    esenciales,
    discrecionales: total - esenciales,
    porCategoria,
    cuotasPagadas,
    totalCuotas,
    diasConGasto,
    promedioDiario: diasConsiderados === 0 ? 0 : total / diasConsiderados,
    diasConsiderados,
    mesEnCurso,
    mayorGasto,
  };
}

/** Dia de la fecha dada, leido en la zona indicada, como "YYYY-MM-DD". */
function isoDesdeFechaLocal(momento: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(momento);
}

/** Resumen vacio, para pintar un mes sin gastos sin ramificar en la interfaz. */
export function resumenVacio(mes: string, hoy: Date = new Date()): ResumenMensual {
  return resumirMes([], mes, hoy);
}

/** Convierte lo que devuelve Prisma al tipo plano que usa el dominio. */
export function aPlano(fila: {
  id: string;
  fecha: Date;
  descripcion: string;
  monto: number;
  medioPago: string;
  notas: string | null;
  boletaArchivo?: string | null;
  categoria: { id: string; nombre: string; color: string; icono: string; esencial: boolean };
  cuota?: { deudaId: string; deuda?: { nombre: string } | null } | null;
}): GastoPlano {
  return {
    id: fila.id,
    // Siempre por el helper: leer un @db.Date con metodos locales corre el dia.
    fecha: isoDesdeFecha(fila.fecha),
    descripcion: fila.descripcion,
    monto: fila.monto,
    medioPago: fila.medioPago as MedioPago,
    cuota:
      fila.cuota === undefined || fila.cuota === null
        ? null
        : {
            deudaId: fila.cuota.deudaId,
            deudaNombre: fila.cuota.deuda?.nombre ?? "Cuota",
          },
    notas: fila.notas,
    boletaArchivo: fila.boletaArchivo ?? null,
    categoria: fila.categoria,
  };
}
