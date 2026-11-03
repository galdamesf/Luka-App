import { esPagoDeCuota, type CategoriaPlana, type GastoPlano } from "./resumen";
import type { ResumenPresupuestos } from "./presupuestos";

/**
 * Lo que te quedaria del sueldo al cerrar el mes, despues de TODO lo que ya
 * tiene destino:
 *
 *   sueldo
 *   - pagos realizados   (gastos del mes, cuentas ya pagadas incluidas, y cuotas pagadas)
 *   - cuentas por pagar
 *   - cuotas por pagar
 *   - presupuesto por gastar
 *   - ahorro del mes
 *   = te quedaria
 *
 * La trampa es contar dos veces la misma plata, y hay dos lugares donde pasa:
 *
 * - Una cuenta pagada ya es un gasto (se crea al marcarla pagada), asi que va
 *   en "pagos realizados" y no en "cuentas".
 * - Del presupuesto se descuenta solo lo que FALTA gastar, no el monto
 *   completo: lo gastado ya esta en "pagos realizados". Y si una cuenta
 *   pendiente es de una categoria con presupuesto (la luz en "Cuentas"), esa
 *   cuenta ya se resta en "cuentas por pagar" y se saca tambien de lo que
 *   falta gastar del presupuesto.
 *
 * En un mes cerrado el presupuesto que no se gasto ya no se va a gastar: no
 * se descuenta. Funcion pura, sin Prisma ni React.
 *
 * Ademas de la cifra final entrega dos que responden preguntas directas:
 * "libre" (cuanto hay para el mes despues de pagar todo lo comprometido) y
 * "puedes ahorrar" (lo que sobraria despues de gastar los presupuestos),
 * comparado con la meta de ahorro.
 */

export type EstadoDelMes = "en-curso" | "cerrado" | "futuro";
export type EstadoQueda = "sobra" | "ajustado" | "falta";

/** Bajo este % del sueldo, lo que queda se muestra como "ajustado". */
export const UMBRAL_AJUSTADO = 10;

export type EntradaLoQueQueda = {
  /** null si todavia no hay sueldo definido. */
  sueldo: number | null;
  /** Gastos del mes sin las cuotas (resumirMes().total). */
  gastos: number;
  /** Cuotas de deudas ya pagadas este mes. */
  cuotasPagadas: number;
  cuentasPorPagar: { total: number; cantidad: number };
  cuotasPorPagar: { total: number; cantidad: number };
  presupuestos: Pick<ResumenPresupuestos, "lineas">;
  /** Cuentas pendientes por id de categoria. */
  comprometidoPorCategoria: Readonly<Record<string, number>>;
  /** Los ahorros apartados este mes. */
  ahorros: readonly { monto: number }[];
  /** Dias que quedan contando hoy (ResumenPanel.barra.diasRestantes). */
  diasRestantes: number;
  estado: EstadoDelMes;
  /** Cuanto deberias apartar este mes (el % de meta sobre el sueldo). null sin meta. */
  metaAhorro?: number | null;
  /**
   * Los gastos del mes, para abrir "pagos realizados" en sus partes. Sin
   * ellos no hay desglose. Cada gasto tiene que traer `cuenta` (si es el
   * pago de una cuenta), que es lo que viene de la base.
   */
  gastosDelMes?: readonly GastoPlano[];
};

/** Un gasto fuera de presupuesto, de los mas grandes, para nombrarlo. */
export type GastoDestacado = { id: string; descripcion: string; monto: number; categoria: CategoriaPlana };

/**
 * "Pagos realizados" abierto en tres: suman exactamente lo mismo.
 * Lo que se come el ahorro sin aviso es lo de fuera de presupuesto.
 */
export type DesglosePagado = {
  /** Cuentas pagadas este mes mas cuotas pagadas: lo que ya estaba previsto. */
  cuentasYCuotas: number;
  /** Gastos en categorias que tienen presupuesto (super, bencina...). */
  dentroDePresupuesto: number;
  /** Todo lo demas: imprevistos y gastos sin presupuesto. */
  fueraDePresupuesto: { total: number; cantidad: number; mayores: GastoDestacado[] };
};

export type MetaAhorro = {
  /** Lo que pide la meta este mes. */
  monto: number;
  /** Lo ya apartado este mes. */
  apartado: number;
  /** Lo que falta apartar para cumplirla. Cero si ya se cumplio. */
  porApartar: number;
  /** Si lo que puedes ahorrar alcanza para lo que falta. */
  alcanza: boolean;
  /** Si alcanza, lo que sobra despues de cumplirla; si no, lo que falta. */
  diferencia: number;
};

/** Cuantos gastos de fuera de presupuesto se nombran. */
export const MAYORES_FUERA = 3;

export type LineaPorGastar = {
  categoria: CategoriaPlana;
  presupuesto: number;
  gastado: number;
  /** Cuentas pendientes de esa categoria, que ya se cuentan aparte. */
  enCuentas: number;
  /** presupuesto - gastado - enCuentas, nunca menos que cero. */
  porGastar: number;
};

