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
    <li className="border-b border-borde px-4 py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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

        <div className="flex basis-full flex-wrap items-center gap-x-3 text-xs text-texto-tenue sm:flex-1 sm:basis-auto">
          <span className="whitespace-nowrap">
            cuota <span className="cifra">{cuota.numero}</span> de{" "}
            <span className="cifra">{deuda.cuotasTotales}</span>
          </span>
          {pagada && cuota.pagadaEn !== null && (
            <span>pagada el {fechaCorta(cuota.pagadaEn)}</span>
          )}
        </div>

        <span
          className={`cifra ml-auto shrink-0 text-sm tabular-nums ${
            pagada ? "text-texto-tenue" : "font-medium"
          }`}
        >
          {formatearCLP(cuota.montoPagado ?? deuda.montoCuota)}
        </span>
      </div>

      <ControlEstadoPago
        pagado={pagada}
        accionPagar={alMarcarPagada}
        camposPagar={{ deudaId: deuda.id, mes, hoy, monto: String(deuda.montoCuota) }}
        accionRevertir={alRevertir}
        camposRevertir={{ deudaId: deuda.id, mes }}
        queEs={`la cuota de ${deuda.nombre}`}
        monto={cuota.montoPagado ?? deuda.montoCuota}
        categoria={CATEGORIA_CUOTAS}
      />
    </li>
  );
}
