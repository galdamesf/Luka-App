"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { formatearCLP } from "./formato";
import { nombreDelMes } from "./formato";

type Props = {
  mes: string;
  /** Sueldo que rige hoy en ese mes, para mostrarlo de referencia. */
  sueldoActual: number | null;
  accion: AccionFormulario;
};

const ETIQUETA = "mb-1 block text-xs font-medium text-texto-tenue";
const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

export function FormularioSueldo({ mes, sueldoActual, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const err = estado.errores;

  return (
    <details className="mt-4 border-t border-borde pt-3" open={sueldoActual === null}>
      <summary className="cursor-pointer list-none text-xs font-medium text-texto-tenue transition-colors duration-150 hover:text-texto">
        {sueldoActual === null ? "Definir mi sueldo" : "Cambiar el sueldo"}
        <span className="ml-1 opacity-60" aria-hidden="true">▾</span>
      </summary>

      <form action={enviar} className="mt-3 space-y-3">
        <p className="text-xs text-texto-tenue">
          El monto rige desde el mes que elijas en adelante, hasta que lo cambies.
          Los meses anteriores conservan el sueldo que tenían.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sueldo-mes" className={ETIQUETA}>Rige desde</label>
            <input
              id="sueldo-mes"
              name="mes"
              type="month"
              defaultValue={mes}
              required
              aria-describedby={err.mes ? "error-sueldo-mes" : undefined}
              className={`${CAMPO} cifra`}
            />
            {err.mes && (
              <p id="error-sueldo-mes" className="mt-1 text-xs text-peligro">{err.mes[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="sueldo-monto" className={ETIQUETA}>Monto mensual</label>
            <input
              id="sueldo-monto"
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="1.200.000"
              defaultValue={sueldoActual === null ? "" : String(sueldoActual)}
              required
              aria-describedby={err.monto ? "error-sueldo-monto" : undefined}
              aria-invalid={err.monto ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            {err.monto && (
              <p id="error-sueldo-monto" className="mt-1 text-xs text-peligro">{err.monto[0]}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className="w-full cursor-pointer rounded-md bg-primario px-4 py-2 text-sm font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar sueldo"}
        </button>

        {estado.mensaje !== null && (
          <p role="status" className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}>
            {estado.mensaje}
          </p>
        )}
      </form>

      {sueldoActual !== null && (
        <p className="mt-2 text-xs text-texto-tenue">
          Hoy rige <span className="cifra">{formatearCLP(sueldoActual)}</span> para{" "}
          <span className="capitalize">{nombreDelMes(mes)}</span>.
        </p>
      )}
    </details>
  );
}
