"use client";

import { useEffect, useState } from "react";
import { Icono } from "./Icono";

type Tema = "claro" | "oscuro";

/** Script que corre antes de pintar, para que no haya parpadeo de tema. */
export const GUION_TEMA = `
(function () {
  try {
    var guardado = localStorage.getItem("tema");
    if (guardado === "claro" || guardado === "oscuro") {
      document.documentElement.dataset.theme = guardado === "oscuro" ? "dark" : "light";
    }
  } catch (e) {
    /* Modo incognito o almacenamiento bloqueado: manda la preferencia del sistema. */
  }
})();
`.trim();

function temaDelSistema(): Tema {
  if (typeof window === "undefined") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

export function InterruptorTema() {
  // Arranca en null para no suponer nada antes de montar: en el servidor no
  // sabemos que tema tiene la persona y adivinar provoca parpadeo.
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem("tema");
    } catch {
      // Almacenamiento bloqueado: seguimos con la preferencia del sistema.
    }
    setTema(guardado === "claro" || guardado === "oscuro" ? guardado : temaDelSistema());
  }, []);

  function cambiar() {
    const nuevo: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    document.documentElement.dataset.theme = nuevo === "oscuro" ? "dark" : "light";
    try {
      localStorage.setItem("tema", nuevo);
    } catch {
      // Sin persistencia, pero el cambio igual aplica en esta pestana.
    }
  }

  const esOscuro = tema === "oscuro";

  return (
    <button
      type="button"
      onClick={cambiar}
      // suppressHydrationWarning: el icono depende de localStorage, que el
      // servidor no puede conocer.
      suppressHydrationWarning
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-borde text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto sm:size-9"
    >
      <Icono nombre={esOscuro ? "sun" : "moon"} tamano={18} />
      <span className="sr-only">
        {esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      </span>
    </button>
  );
}
