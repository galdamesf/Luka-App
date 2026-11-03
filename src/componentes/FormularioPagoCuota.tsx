"use client";

import { useActionState, useId } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { CampoBoleta } from "./CampoBoleta";

type Props = {
  deudaId: string;
  /** El mes de la cuota, "YYYY-MM". */
  mes: string;
  /** Dia de hoy, para proponerlo como fecha de pago. */
  hoy: string;
  /** La cuota pactada, que se propone como monto. */
  montoSugerido: number;
  accion: AccionFormulario;
  alCerrar: () => void;
};

const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-2 py-1.5 text-xs text-texto transition-colors duration-150 hover:border-texto-tenue";
const ETIQUETA = "mb-1 block text-xs text-texto-tenue";

function Error({ mensajes }: { mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return <p className="mt-1 text-xs text-peligro">{mensajes[0]}</p>;
}

/**
 * Pagar una cuota con otra fecha, otro monto o con la foto de la boleta.
 *
 * Es el mismo formulario en Pagos del mes y en Deudas. La misma deuda puede
 * tener los dos abiertos a la vez, asi que los id salen de useId y no del id
 * de la deuda: con el de la deuda, las etiquetas apuntarian al campo de la
 * otra seccion.
 */
export function FormularioPagoCuota({
  deudaId, mes, hoy, montoSugerido, accion, alCerrar,
}: Props) {
  const [estado, pagar, pagando] = useActionState(accion, ESTADO_INICIAL);
  const id = useId();

  return (
    <form action={pagar} className="mt-2 max-w-md space-y-2 rounded-md bg-superficie-tenue p-3">
      <input type="hidden" name="deudaId" value={deudaId} />
      <input type="hidden" name="mes" value={mes} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${id}-fecha`} className={ETIQUETA}>
            ¿Qué día la pagaste?
          </label>
          <input
            id={`${id}-fecha`}
            name="fechaPago"
            type="date"
            defaultValue={hoy}
            required
            className={`${CAMPO} cifra`}
          />
          <Error mensajes={estado.errores.fechaPago} />
        </div>
        <div>
          <label htmlFor={`${id}-monto`} className={ETIQUETA}>
            Monto real
          </label>
          <input
            id={`${id}-monto`}
            name="monto"
            type="text"
            inputMode="numeric"
            defaultValue={String(montoSugerido)}
            required
            className={`${CAMPO} cifra`}
          />
          <Error mensajes={estado.errores.monto} />
        </div>
      </div>

      <CampoBoleta id={`${id}-boleta`} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={alCerrar}
          className="shrink-0 cursor-pointer rounded-md border border-borde px-3 py-2 text-xs font-medium text-texto-tenue transition-colors duration-150 hover:bg-superficie hover:text-texto"
        >
          Cerrar
        </button>
        <button
          type="submit"
          disabled={pagando}
          className="flex-1 cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pagando ? "Guardando…" : "Confirmar pago"}
        </button>
      </div>

      <p className="text-xs text-texto-tenue">
        Se va a crear el gasto y recién ahí baja tu disponible.
      </p>

      {estado.mensaje !== null && !estado.ok && (
        <p role="status" className="text-xs text-peligro">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
