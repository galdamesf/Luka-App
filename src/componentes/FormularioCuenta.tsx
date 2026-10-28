"use client";

import { useActionState, useEffect, useRef } from "react";
import type { CategoriaPlana } from "@/dominio/resumen";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { CampoBoleta } from "./CampoBoleta";

type Props = {
  mes: string;
  categorias: readonly CategoriaPlana[];
  accion: AccionFormulario;
};

const ETIQUETA = "mb-1 block text-xs font-medium text-texto-tenue";
const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

function Error({ mensajes }: { mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return <p className="mt-1 text-xs text-peligro">{mensajes[0]}</p>;
}

export function FormularioCuenta({ mes, categorias, accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const err = estado.errores;

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <details className="border-t border-borde px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-texto-tenue transition-colors duration-150 hover:text-texto">
        Agregar una cuenta
        <span className="ml-1 opacity-60" aria-hidden="true">▾</span>
      </summary>

      <form ref={formulario} action={enviar} className="mt-3 space-y-3">
        <input type="hidden" name="mes" value={mes} />

        <div>
          <label htmlFor="cuenta-nombre" className={ETIQUETA}>Nombre</label>
          <input
            id="cuenta-nombre"
            name="nombre"
            type="text"
            maxLength={120}
            placeholder="Luz, agua, internet, gimnasio…"
            required
            aria-invalid={err.nombre ? true : undefined}
            className={CAMPO}
          />
          <Error mensajes={err.nombre} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cuenta-monto" className={ETIQUETA}>Monto</label>
            <input
              id="cuenta-monto"
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="38.400"
              required
              aria-invalid={err.monto ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error mensajes={err.monto} />
          </div>

          <div>
            <label htmlFor="cuenta-vence" className={ETIQUETA}>
              Día de vencimiento
            </label>
            <input
              id="cuenta-vence"
              name="diaVencimiento"
              type="text"
              inputMode="numeric"
              placeholder="20"
              aria-invalid={err.diaVencimiento ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error mensajes={err.diaVencimiento} />
          </div>
        </div>

        <div>
          <label htmlFor="cuenta-categoria" className={ETIQUETA}>Categoría</label>
          <select
            id="cuenta-categoria"
            name="categoriaId"
            required
            className={`${CAMPO} cursor-pointer`}
          >
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
            ))}
          </select>
          <Error mensajes={err.categoriaId} />
        </div>

        <CampoBoleta id="cuenta-boleta" />

        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input
            name="mensual"
            type="checkbox"
            className="mt-0.5 size-4 cursor-pointer rounded border-borde"
          />
          <span>
            <span className="font-medium">Se repite todos los meses</span>
            <span className="mt-0.5 block text-texto-tenue">
              Al abrir el mes siguiente aparece sola pendiente, con este monto de
              referencia.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={pendiente}
          className="w-full cursor-pointer rounded-md bg-primario px-4 py-2 text-sm font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Agregar cuenta"}
        </button>

        {estado.mensaje !== null && (
          <p role="status" className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}>
            {estado.mensaje}
          </p>
        )}
      </form>
    </details>
  );
}
