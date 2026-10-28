"use client";

import { useActionState, useEffect, useRef } from "react";
import type { CategoriaPlana } from "@/dominio/resumen";
import { MEDIOS_PAGO, ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { CampoBoleta } from "./CampoBoleta";

type Props = {
  categorias: readonly CategoriaPlana[];
  /** Fecha que trae el campo por omision, en formato YYYY-MM-DD. */
  fechaInicial: string;
  accion: AccionFormulario;
};

const ETIQUETA = "mb-1 block text-xs font-medium text-texto-tenue";
const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

/** Error de un campo, anclado al input para que el lector de pantalla lo lea. */
function Error({ id, mensajes }: { id: string; mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return (
    <p id={id} className="mt-1 text-xs text-peligro">
      {mensajes[0]}
    </p>
  );
}

export function FormularioGasto({ categorias, fechaInicial, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Tras guardar, limpiar para poder anotar el siguiente gasto de inmediato.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  const err = estado.errores;

  return (
    <section
      aria-labelledby="titulo-formulario"
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <h2 id="titulo-formulario" className="text-sm font-semibold">
        Nuevo gasto
      </h2>

      <form ref={formulario} action={enviar} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fecha" className={ETIQUETA}>Fecha</label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              defaultValue={fechaInicial}
              required
              aria-describedby={err.fecha ? "error-fecha" : undefined}
              aria-invalid={err.fecha ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id="error-fecha" mensajes={err.fecha} />
          </div>

          <div>
            <label htmlFor="monto" className={ETIQUETA}>Monto</label>
            <input
              id="monto"
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="45.990"
              required
              aria-describedby={err.monto ? "error-monto" : undefined}
              aria-invalid={err.monto ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id="error-monto" mensajes={err.monto} />
          </div>
        </div>

        <div>
          <label htmlFor="descripcion" className={ETIQUETA}>Descripción</label>
          <input
            id="descripcion"
            name="descripcion"
            type="text"
            maxLength={120}
            placeholder="Supermercado, bencina, farmacia…"
            required
            aria-describedby={err.descripcion ? "error-descripcion" : undefined}
            aria-invalid={err.descripcion ? true : undefined}
            className={CAMPO}
          />
          <Error id="error-descripcion" mensajes={err.descripcion} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="categoriaId" className={ETIQUETA}>Categoría</label>
            <select
              id="categoriaId"
              name="categoriaId"
              required
              aria-describedby={err.categoriaId ? "error-categoriaId" : undefined}
              className={`${CAMPO} cursor-pointer`}
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            <Error id="error-categoriaId" mensajes={err.categoriaId} />
          </div>

          <div>
            <label htmlFor="medioPago" className={ETIQUETA}>Medio de pago</label>
            <select
              id="medioPago"
              name="medioPago"
              defaultValue="DEBITO"
              className={`${CAMPO} cursor-pointer`}
            >
              {MEDIOS_PAGO.map((medio) => (
                <option key={medio} value={medio}>
                  {ETIQUETA_MEDIO_PAGO[medio]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <CampoBoleta id="gasto-boleta" />

        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primario px-4 py-2.5 text-sm font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icono nombre="plus" />
          {pendiente ? "Guardando…" : "Agregar gasto"}
        </button>

        {/* role=status para que el lector de pantalla lo anuncie sin interrumpir. */}
        {estado.mensaje !== null && (
          <p
            role="status"
            className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}
          >
            {estado.mensaje}
          </p>
        )}
      </form>
    </section>
  );
}
