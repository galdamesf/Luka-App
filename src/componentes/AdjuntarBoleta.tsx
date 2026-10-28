"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { CampoBoleta } from "./CampoBoleta";

type Props = {
  gastoId: string;
  descripcion: string;
  accion: AccionFormulario;
};

/** Adjunta la foto de la boleta a un gasto que ya esta registrado. */
export function AdjuntarBoleta({ gastoId, descripcion, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);

  return (
    <details className="inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs text-texto-tenue transition-colors duration-150 hover:text-foco">
        <Icono nombre="camera" tamano={13} />
        adjuntar
        <span className="sr-only">boleta de {descripcion}</span>
      </summary>

      <form action={enviar} className="mt-2 w-56 space-y-2 rounded-md bg-superficie-tenue p-2">
        <input type="hidden" name="id" value={gastoId} />
        <CampoBoleta id={`boleta-gasto-${gastoId}`} etiqueta="Elige la foto" />
        <button
          type="submit"
          disabled={pendiente}
          className="w-full cursor-pointer rounded-md bg-primario px-2 py-1.5 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Subiendo…" : "Guardar boleta"}
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
