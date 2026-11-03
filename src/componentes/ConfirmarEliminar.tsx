"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Icono } from "./Icono";

type Props = {
  /** El id que recibe la accion de borrado. */
  id: string;
  accion: (datos: FormData) => void;
  /** Que se borra, como se nombra en la pregunta: «Café» por $4.200. */
  queEs: React.ReactNode;
  /** Para el lector de pantalla en el boton del tacho. */
  etiqueta: string;
  /** Una consecuencia que conviene saber antes, como que una cuota vuelve a pendiente. */
  aviso?: string | null;
  /** 32px en escritorio; 44px (el minimo tactil) en celular. */
  compacto?: boolean;
};

function BotonConfirmar() {
  // Mientras el servidor borra, el boton no se puede volver a apretar.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-peligro px-4 text-sm font-bold text-superficie transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icono nombre="trash" tamano={15} />
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}

/**
 * El tacho que antes borraba de un clic, ahora con una pregunta antes.
 *
 * Usa <dialog> nativo: el navegador atrapa el foco, cierra con Escape y deja
 * el fondo inerte. Al abrirse, el foco cae en "Cancelar", que va primero: si
 * se aprieta Enter sin pensar, no se borra nada. Clic fuera del cuadro
 * tambien cancela.
 *
 * Renderiza un <dialog>, que es un bloque: va dentro de un <td> o un <div>,
 * nunca de un <p> o un <span>.
 */
export function ConfirmarEliminar({ id, accion, queEs, etiqueta, aviso = null, compacto = false }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        title="Eliminar"
        className={`inline-flex cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-peligro ${
          compacto ? "size-8" : "size-11"
        }`}
      >
        <Icono nombre="trash" />
        <span className="sr-only">{etiqueta}</span>
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[min(27rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-left text-texto shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={accion} className="space-y-4 p-5">
          <input type="hidden" name="id" value={id} />

          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peligro/10 text-peligro">
              <Icono nombre="trash" tamano={18} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <h2 id={idTitulo} className="text-base font-bold leading-snug">
                ¿Eliminar {queEs}?
              </h2>
              <p className="text-sm leading-snug text-texto-tenue">
                Se eliminará por completo de tus movimientos y de los totales del mes. No se puede deshacer.
              </p>
              {aviso !== null && (
                <p className="flex gap-1.5 rounded-md border border-alerta/40 bg-alerta/10 p-2 text-xs leading-snug text-alerta">
                  <span className="mt-px shrink-0">
                    <Icono nombre="alert" tamano={13} />
                  </span>
                  {aviso}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors duration-150 hover:bg-superficie-tenue"
            >
              Cancelar
            </button>
            <BotonConfirmar />
          </div>
        </form>
      </dialog>
    </>
  );
}
