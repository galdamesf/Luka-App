"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DE_TEXTO =
  "inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto";

function llave(miembroId: string) {
  return `luka:conecta-tu-correo:${miembroId}`;
}

/**
 * La invitacion a conectar el correo, para quien todavia no recibe sus
 * avisos en Luka. «Ahora no» la esconde en este navegador.
 */
export function ConectaTuCorreo({ miembroId }: { miembroId: string }) {
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
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie px-5 py-4 shadow-sm"
    >
      <div className="min-w-0 flex-[1_1_20rem] space-y-1">
        <h2 id="titulo-conecta-tu-correo" className="text-base font-bold tracking-tight">
          Que tus gastos lleguen solos
        </h2>
        <p className="max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
          Conecta tu correo una vez, en unos minutos, y los avisos de tus bancos aparecen aquí, en «Por revisar», sin
          escribir nada.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
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
        <Link href="/hogar#correos" className="boton-luka">
          Conectar mi correo
        </Link>
      </div>
    </section>
  );
}
