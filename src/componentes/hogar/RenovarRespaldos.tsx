"use client";

import { useActionState, useId, useRef } from "react";
import { ESTADO_CON_CODIGOS, type EstadoConCodigos } from "@/dominio/dos-pasos";
import { CodigosDeRespaldo } from "@/componentes/verificacion/CodigosDeRespaldo";

type Props = {
  accion: (estado: EstadoConCodigos, datos: FormData) => Promise<EstadoConCodigos>;
  correo: string;
};

const CANCELAR =
  "inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue";

/**
 * Pedir codigos de respaldo nuevos, en un <dialog>: primero pregunta (los
 * anteriores dejan de servir) y, si sale bien, muestra los nuevos ahi mismo,
 * esta sola vez.
 */
export function RenovarRespaldos({ accion, correo }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_CON_CODIGOS);
  const listos = estado.ok && estado.codigos !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
      >
        Generar códigos nuevos
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <h2 id={idTitulo} className="text-base font-bold tracking-tight">
            {listos ? "Tus códigos nuevos" : "¿Generar códigos de respaldo nuevos?"}
          </h2>
          {listos ? (
            <>
              <p role="status" className="text-sm leading-relaxed text-texto-tenue">
                {estado.mensaje}
              </p>
              <CodigosDeRespaldo codigos={estado.codigos!} correo={correo} />
              <div className="flex justify-end">
                <button type="button" onClick={() => dialogo.current?.close()} className="boton-luka cursor-pointer">
                  Ya los guardé
                </button>
              </div>
            </>
          ) : (
            <form action={enviar} className="space-y-4">
              <p className="text-sm leading-relaxed text-texto-tenue">
                Te damos 10 códigos nuevos y los que tienes ahora dejan de servir. Hazlo si se te acabaron o si alguien pudo
                verlos.
              </p>
              {estado.mensaje !== null && !estado.ok && (
                <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm">
                  {estado.mensaje}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => dialogo.current?.close()} className={CANCELAR}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando} className="boton-luka cursor-pointer">
                  {enviando ? "Generando…" : "Sí, generar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
