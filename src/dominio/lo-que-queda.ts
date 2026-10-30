import type { CategoriaPlana } from "./resumen";
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
};

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
  pagado: { gastos: number; cuotas: number; total: number };
  cuentasPorPagar: { total: number; cantidad: number };
  cuotasPorPagar: { total: number; cantidad: number };
  /** Solo las categorias a las que todavia les queda, de mayor a menor. */
  presupuestoPorGastar: { total: number; lineas: LineaPorGastar[] };
  ahorro: { total: number; cantidad: number };
  /** Todo lo que se resta del sueldo. */
  descuentos: number;
  /** sueldo - descuentos. Negativo si no alcanza. */
  quedaria: number;
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

  const descuentos = pagado.total + entrada.cuentasPorPagar.total + entrada.cuotasPorPagar.total + porGastar + ahorro.total;
  const quedaria = sueldo - descuentos;
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
    quedaria,
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
