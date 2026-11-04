"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  nombreDelHogar: string;
  /** El correo del dueno, al que llega el codigo. */
  correo: string;
  accionPedirCodigo: AccionFormulario;
  accionBorrar: AccionFormulario;
};

const CANCELAR =
  "inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue";

const PELIGRO =
  "inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-peligro px-4 text-sm font-bold text-superficie transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Borrar el hogar, en dos pasos dentro de un <dialog> nativo:
 *
 *  1. «Enviar código»: Luka manda un codigo de 6 digitos al correo del
 *     dueno. Quien tenga la sesion abierta pero no ese correo no pasa de aqui.
 *  2. Se escribe el codigo y «Sí, borrar todo». Si no es, se dice cuantos
 *     intentos quedan; si se acabaron o vencio, se pide otro.
 *
 * Si sale bien, la accion cierra la sesion y lleva a la pantalla de ingreso.
 */
export function BorrarHogar({ nombreDelHogar, correo, accionPedirCodigo, accionBorrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idCodigo = useId();
  const [pedido, pedir, pidiendo] = useActionState(accionPedirCodigo, ESTADO_INICIAL);
  const [borrado, borrar, borrando] = useActionState(accionBorrar, ESTADO_INICIAL);
  // Una vez enviado un codigo, el cuadro queda en el paso 2 con el aviso de a
  // donde llego, aunque pedir otro falle (por ejemplo, antes del minuto).
  const [enviado, setEnviado] = useState<string | null>(null);
  // Solo se muestra el error de lo ultimo que se hizo: pedir otro codigo o
  // probar uno.
  const [ultimo, setUltimo] = useState<"pedir" | "borrar" | null>(null);

  useEffect(() => {
    if (pedido === ESTADO_INICIAL) return;
    setUltimo("pedir");
    if (pedido.ok) setEnviado(pedido.mensaje);
  }, [pedido]);

  useEffect(() => {
    if (borrado !== ESTADO_INICIAL) setUltimo("borrar");
  }, [borrado]);

  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-peligro/50 px-4 text-sm font-semibold text-peligro transition-colors hover:bg-peligro/10"
      >
        Borrar el hogar
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <h2 id={idTitulo} className="text-base font-bold tracking-tight">
            ¿Borrar «{nombreDelHogar}»?
          </h2>
          <p className="text-sm leading-relaxed text-texto-tenue">
            Se borran todos los gastos, cuentas, deudas, presupuestos, ahorros y boletas del hogar, y las invitaciones
            pendientes. <strong className="font-semibold text-texto">No se puede deshacer.</strong> Después tu sesión se
            cierra.
          </p>

          {enviado === null ? (
            <form action={pedir} className="space-y-4">
              <p className="text-sm leading-relaxed text-texto-tenue">
                Para confirmar que eres tú, te mandamos un código a{" "}
                <span className="font-semibold break-all text-texto">{correo}</span>.
              </p>
              {pedido.mensaje !== null && !pedido.ok && (
                <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm">
                  {pedido.mensaje}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={cerrar} className={CANCELAR}>
                  Cancelar
                </button>
                <button type="submit" disabled={pidiendo} className="boton-luka cursor-pointer">
                  {pidiendo ? "Enviando…" : "Enviar código"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <form action={borrar} className="space-y-4">
                <p role="status" className="text-sm leading-relaxed text-texto-tenue">
                  {enviado}
                </p>
                {ultimo === "pedir" && !pedido.ok && pedido.mensaje !== null && (
                  <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm">
                    {pedido.mensaje}
                  </p>
                )}
                <div>
                  <label htmlFor={idCodigo} className="mb-1 block text-xs font-medium text-texto-tenue">
                    Código del correo
                  </label>
                  <input
                    id={idCodigo}
                    name="codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={9}
                    placeholder="123456"
                    required
                    autoFocus
                    className="cifra w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-lg tracking-[0.3em] text-texto transition-colors hover:border-texto-tenue"
                  />
                </div>
                {ultimo === "borrar" && borrado.mensaje !== null && !borrado.ok && (
                  <p role="alert" className="rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm">
                    {borrado.mensaje}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={cerrar} className={CANCELAR}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={borrando} className={PELIGRO}>
                    {borrando ? "Un momento…" : "Sí, borrar todo"}
                  </button>
                </div>
              </form>
              <form action={pedir} className="border-t border-borde pt-3">
                <button
                  type="submit"
                  disabled={pidiendo}
                  className="cursor-pointer text-sm font-semibold text-texto-tenue underline-offset-4 hover:text-texto hover:underline disabled:cursor-not-allowed"
                >
                  {pidiendo ? "Enviando…" : "¿No te llegó? Enviar otro código"}
                </button>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