export type LoQueQueda = {
  sinSueldo: boolean;
  sueldo: number;
  pagado: { gastos: number; cuotas: number; total: number; detalle: DesglosePagado | null };
  cuentasPorPagar: { total: number; cantidad: number };
  cuotasPorPagar: { total: number; cantidad: number };
  /** Solo las categorias a las que todavia les queda, de mayor a menor. */
  presupuestoPorGastar: { total: number; lineas: LineaPorGastar[] };
  ahorro: { total: number; cantidad: number };
  /** Todo lo que se resta del sueldo. */
  descuentos: number;
  /**
   * sueldo - pagado - cuentas por pagar - cuotas por pagar: lo que hay para
   * el mes una vez pagado todo lo comprometido, antes de presupuestos y ahorro.
   */
  libre: number;
  /** sueldo - descuentos. Negativo si no alcanza. */
  quedaria: number;
  /** Lo que todavia podrias apartar: lo que quedaria, si es positivo. */
  puedesAhorrar: number;
  meta: MetaAhorro | null;
  /** quedaria como parte del sueldo. null sin sueldo o con sueldo cero. */
  porcentajeDelSueldo: number | null;
  /** Lo que quedaria repartido en los dias que faltan. null si no hay que repartir. */
  porDia: number | null;
  estado: EstadoQueda;
};

export function calcularLoQueQueda(entrada: EntradaLoQueQueda): LoQueQueda {
  const sueldo = entrada.sueldo ?? 0;
  const pagado = {
    gastos: entrada.gastos,
    cuotas: entrada.cuotasPagadas,
    total: entrada.gastos + entrada.cuotasPagadas,
    detalle:
      entrada.gastosDelMes === undefined
        ? null
        : desglosarPagado(entrada.gastosDelMes, entrada.cuotasPagadas, entrada.presupuestos),
  };

  const lineas: LineaPorGastar[] =
    entrada.estado === "cerrado"
      ? []
      : entrada.presupuestos.lineas
          .map((l) => {
            const enCuentas = entrada.comprometidoPorCategoria[l.presupuesto.categoria.id] ?? 0;
            return {
              categoria: l.presupuesto.categoria,
              presupuesto: l.presupuesto.monto,
              gastado: l.gastado,
              enCuentas,
              porGastar: Math.max(0, l.presupuesto.monto - l.gastado - enCuentas),
            };
          })
          .filter((l) => l.porGastar > 0)
          .sort((a, b) => b.porGastar - a.porGastar || a.categoria.nombre.localeCompare(b.categoria.nombre, "es"));
  const porGastar = lineas.reduce((suma, l) => suma + l.porGastar, 0);

  const ahorro = {
    total: entrada.ahorros.reduce((suma, a) => suma + a.monto, 0),
    cantidad: entrada.ahorros.length,
  };

  const libre = sueldo - pagado.total - entrada.cuentasPorPagar.total - entrada.cuotasPorPagar.total;
  const descuentos = pagado.total + entrada.cuentasPorPagar.total + entrada.cuotasPorPagar.total + porGastar + ahorro.total;
  const quedaria = sueldo - descuentos;
  const puedesAhorrar = Math.max(0, quedaria);
  const porcentajeDelSueldo = sueldo === 0 ? null : (quedaria / sueldo) * 100;

  return {
    sinSueldo: entrada.sueldo === null,
    sueldo,
    pagado,
    cuentasPorPagar: entrada.cuentasPorPagar,
    cuotasPorPagar: entrada.cuotasPorPagar,
    presupuestoPorGastar: { total: porGastar, lineas },
    ahorro,
    descuentos,
    libre,
    quedaria,
    puedesAhorrar,
    meta: armarMeta(entrada.metaAhorro ?? null, ahorro.total, puedesAhorrar),
    porcentajeDelSueldo,
    porDia:
      entrada.estado !== "cerrado" && quedaria > 0 && entrada.diasRestantes > 0
        ? Math.floor(quedaria / entrada.diasRestantes)
        : null,
    estado:
      quedaria < 0
        ? "falta"
        : porcentajeDelSueldo === null || porcentajeDelSueldo < UMBRAL_AJUSTADO
          ? "ajustado"
          : "sobra",
  };
}

function armarMeta(monto: number | null, apartado: number, puedesAhorrar: number): MetaAhorro | null {
  if (monto === null || monto <= 0) return null;
  const porApartar = Math.max(0, monto - apartado);
  const alcanza = puedesAhorrar >= porApartar;
  return {
    monto,
    apartado,
    porApartar,
    alcanza,
    diferencia: alcanza ? puedesAhorrar - porApartar : porApartar - puedesAhorrar,
  };
}

/**
 * Abre lo pagado en sus tres partes. Las cuotas no estan entre los gastos
 * (el balance las lleva aparte) y entran con su total; los pagos de cuenta
 * se reconocen por su enlace, aunque su categoria tenga presupuesto, para
 * que la luz pagada no aparezca como gasto "dentro de presupuesto".
 */
export function desglosarPagado(
  gastos: readonly GastoPlano[],
  cuotasPagadas: number,
  presupuestos: Pick<ResumenPresupuestos, "lineas">,
): DesglosePagado {
  const conPresupuesto = new Set(presupuestos.lineas.map((l) => l.presupuesto.categoria.id));
  let cuentas = 0;
  let dentro = 0;
  const fuera: GastoPlano[] = [];

  for (const g of gastos) {
    if (esPagoDeCuota(g)) continue;
    if (g.cuenta != null) cuentas += g.monto;
    else if (conPresupuesto.has(g.categoria.id)) dentro += g.monto;
    else fuera.push(g);
  }

  const mayores = [...fuera]
    .sort((a, b) => b.monto - a.monto || b.fecha.localeCompare(a.fecha))
    .slice(0, MAYORES_FUERA)
    .map((g) => ({ id: g.id, descripcion: g.descripcion, monto: g.monto, categoria: g.categoria }));

  return {
    cuentasYCuotas: cuentas + cuotasPagadas,
    dentroDePresupuesto: dentro,
    fueraDePresupuesto: { total: fuera.reduce((s, g) => s + g.monto, 0), cantidad: fuera.length, mayores },
  };
}
