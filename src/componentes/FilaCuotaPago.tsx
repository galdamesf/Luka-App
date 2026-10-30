"use client";

import type { CuotaDelMes, DeudaPlana } from "@/dominio/balance";
import type { AccionFormulario } from "@/dominio/formulario";
import { ControlEstadoPago } from "./ControlEstadoPago";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP } from "./formato";
import { CATEGORIA_CUOTAS } from "@/dominio/categorias-base";

type Props = {
  deuda: DeudaPlana;
  cuota: CuotaDelMes;
  mes: string;
  hoy: string;
  alMarcarPagada: AccionFormulario;
  alRevertir: AccionFormulario;
};

/**
 * Una cuota de deuda dentro de la lista de pagos del mes.
 *
 * Version corta a proposito: aca solo se paga o se devuelve a pendiente.
 * Editar la deuda o darla por terminada vive en la seccion de Deudas, que es
 * donde esas acciones significan algo.
 */
export function FilaCuotaPago({
  deuda, cuota, mes, hoy, alMarcarPagada, alRevertir,
}: Props) {
  const pagada = cuota.pagada;

  return (
    <li className={`fila-viva border-b border-borde px-5 py-2 last:border-0 ${pagada ? "viva-exito" : "viva-avance"}`}>
      {/* Una sola linea: nombre, numero de cuota, el boton y el monto. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          {pagada && (
            <span className="shrink-0 text-exito">
              <Icono nombre="check" tamano={14} />
            </span>
          )}
          <span className={`truncate ${pagada ? "text-texto-tenue" : "font-medium"}`}>
            {deuda.nombre}
          </span>
          <span className="shrink-0 text-texto-tenue" title="Cuota de una deuda">
            <Icono nombre="credit-card" tamano={12} />
            <span className="sr-only">cuota de una deuda</span>
          </span>
        </p>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 text-xs text-texto-tenue">
          <span className="whitespace-nowrap">
            cuota <span className="cifra">{cuota.numero}</span> de{" "}
            <span className="cifra">{deuda.cuotasTotales}</span>
          </span>
          {pagada && cuota.pagadaEn !== null && (
            <span>pagada el {fechaCorta(cuota.pagadaEn)}</span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ControlEstadoPago
            enLinea
            pagado={pagada}
            accionPagar={alMarcarPagada}
            camposPagar={{ deudaId: deuda.id, mes, hoy, monto: String(deuda.montoCuota) }}
            accionRevertir={alRevertir}
            camposRevertir={{ deudaId: deuda.id, mes }}
            queEs={`la cuota de ${deuda.nombre}`}
            monto={cuota.montoPagado ?? deuda.montoCuota}
            categoria={CATEGORIA_CUOTAS}
          />
          <span
            className={`cifra min-w-[5.5rem] text-right text-sm tabular-nums ${
              pagada ? "text-texto-tenue" : "font-semibold"
            }`}
          >
            {formatearCLP(cuota.montoPagado ?? deuda.montoCuota)}
          </span>
          {/* Mismo ancho que los tres botones de una cuenta, para que los
              montos queden en columna. Las cuotas se editan en Deudas. */}
          <span aria-hidden="true" className="w-[6.5rem] shrink-0" />
        </div>
      </div>
    </li>
  );
}
