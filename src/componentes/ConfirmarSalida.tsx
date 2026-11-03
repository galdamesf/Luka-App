"use client";

import { useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Icono } from "./Icono";

type Props = {
  /** Las clases del boton "Salir" del navbar, que cambian al encogerse. */
  className: string;
};

/**
 * El boton "Salir" del navbar, ahora con una pregunta antes: cerrar sesion
 * por un toque sin querer obliga a volver a pasar por Google.
 *
 * Usa <dialog> nativo, como los demas avisos de la app: foco atrapado, Esc
 * para cerrar y el fondo inerte. "Cancelar" va primero en el HTML para que
 * reciba el foco al abrir: un Enter de reflejo no saca a nadie.
 *
 * El <dialog> se abre en la capa superior del navegador, asi que no le
 * afecta estar adentro del navbar (que es sticky y tiene desenfoque).
 */
export function ConfirmarSalida({ className }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [saliendo, setSaliendo] = useState(false);

  const cerrar = () => {
    if (!saliendo) dialogo.current?.close();
  };

  async function salir() {
    setSaliendo(true);
    await signOut({ callbackUrl: "/bienvenida" });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        className={className}
      >
        Salir
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onCancel={(e) => {
          // Esc mientras se esta saliendo no deja el aviso a medias.
          if (saliendo) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-left text-texto shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento text-acento-tinta">
              <Icono nombre="log-out" tamano={18} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <h2 id={idTitulo} className="text-base font-bold leading-snug">
                ¿Quieres cerrar sesión?
              </h2>
              <p className="text-sm leading-snug text-texto-tenue">
                Vas a salir de Luka en este navegador. Tus gastos, cuentas y boletas quedan guardados; para
                volver a entrar necesitas tu cuenta de Google.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={saliendo}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors duration-150 hover:bg-superficie-tenue disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salir}
              disabled={saliendo}
              className="boton-luka cursor-pointer"
            >
              <Icono nombre="log-out" tamano={15} />
              {saliendo ? "Cerrando sesión…" : "Continuar y cerrar sesión"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
