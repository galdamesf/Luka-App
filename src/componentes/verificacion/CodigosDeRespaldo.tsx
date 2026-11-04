"use client";

import { useState } from "react";

type Props = {
  codigos: readonly string[];
  /** Para el nombre del archivo y el encabezado: de que cuenta son. */
  correo?: string;
};

/**
 * Los codigos de respaldo, recien creados: se ven una sola vez. Se pueden
 * copiar o bajar como texto para guardarlos lejos del celular (en un gestor
 * de contrasenas, impresos, en otro computador).
 */
export function CodigosDeRespaldo({ codigos, correo }: Props) {
  const [copiado, setCopiado] = useState(false);
  const texto = [
    `Códigos de respaldo de Luka${correo ? ` (${correo})` : ""}`,
    "Cada uno sirve una vez, si no tienes tu celular.",
    "",
    ...codigos,
  ].join("\n");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function bajar() {
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([`${texto}\n`], { type: "text/plain;charset=utf-8" }));
    enlace.download = "codigos-de-respaldo-luka.txt";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <div className="space-y-3">
      <ol className="grid grid-cols-2 gap-2 rounded-xl border border-borde bg-superficie-tenue p-3" aria-label="Códigos de respaldo">
        {codigos.map((c) => (
          <li key={c} className="cifra rounded-md bg-superficie px-2 py-1.5 text-center text-sm font-semibold tracking-wider">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-borde px-3 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
        >
          {copiado ? "Copiados ✓" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={bajar}
          className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-borde px-3 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
        >
          Bajar como texto
        </button>
      </div>
      <p className="text-xs leading-relaxed text-pretty text-texto-tenue">
        Guárdalos lejos del celular: en tu gestor de contraseñas, impresos o en otro computador. Luka no los vuelve a
        mostrar.
      </p>
    </div>
  );
}
