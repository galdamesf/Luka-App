"use client";

import { useActionState, useEffect, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "../Icono";

type Props = {
  nombre: string;
  /** Solo el dueno le cambia el nombre. */
  puedeCambiar: boolean;
  accion: AccionFormulario;
};

/** El nombre del hogar como titulo de la pagina, y el lapiz para cambiarlo. */
export function NombreDelHogar({ nombre, puedeCambiar, accion }: Props) {
  const [editando, setEditando] = useState(false);
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) setEditando(false);
  }, [estado]);

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{nombre}</h1>
        {puedeCambiar && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors hover:bg-superficie-tenue hover:text-texto"
          >
            <Icono nombre="pencil" tamano={15} />
            Cambiar nombre
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <label htmlFor="nombre-hogar" className="mb-1 block text-xs font-medium text-texto-tenue">
          Nombre del hogar
        </label>
        <input
          id="nombre-hogar"
          name="nombre"
          defaultValue={nombre}
          maxLength={60}
          required
          autoFocus
          className="w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-lg font-semibold text-texto transition-colors hover:border-texto-tenue"
        />
      </div>
      <button type="submit" disabled={pendiente} className="boton-luka cursor-pointer">
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
      >
        Cancelar
      </button>
      {estado.mensaje !== null && !estado.ok && (
        <p role="alert" className="basis-full text-sm text-peligro">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
