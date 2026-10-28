import type { GastoPlano } from "@/dominio/resumen";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP } from "./formato";

type Props = {
  /** Los gastos del mes que son pago de una cuota. */
  cuotas: readonly GastoPlano[];
  total: number;
};

/**
 * Las cuotas de deuda pagadas este mes, en su propia seccion.
 *
 * Van aparte de los demas gastos a proposito: el balance ya descuenta las
 * cuotas por su lado, asi que sumarlas tambien con los gastos restaria la
 * misma plata dos veces. Aqui se ven, pero no entran en los totales de
 * "Gastos del mes" ni en el desglose por categoria.
 */
export function CuotasPagadas({ cuotas, total }: Props) {
  if (cuotas.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-cuotas-pagadas"
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-cuotas-pagadas" className="flex items-center gap-1.5 text-sm font-semibold">
          <Icono nombre="credit-card" tamano={14} />
          Cuotas pagadas este mes
        </h2>
        <p className="text-xs text-texto-tenue">
          <span className="cifra font-medium text-texto">{formatearCLP(total)}</span>
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {cuotas.map((gasto) => (
          <li
            key={gasto.id}
            className="flex items-baseline justify-between gap-3 border-b border-borde pb-2 text-sm last:border-0 last:pb-0"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="cifra shrink-0 text-xs text-texto-tenue">
                {fechaCorta(gasto.fecha)}
              </span>
              <span className="truncate">{gasto.descripcion}</span>
            </span>
            <span className="cifra shrink-0 font-medium tabular-nums">
              {formatearCLP(gasto.monto)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-texto-tenue">
        Estas cuotas no se suman con los demás gastos: el balance ya las
        descuenta del sueldo por su lado.
      </p>
    </section>
  );
}
