"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

type Props = {
  activo: boolean;
  /** Si Luka puede mandar correos: sin eso, el resumen no sale. */
  puedeMandar: boolean;
  correo: string;
  accion: AccionFormulario;
};

const DE_TEXTO =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto disabled:cursor-not-allowed disabled:opacity-60";

/** El resumen diario por correo: prenderlo o apagarlo. */
export function ResumenDiario({ activo, puedeMandar, correo, accion }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-1 rounded-xl border border-borde px-4 py-3 text-sm">
      <input type="hidden" name="activo" value={activo ? "no" : "si"} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-[1_1_18rem]">
          <span className="font-semibold">Resumen diario por correo: </span>
          <span className={activo ? "font-semibold text-exito-fuerte" : "text-texto-tenue"}>{activo ? "activado" : "apagado"}</span>
        </p>
        <button type="submit" disabled={enviando} className={DE_TEXTO}>
          {enviando ? "Un momento…" : activo ? "Apagar" : "Activar"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-texto-tenue">
        Cada mañana a {correo}: lo que se anotó ayer, lo que espera en «Por revisar» y las cuentas por vencer. Si no hay
        nada que contar, no llega.
        {!puedeMandar && " Todavía no sale: falta configurar el correo de Luka."}
      </p>
      {estado.mensaje !== null && (
        <p role={estado.ok ? "status" : "alert"} className={estado.ok ? "text-xs font-semibold text-exito-fuerte" : "text-xs font-semibold text-peligro"}>
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
