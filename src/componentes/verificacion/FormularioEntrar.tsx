"use client";

import { useActionState, useId, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";

/**
 * El segundo paso al entrar: los 6 digitos de la app o, si no se tiene el
 * celular, un codigo de respaldo. Si sale bien, la accion lleva al panel.
 */
export function FormularioEntrar({ accion }: { accion: AccionFormulario }) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  const [respaldo, setRespaldo] = useState(false);
  const idCampo = useId();
  const idError = useId();

  return (
    <form action={enviar} className="space-y-4">
      <div>
        <label htmlFor={idCampo} className="mb-1.5 block text-sm font-semibold">
          {respaldo ? "Código de respaldo" : "Código de 6 dígitos"}
        </label>
        <input
          key={respaldo ? "respaldo" : "app"}
          id={idCampo}
          name="codigo"
          type="text"
          inputMode={respaldo ? "text" : "numeric"}
          autoComplete={respaldo ? "off" : "one-time-code"}
          autoCapitalize={respaldo ? "characters" : "off"}
          spellCheck={false}
          maxLength={respaldo ? 13 : 9}
          placeholder={respaldo ? "ABCDE-FGHJK" : "123 456"}
          required
          autoFocus
          aria-invalid={estado.mensaje !== null && !estado.ok}
          aria-describedby={estado.mensaje !== null ? idError : undefined}
          className="cifra w-full rounded-xl border border-borde bg-superficie px-3 py-3 text-center text-xl tracking-[0.25em] text-texto transition-colors placeholder:text-texto-tenue/50 hover:border-texto-tenue"
        />
      </div>

      {estado.mensaje !== null && !estado.ok && (
        <p id={idError} role="alert" className="rounded-xl border border-peligro/40 bg-peligro/10 px-3 py-2.5 text-sm text-pretty">
          {estado.mensaje}
        </p>
      )}

      <button type="submit" disabled={enviando} className="boton-luka w-full cursor-pointer">
        {enviando ? "Revisando…" : "Entrar"}
      </button>

      <button
        type="button"
        onClick={() => setRespaldo((r) => !r)}
        className="w-full cursor-pointer text-sm font-semibold text-texto-tenue underline-offset-4 hover:text-texto hover:underline"
      >
        {respaldo ? "Usar el código de la app" : "No tengo mi celular: usar un código de respaldo"}
      </button>
    </form>
  );
}
