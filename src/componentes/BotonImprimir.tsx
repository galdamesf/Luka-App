"use client";

import { Icono } from "./Icono";

/** Abre el dialogo de impresion del navegador, que tambien permite guardar PDF. */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-imprimir inline-flex cursor-pointer items-center gap-2 rounded-md border border-borde px-3 py-2 text-sm text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
    >
      <Icono nombre="paperclip" tamano={15} />
      Imprimir o guardar PDF
    </button>
  );
}
