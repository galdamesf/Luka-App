"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";

type Props = {
  pagado: boolean;
  /** Marca pagado de un clic, con la fecha de hoy y el monto esperado. */
  accionPagar: AccionFormulario;
  camposPagar: Record<string, string>;
  /** Devuelve a pendiente y borra el gasto. */
  accionRevertir: AccionFormulario;
  camposRevertir: Record<string, string>;
  /** Para el lector de pantalla: "la cuenta de Luz", "la cuota de Scotiabank". */
  queEs: string;
};

const BASE =
  "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150";

function Ocultos({ campos }: { campos: Record<string, string> }) {
  return (
    <>
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
    </>
  );
}

/**
 * Pagado / Pendiente: el estado de un pago, de un clic.
 *
 * Pendiente: un solo boton, "Pagado", que marca pagado con la fecha de hoy y
 * el monto esperado.
 * Pagado: "Pagado" relleno como indicador, mas "Pendiente" para deshacerlo y
 * borrar el gasto.
 *
 * El boton de "Pendiente" NO aparece en algo que ya esta pendiente: ahi no
 * tiene nada que hacer y solo confunde.
 *
 * Las dos acciones devuelven estado, no void, y el mensaje de error se
 * muestra aqui abajo. Antes, si la accion fallaba o rechazaba la validacion,
 * hacia un `return` mudo: desde afuera se veia como "el boton no funciona",
 * que es la peor forma de fallar.
 */
export function ControlEstadoPago({
  pagado, accionPagar, camposPagar, accionRevertir, camposRevertir, queEs,
}: Props) {
  const [estadoPagar, pagar, pagando] = useActionState(accionPagar, ESTADO_INICIAL);
  const [estadoRevertir, revertir, revirtiendo] = useActionState(
    accionRevertir,
    ESTADO_INICIAL,
  );

  const error =
    (estadoPagar.ok === false ? estadoPagar.mensaje : null) ??
    (estadoRevertir.ok === false ? estadoRevertir.mensaje : null);

  return (
    <div className="mt-1.5">
      <div className="inline-flex items-center gap-0.5 rounded-md border border-borde p-0.5">
        <form action={pagar} className="inline-flex">
          <Ocultos campos={camposPagar} />
          <button
            type="submit"
            disabled={pagado || pagando}
            aria-pressed={pagado}
            className={`${BASE} ${
              pagado
                ? "cursor-default bg-exito text-primario-texto"
                : "cursor-pointer text-exito hover:bg-exito hover:text-primario-texto disabled:opacity-60"
            }`}
          >
            <Icono nombre="check" tamano={12} />
            {pagando ? "Guardando…" : "Pagado"}
            {!pagado && <span className="sr-only">: marcar {queEs} como pagada</span>}
          </button>
        </form>

        {/* "Pendiente" solo donde sirve: en algo ya pagado, para devolverlo.
            En la columna de pendientes no tiene nada que hacer. */}
        {pagado && (
          <form action={revertir} className="inline-flex">
            <Ocultos campos={camposRevertir} />
            <button
              type="submit"
              disabled={revirtiendo}
              className={`${BASE} cursor-pointer text-alerta hover:bg-alerta hover:text-primario-texto disabled:opacity-60`}
            >
              <Icono nombre="undo" tamano={12} />
              {revirtiendo ? "Guardando…" : "Pendiente"}
              <span className="sr-only">: deshace el pago de {queEs} y borra su gasto</span>
            </button>
          </form>
        )}
      </div>

      {error !== null && (
        <p role="status" className="mt-1 text-xs text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
