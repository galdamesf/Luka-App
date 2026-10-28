"use client";

import { useRef, useState } from "react";
import { Icono } from "./Icono";

type Props = {
  archivo: string | null;
  /** Para que el lector de pantalla sepa de que boleta se trata. */
  descripcion: string;
};

/** El tipo se deduce de la extension, que el servidor ya valido al guardar. */
function esPdf(archivo: string): boolean {
  return archivo.toLowerCase().endsWith(".pdf");
}

/**
 * Visor de la boleta en la misma pagina.
 *
 * Usa <dialog> nativo en vez de un div con position fixed: el navegador se
 * encarga del foco atrapado, de Escape para cerrar y del fondo inerte. Hacer
 * eso a mano son 60 lineas que casi siempre quedan a medias.
 *
 * Importante para quien lo use: <dialog> es contenido de flujo, asi que el
 * componente tiene que ir dentro de un <td>, <div> o similar. Puesto dentro
 * de un <p> o un <span> el navegador lo saca de ahi y React falla al
 * hidratar. Hay un validador que lo revisa.
 */
export function VisorBoleta({ archivo, descripcion }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);

  if (archivo === null) return null;

  const url = `/boletas/${archivo}`;
  const pdf = esPdf(archivo);

  function abrir() {
    setAbierto(true);
    dialogo.current?.showModal();
  }

  function cerrar() {
    dialogo.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex cursor-pointer items-center gap-1 rounded text-xs text-texto-tenue transition-colors duration-150 hover:text-foco focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
      >
        <Icono nombre="paperclip" tamano={13} />
        boleta
        <span className="sr-only">de {descripcion}, se abre un visor</span>
      </button>

      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        aria-label={`Boleta de ${descripcion}`}
        className="m-auto max-h-[90dvh] w-[min(92vw,56rem)] rounded-lg border border-borde bg-superficie p-0 text-texto backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold">{descripcion}</h2>

          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <Icono nombre="external-link" tamano={13} />
              Abrir aparte
            </a>

            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar el visor"
              className="inline-flex cursor-pointer items-center rounded p-1.5 text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <Icono nombre="x" tamano={16} />
            </button>
          </div>
        </div>

        {/* El contenido se monta solo cuando el dialogo esta abierto: asi no se
            descargan todas las boletas de la tabla al cargar la pagina. */}
        <div className="max-h-[calc(90dvh-3.25rem)] overflow-auto bg-superficie-tenue p-3">
          {!abierto ? null : pdf ? (
            <object
              data={url}
              type="application/pdf"
              className="h-[70dvh] w-full rounded"
              aria-label={`Boleta de ${descripcion} en PDF`}
            >
              <p className="p-4 text-sm text-texto-tenue">
                Tu navegador no puede mostrar el PDF aquí.{" "}
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                  Ábrelo en una pestaña nueva
                </a>
                .
              </p>
            </object>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- la boleta
               la sirve nuestra propia ruta y el optimizador de Next no aporta
               nada aqui: son fotos que se ven una vez. */
            <img
              src={url}
              alt={`Boleta de ${descripcion}`}
              className="mx-auto max-h-[70dvh] w-auto max-w-full rounded object-contain"
            />
          )}
        </div>
      </dialog>
    </>
  );
}
