"use client";

import { useState } from "react";
import type { CuotaDelMes, DeudaPlana } from "@/dominio/balance";
import type { AccionFormulario } from "@/dominio/formulario";
import { ControlEstadoPago } from "./ControlEstadoPago";
import { FormularioPagoCuota } from "./FormularioPagoCuota";
import { BoletaDeCuota } from "./BoletaDeCuota";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP } from "./formato";
import { CATEGORIA_CUOTAS } from "@/dominio/categorias-base";

type Props = {
  deuda: DeudaPlana;
  cuota: CuotaDelMes;
  mes: string;
  hoy: string;
  /** Pagar con otra fecha, otro monto o con la boleta. */
  accionPagar: AccionFormulario;
  alMarcarPagada: AccionFormulario;
  alRevertir: AccionFormulario;
  /** Adjunta la boleta a una cuota ya pagada. */
  accionBoleta?: AccionFormulario;
};

/**
 * Una cuota de deuda dentro de la lista de pagos del mes.
 *
 * Version corta a proposito: aca se paga (de un clic, o con otra fecha,
 * monto o boleta), se adjunta la boleta o se devuelve a pendiente. Editar la
 * deuda o darla por terminada vive en la seccion de Deudas, que es donde esas
 * acciones significan algo.
 */
export function FilaCuotaPago({
  deuda, cuota, mes, hoy, accionPagar, alMarcarPagada, alRevertir, accionBoleta,
}: Props) {
  const pagada = cuota.pagada;
  const [abiertoPago, setAbiertoPago] = useState(false);

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

        {/* flex-auto y no flex-1: con base 0 este bloque cedia todo su ancho
            y, con la cuota pagada (el control es mas ancho), "pagada el 2 nov"
            y la boleta quedaban apilados en una columna de pocos pixeles.
            Con base auto, si no cabe, son los botones los que bajan. */}
        <div className="flex flex-auto flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-tenue">
          <span className="whitespace-nowrap">
            cuota <span className="cifra">{cuota.numero}</span> de{" "}
            <span className="cifra">{deuda.cuotasTotales}</span>
          </span>
          {pagada && cuota.pagadaEn !== null && (
            <span>pagada el {fechaCorta(cuota.pagadaEn)}</span>
          )}
          <BoletaDeCuota cuota={cuota} accion={accionBoleta} />
        </div>

        <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
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
              montos queden en columna, y el calendario en la misma columna
              que el de las cuentas. Las cuotas se editan en Deudas. */}
          <div className="flex w-[6.5rem] shrink-0 items-center justify-start gap-1">
            {!pagada && (
              <button
                type="button"
                onClick={() => setAbiertoPago(!abiertoPago)}
                aria-expanded={abiertoPago}
                title="Pagar con boleta, otra fecha o monto"
                className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto ${
                  abiertoPago ? "bg-superficie-tenue text-texto" : "text-texto-tenue"
                }`}
              >
                <Icono nombre="calendar" tamano={14} />
                <span className="sr-only">
                  Pagar la cuota de {deuda.nombre} con boleta, otra fecha o monto
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!pagada && abiertoPago && (
        <FormularioPagoCuota
          deudaId={deuda.id}
          mes={mes}
          hoy={hoy}
          montoSugerido={deuda.montoCuota}
          accion={accionPagar}
          alCerrar={() => setAbiertoPago(false)}
        />
      )}
    </li>
  );
}
