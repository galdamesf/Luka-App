"use client";

import { useEffect, useState } from "react";

type Props = {
  texto: string;
  /** Lo que dice el boton. Por omision, «Copiar». */
  etiqueta?: string;
  /** Para lectores de pantalla: que se copia. */
  descripcion?: string;
};

/**
 * Copia un texto (la direccion de Luka, los remitentes, el codigo de Gmail)
 * y lo dice un par de segundos. Si el navegador no deja copiar, el texto
 * sigue a la vista para copiarlo a mano.
 */
export function BotonCopiar({ texto, etiqueta = "Copiar", descripcion }: Props) {
  const [copiado, setCopiado] = useState<boolean | null>(null);

  useEffect(() => {
    if (copiado === null) return;
    const reloj = setTimeout(() => setCopiado(null), 2_500);
    return () => clearTimeout(reloj);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={descripcion ? `${etiqueta}: ${descripcion}` : undefined}
      className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-lg border border-borde bg-superficie px-3 text-[13px] font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue"
    >
      <span aria-live="polite">{copiado === true ? "Copiado" : copiado === false ? "Cópialo a mano" : etiqueta}</span>
    </button>
  );
}
