"use client";

import { useActionState, useRef, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { DialogoConfirmacion } from "./DialogoConfirmacion";
import { formatearCLP } from "./formato";

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
  /** Lo que el aviso de confirmacion necesita decir antes de tocar nada. */
  monto: number;
  categoria: string;
  /** Sin margen arriba, para ir en la misma linea que el nombre y el monto. */
  enLinea?: boolean;
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
  monto, categoria, enLinea = false,
}: Props) {
  const [estadoPagar, pagar, pagando] = useActionState(accionPagar, ESTADO_INICIAL);
  const [estadoRevertir, revertir, revirtiendo] = useActionState(
    accionRevertir,
    ESTADO_INICIAL,
  );

  // El aviso que se abre antes de tocar nada. null = ninguno abierto.
  const [confirmando, setConfirmando] = useState<"pagar" | "revertir" | null>(null);
  const formPagar = useRef<HTMLFormElement>(null);
  const formRevertir = useRef<HTMLFormElement>(null);
  // Se levanta solo para el envio que el propio dialogo dispara, para no
  // volver a interceptarlo y quedar en un bucle de avisos.
  const confirmado = useRef(false);

  function interceptar(cual: "pagar" | "revertir") {
    return (evento: React.FormEvent<HTMLFormElement>) => {
      if (confirmado.current) {
        confirmado.current = false;
        return;
      }
      evento.preventDefault();
      setConfirmando(cual);
    };
  }

  function continuar() {
    const form = confirmando === "pagar" ? formPagar : formRevertir;
    setConfirmando(null);
    confirmado.current = true;
    form.current?.requestSubmit();
  }

  const error =
    (estadoPagar.ok === false ? estadoPagar.mensaje : null) ??
    (estadoRevertir.ok === false ? estadoRevertir.mensaje : null);

  return (
    <div className={enLinea ? "inline-flex flex-col items-end" : "mt-1.5"}>
      <div className="inline-flex items-center gap-0.5 rounded-md border border-borde p-0.5">
        <form action={pagar} ref={formPagar} onSubmit={interceptar("pagar")} className="inline-flex">
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
          <form
            action={revertir}
            ref={formRevertir}
            onSubmit={interceptar("revertir")}
            className="inline-flex"
          >
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

      <DialogoConfirmacion
        abierto={confirmando !== null}
        titulo={confirmando === "revertir" ? "Deshacer el pago" : "Confirmar el pago"}
        tono={confirmando === "revertir" ? "peligro" : "normal"}
        alConfirmar={continuar}
        alCancelar={() => setConfirmando(null)}
      >
        {confirmando === "revertir" ? (
          <>
            <p>
              Vas a devolver {queEs} a pendiente.
            </p>
            <p>
              Esto borra el gasto de{" "}
              <span className="cifra tabular-nums text-texto">{formatearCLP(monto)}</span> en{" "}
              {categoria} que se había creado, y el monto vuelve a lo que te queda este mes.
            </p>
          </>
        ) : (
          <>
            <p>Vas a marcar {queEs} como pagada.</p>
            <p>
              Esto agrega un gasto de{" "}
              <span className="cifra tabular-nums text-texto">{formatearCLP(monto)}</span> en{" "}
              {categoria}, y se descuenta de lo que te queda este mes.
            </p>
          </>
        )}
      </DialogoConfirmacion>

      {error !== null && (
        <p role="status" className="mt-1 text-xs text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
