"use client";

import { useEffect, useRef } from "react";

type Props = {
  abierto: boolean;
  titulo: string;
  /** El texto del aviso. Va adentro del <dialog>, no en un atributo. */
  children: React.ReactNode;
  etiquetaConfirmar?: string;
  /** "peligro" pinta el boton de confirmar en rojo: algo se va a borrar. */
  tono?: "normal" | "peligro";
  alConfirmar: () => void;
  alCancelar: () => void;
};

/**
 * Un aviso de "¿seguro?" con Cancelar y Continuar.
 *
 * Usa el <dialog> del navegador en vez de un div con position:fixed. No es
 * por ahorrar CSS: el elemento nativo trae el foco atrapado adentro, Esc para
 * cerrar, el fondo inerte y el rol de dialogo ya puestos. Hecho a mano, esas
 * cuatro cosas se olvidan y el aviso queda navegable solo con mouse.
 *
 * Cancelar va primero en el HTML a proposito: es lo que recibe el foco al
 * abrir, asi que un Enter de reflejo no confirma nada.
 */
export function DialogoConfirmacion({
  abierto, titulo, children, etiquetaConfirmar = "Continuar",
  tono = "normal", alConfirmar, alCancelar,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo === null) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="titulo-dialogo"
      onCancel={(e) => {
        // Esc. Se maneja aca para que el estado de afuera quede en sincronia.
        e.preventDefault();
        alCancelar();
      }}
      onClick={(e) => {
        // Clic en el fondo: el target es el propio <dialog>, no su contenido.
        if (e.target === ref.current) alCancelar();
      }}
      className="m-auto max-h-[90vh] w-[min(24rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-borde bg-superficie p-0 text-texto backdrop:bg-black/50"
    >
      <div className="p-4">
        <h2 id="titulo-dialogo" className="text-sm font-semibold">
          {titulo}
        </h2>

        <div className="mt-2 space-y-2 text-sm text-texto-tenue">{children}</div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={alCancelar}
            className="cursor-pointer rounded-md border border-borde px-3 py-2 text-xs font-medium text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={alConfirmar}
            className={`cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 ${
              tono === "peligro" ? "bg-peligro" : "bg-primario"
            }`}
          >
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
}
