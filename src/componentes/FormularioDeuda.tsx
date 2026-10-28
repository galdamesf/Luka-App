"use client";

import { useActionState, useEffect, useRef } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  /** Mes por omision para la primera cuota. */
  mes: string;
  accion: AccionFormulario;
};

const ETIQUETA = "mb-1 block text-xs font-medium text-texto-tenue";
const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

function Error({ id, mensajes }: { id: string; mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return <p id={id} className="mt-1 text-xs text-peligro">{mensajes[0]}</p>;
}

export function FormularioDeuda({ mes, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const err = estado.errores;

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <details className="mt-4 border-t border-borde pt-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-texto-tenue transition-colors duration-150 hover:text-texto">
        Agregar una deuda
        <span className="ml-1 opacity-60" aria-hidden="true">▾</span>
      </summary>

      <form ref={formulario} action={enviar} className="mt-3 space-y-3">
        <div>
          <label htmlFor="deuda-nombre" className={ETIQUETA}>Nombre</label>
          <input
            id="deuda-nombre"
            name="nombre"
            type="text"
            maxLength={80}
            placeholder="Crédito de consumo, notebook en cuotas…"
            required
            aria-invalid={err.nombre ? true : undefined}
            className={CAMPO}
          />
          <Error id="error-deuda-nombre" mensajes={err.nombre} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deuda-cuota" className={ETIQUETA}>Monto por cuota</label>
            <input
              id="deuda-cuota"
              name="montoCuota"
              type="text"
              inputMode="numeric"
              placeholder="85.000"
              required
              aria-invalid={err.montoCuota ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id="error-deuda-cuota" mensajes={err.montoCuota} />
          </div>

          <div>
            <label htmlFor="deuda-cuotas" className={ETIQUETA}>Total de cuotas</label>
            <input
              id="deuda-cuotas"
              name="cuotasTotales"
              type="text"
              inputMode="numeric"
              placeholder="12"
              required
              aria-invalid={err.cuotasTotales ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id="error-deuda-cuotas" mensajes={err.cuotasTotales} />
          </div>
        </div>

        <div>
          <label htmlFor="deuda-primera" className={ETIQUETA}>Mes de la primera cuota</label>
          <input
            id="deuda-primera"
            name="primeraCuota"
            type="month"
            defaultValue={mes}
            required
            aria-invalid={err.primeraCuota ? true : undefined}
            className={`${CAMPO} cifra`}
          />
          <Error id="error-deuda-primera" mensajes={err.primeraCuota} />
          <p className="mt-1 text-xs text-texto-tenue">
            Si ya llevas cuotas pagadas, pon el mes en que pagaste la primera: la app
            calcula sola en cuál vas.
          </p>
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className="w-full cursor-pointer rounded-md bg-primario px-4 py-2 text-sm font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Agregar deuda"}
        </button>

        {estado.mensaje !== null && (
          <p role="status" className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}>
            {estado.mensaje}
          </p>
        )}
      </form>
    </details>
  );
}
