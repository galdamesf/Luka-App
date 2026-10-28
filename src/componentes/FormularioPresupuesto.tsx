"use client";

import { useActionState, useEffect, useRef } from "react";
import type { CategoriaPlana } from "@/dominio/resumen";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  mes: string;
  /** Categorias que todavia no tienen presupuesto este mes. */
  disponibles: readonly CategoriaPlana[];
  /** Las que gastaron y no tienen presupuesto: van primero en la lista. */
  sugeridas: readonly CategoriaPlana[];
  accion: AccionFormulario;
};

const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

export function FormularioPresupuesto({ mes, disponibles, sugeridas, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  if (disponibles.length === 0) {
    return (
      <p className="border-t border-borde px-4 py-3 text-xs text-texto-tenue">
        Todas las categorías ya tienen presupuesto este mes.
      </p>
    );
  }

  const idsSugeridas = new Set(sugeridas.map((c) => c.id));
  const resto = disponibles.filter((c) => !idsSugeridas.has(c.id));

  return (
    <details className="border-t border-borde px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-texto-tenue transition-colors duration-150 hover:text-texto">
        Agregar un presupuesto
        <span className="ml-1 opacity-60" aria-hidden="true">▾</span>
      </summary>

      <form ref={formulario} action={enviar} className="mt-3 space-y-3">
        <input type="hidden" name="mes" value={mes} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="nuevo-presupuesto-categoria"
              className="mb-1 block text-xs font-medium text-texto-tenue"
            >
              Categoría
            </label>
            <select id="nuevo-presupuesto-categoria" name="categoriaId" className={CAMPO}>
              {/* Las que ya gastaron van arriba: son las que de verdad
                  necesitan un techo. */}
              {sugeridas.length > 0 && (
                <optgroup label="Con gastos este mes">
                  {sugeridas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
              {resto.length > 0 && (
                <optgroup label={sugeridas.length > 0 ? "Las demás" : "Categorías"}>
                  {resto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {estado.errores.categoriaId !== undefined && (
              <p className="mt-1 text-xs text-peligro">{estado.errores.categoriaId[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="nuevo-presupuesto-monto"
              className="mb-1 block text-xs font-medium text-texto-tenue"
            >
              Cuánto quieres gastar como máximo
            </label>
            <input
              id="nuevo-presupuesto-monto"
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="100000"
              required
              className={`${CAMPO} cifra`}
            />
            {estado.errores.monto !== undefined && (
              <p className="mt-1 text-xs text-peligro">{estado.errores.monto[0]}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className="cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Agregar presupuesto"}
        </button>

        {estado.mensaje !== null && (
          <p
            role="status"
            className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}
          >
            {estado.mensaje}
          </p>
        )}
      </form>
    </details>
  );
}
