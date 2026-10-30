"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import { FormularioGasto } from "./FormularioGasto";
import { Icono } from "./Icono";

type Props = {
  categorias: readonly CategoriaPlana[];
  fechaInicial: string;
  accion: AccionFormulario;
  presupuestos?: readonly { categoriaId: string; gastado: number; monto: number }[];
};

/**
 * El boton "Registrar gasto" de arriba de la pagina y el popup que abre. Es
 * el mismo formulario de la seccion 02 (con su boleta y su vista previa del
 * presupuesto), en un <dialog> nativo: Esc lo cierra, el foco queda adentro
 * y el lector de pantalla sabe que es un dialogo.
 *
 * Al guardar se cierra solo y aparece el aviso de "Gasto registrado".
 */
export function RegistrarGastoEmergente({ categorias, fechaInicial, accion, presupuestos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (d === null) return;
    if (abierto && !d.open) {
      d.showModal();
      // Directo al monto: es lo primero que uno escribe.
      document.getElementById("popup-monto")?.focus();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="no-imprimir inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-accion px-4 text-sm font-bold text-accion-texto shadow-sm shadow-accion/30 transition-[filter,box-shadow] duration-150 hover:shadow-md hover:shadow-accion/40 hover:brightness-110"
      >
        <Icono nombre="plus" tamano={18} />
        Registrar gasto
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="popup-titulo-formulario"
        onCancel={(e) => {
          // Esc: se cierra desde el estado para que quede en sincronia.
          e.preventDefault();
          setAbierto(false);
        }}
        onClick={(e) => {
          // Clic en el fondo oscuro: el target es el propio <dialog>.
          if (e.target === dialogo.current) setAbierto(false);
        }}
        className="m-auto max-h-[92vh] w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="absolute top-4 right-4 z-10 inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
          >
            <Icono nombre="x" tamano={18} />
            <span className="sr-only">Cerrar</span>
          </button>
          <FormularioGasto
            prefijo="popup-"
            enDialogo
            categorias={categorias}
            fechaInicial={fechaInicial}
            accion={accion}
            presupuestos={presupuestos}
            alGuardar={() => setAbierto(false)}
          />
        </div>
      </dialog>
    </>
  );
}
