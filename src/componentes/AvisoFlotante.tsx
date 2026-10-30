"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "./Icono";

type Props = {
  titulo: string;
  /** null = no hay aviso a la vista. */
  mensaje: string | null;
  alCerrar: () => void;
  /** Cuanto se queda antes de irse solo, en milisegundos. */
  duracion?: number;
};

/**
 * El aviso que aparece abajo a la derecha despues de guardar: "Gasto
 * registrado". Se va solo a los pocos segundos y tambien se puede cerrar.
 *
 * Va por portal al <body> para que no lo recorte ninguna tarjeta ni se cierre
 * junto con el popup desde el que se registro. El contenedor con aria-live
 * existe desde que se monta: si apareciera junto con el texto, el lector de
 * pantalla no lo anunciaria.
 */
export function AvisoFlotante({ titulo, mensaje, alCerrar, duracion = 4500 }: Props) {
  const [montado, setMontado] = useState(false);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (mensaje === null) return;
    const temporizador = setTimeout(() => cerrar.current(), duracion);
    return () => clearTimeout(temporizador);
  }, [mensaje, duracion]);

  if (!montado) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="no-imprimir pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {mensaje !== null && (
        <div className="aviso-entra pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-exito/50 bg-superficie p-4 text-texto shadow-2xl shadow-black/30">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-exito-fuerte text-white">
            <Icono nombre="check" tamano={18} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold">{titulo}</p>
            <p className="text-[13px] text-texto-tenue">{mensaje}</p>
          </div>
          <button
            type="button"
            onClick={() => cerrar.current()}
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
          >
            <Icono nombre="x" tamano={16} />
            <span className="sr-only">Cerrar el aviso</span>
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
