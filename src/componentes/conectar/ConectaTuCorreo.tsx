"use client";

import { useEffect, useState } from "react";
import { TuDireccionDeLuka } from "./TuDireccionDeLuka";

const DE_TEXTO =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto";

function llave(miembroId: string) {
  return `luka:conecta-tu-correo:${miembroId}`;
}

/**
 * Para quien todavia no le manda nada a Luka: que reenvie los avisos de su
 * banco a su direccion de Luka, con la direccion a mano para copiarla o
 * guardarla como contacto. «Ahora no» la esconde en este navegador.
 */
export function ConectaTuCorreo({ miembroId, direccion }: { miembroId: string; direccion: string }) {
  // Se decide despues de cargar: el servidor no sabe si la escondio.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(llave(miembroId)) !== "no");
    } catch {
      setVisible(true);
    }
  }, [miembroId]);

  if (!visible) return null;
  return (
    <section
      aria-labelledby="titulo-conecta-tu-correo"
      className="space-y-3 rounded-2xl border border-borde bg-superficie px-5 py-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="titulo-conecta-tu-correo" className="text-base font-bold tracking-tight">
            Reenvíale a Luka los avisos de tu banco
          </h2>
          <p className="max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
            Cuando te llegue un aviso de compra o transferencia, reenvíalo tal cual a tu dirección de Luka. Aparece aquí,
            en «Por revisar».
          </p>
        </div>
        <button
          type="button"
          className={DE_TEXTO}
          onClick={() => {
            try {
              localStorage.setItem(llave(miembroId), "no");
            } catch {
              // Se esconde igual, hasta recargar.
            }
            setVisible(false);
          }}
        >
          Ahora no
        </button>
      </div>
      <TuDireccionDeLuka direccion={direccion} />
    </section>
  );
}
