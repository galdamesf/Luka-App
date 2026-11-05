"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  /** El texto del boton que abre la pregunta. */
  etiqueta: string;
  /** Lo que se le pregunta a la persona, en el titulo del cuadro. */
  pregunta: string;
  /** Lo que conviene saber antes de confirmar. */
  children: React.ReactNode;
  /** El texto del boton que confirma. */
  confirmar: string;
  accion: AccionFormulario;
  /** El id que recibe la accion, si es sobre un miembro. */
  id?: string;
  /** "peligro" pinta el boton de confirmar en rojo: alguien se va del hogar. */
  tono?: "normal" | "peligro";
  /** Clases del boton que abre: discreto en una fila, o mas visible. */
  claseBoton?: string;
  /**
   * Pide un codigo de la app o uno de respaldo antes de confirmar: para
   * desactivar la verificacion en dos pasos o pasar la app a otro celular.
   */
  conCodigo?: boolean;
};

const BOTON_FILA =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-3 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto";

/**
 * Un boton que antes de hacer algo serio (sacar a alguien, pasar el hogar,
 * salir) pregunta en un <dialog> nativo: foco atrapado, Esc para cerrar y
 * Cancelar primero, para que un Enter de reflejo no confirme nada.
 *
 * Si la accion falla, el motivo se muestra dentro del cuadro; si sale bien,
 * el cuadro se cierra y la pagina ya viene actualizada.
 */
export function ConfirmarAccion({
  etiqueta, pregunta, children, confirmar, accion, id, tono = "normal", claseBoton = BOTON_FILA, conCodigo = false,
}: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idCodigo = useId();
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) dialogo.current?.close();
  }, [estado]);

  return (
    <>
      <button type="button" onClick={() => dialogo.current?.showModal()} aria-haspopup="dialog" className={claseBoton}>
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-xl backdrop:bg-black/50"
      >
        <form action={enviar} className="space-y-4 p-5">
          <h2 id={idTitulo} className="text-base font-bold tracking-tight">
            {pregunta}
          </h2>
          <div className="space-y-2 text-sm leading-relaxed text-texto-tenue">{children}</div>
          {id !== undefined && <input type="hidden" name="id" value={id} />}
          {conCodigo && (
            <div>
              <label htmlFor={idCodigo} className="mb-1.5 block text-sm font-semibold">
                Código de la app, o uno de respaldo
              </label>
              <input
                id={idCodigo}
                name="codigo"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={13}
                placeholder="123 456"
                required
                className="cifra w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-center text-lg tracking-[0.2em] text-texto transition-colors placeholder:text-texto-tenue/50 hover:border-texto-tenue"
              />
            </div>
          )}
          {estado.mensaje !== null && !estado.ok && (
            <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm">
              {estado.mensaje}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className={
                tono === "peligro"
                  ? "inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-peligro px-4 text-sm font-bold text-superficie transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  : "boton-luka cursor-pointer"
              }
            >
              {pendiente ? "Un momento…" : confirmar}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
