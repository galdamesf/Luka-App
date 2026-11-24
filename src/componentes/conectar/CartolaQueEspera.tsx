"use client";

import { useActionState, useId } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  /** La cartola que espera, o null si ninguna. */
  espera: {
    banco: string;
    /** Cual es la clave, como lo dice el correo del banco. */
    pista: string;
    /** Por que no se pudo abrir: falta la clave, o la guardada no la abre. */
    detalle: string | null;
  } | null;
  accion: AccionFormulario;
};

const CAMPO =
  "min-h-11 rounded-lg border border-borde bg-superficie px-3 text-base text-texto transition-colors duration-150 hover:border-texto-tenue sm:text-sm";

/**
 * La cartola del mes que llego y espera la clave de su PDF: se pide aqui, en
 * Inicio, con un solo campo, y se lee al tiro. Se dibuja siempre (vacio si no
 * espera ninguna): asi, cuando la lee y el panel se refresca sin ella, queda
 * a la vista lo que paso.
 */
export function CartolaQueEspera({ espera, accion }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const ids = { titulo: useId(), clave: useId(), ayuda: useId() };

  if (estado.ok) {
    return (
      <p role="status" className="rounded-2xl border border-borde bg-superficie px-5 py-4 text-sm font-semibold text-exito-fuerte shadow-sm">
        {estado.mensaje}
      </p>
    );
  }
  if (espera === null) return null;
  const { banco, pista, detalle } = espera;
  const noLaAbre = detalle?.startsWith("La clave guardada") ?? false;

  return (
    <section aria-labelledby={ids.titulo} className="rounded-2xl border border-acento-canto/60 bg-durazno px-5 py-4 text-durazno-texto shadow-sm">
      <h2 id={ids.titulo} className="text-base font-bold tracking-tight">
        Llegó tu cartola de {banco}
      </h2>
      <p className="mt-1 max-w-[60ch] text-sm leading-relaxed">
        {noLaAbre ? "La clave que guardaste no abre su PDF. " : "Su PDF viene con clave. "}
        Escríbela y Luka la lee al tiro: cuadra el mes y trae lo que no tuvo aviso, como las compras con tarjeta.
      </p>
      <form action={enviar} className="mt-3 space-y-2">
        <input type="hidden" name="banco" value={banco} />
        <label htmlFor={ids.clave} className="block text-sm font-semibold">
          La clave del PDF
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={ids.clave}
            name="clave"
            type="password"
            autoComplete="off"
            required
            maxLength={64}
            aria-describedby={ids.ayuda}
            aria-invalid={estado.errores.clave ? true : undefined}
            className={`${CAMPO} min-w-0 flex-[1_1_12rem]`}
          />
          <button type="submit" disabled={enviando} className="boton-luka cursor-pointer">
            {enviando ? "Leyendo…" : "Leer la cartola"}
          </button>
        </div>
        <p id={ids.ayuda} className="text-xs leading-relaxed">
          Es {pista}, como dice el correo de {banco}. Luka la guarda cifrada para las próximas y nunca la muestra.
        </p>
        {estado.mensaje !== null && !estado.ok && (
          <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm text-texto">
            {estado.mensaje}
          </p>
        )}
      </form>
    </section>
  );
}
