"use client";

import { useActionState, useEffect, useRef } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "../Icono";

/**
 * Invitar a alguien con su correo de Google. No se manda ningun correo: la
 * persona entra a Luka con esa cuenta y queda en el hogar.
 */
export function InvitarMiembro({ accion }: { accion: AccionFormulario }) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Al invitar, el campo queda vacio para la siguiente.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={enviar} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="correo-invitado" className="mb-1 block text-xs font-medium text-texto-tenue">
            Correo de Google de la persona
          </label>
          <input
            id="correo-invitado"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@gmail.com"
            required
            className="w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-sm text-texto transition-colors hover:border-texto-tenue"
          />
        </div>
        <button type="submit" disabled={pendiente} className="boton-luka cursor-pointer">
          <Icono nombre="plus" tamano={16} />
          {pendiente ? "Invitando…" : "Invitar"}
        </button>
      </div>
      {estado.mensaje !== null && (
        <p role="status" className={`text-sm ${estado.ok ? "text-exito" : "text-peligro"}`}>
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
