"use client";

import { useEffect, useState } from "react";
import { Icono } from "./Icono";

/** Cuanto antes del final de la pagina aparece la flecha, en pixeles. */
const CERCA_DEL_FINAL = 320;

/**
 * La flecha para volver arriba. Aparece solo al llegar al final de una
 * pagina larga: mas arriba estorbaria, y en una pagina corta no hace falta.
 *
 * Ademas de subir, devuelve el foco al titulo de la pagina: si no, quien
 * navega con teclado sube la vista pero el siguiente Tab lo manda de nuevo
 * al final.
 */
export function VolverArriba() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let pendiente = false;
    const medir = () => {
      pendiente = false;
      const alto = document.documentElement.scrollHeight;
      const larga = alto > window.innerHeight * 1.5;
      const alFinal = window.scrollY + window.innerHeight >= alto - CERCA_DEL_FINAL;
      setVisible(larga && alFinal && window.scrollY > 0);
    };
    // Un calculo por cuadro, no uno por cada evento de scroll.
    const alMover = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
    };
  }, []);

  function subir() {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducido ? "auto" : "smooth" });
    const titulo = document.querySelector<HTMLElement>("h1");
    if (titulo) {
      if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    }
  }

  return (
    <button
      type="button"
      onClick={subir}
      aria-label="Volver arriba"
      title="Volver arriba"
      className={`no-imprimir fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex size-12 cursor-pointer items-center justify-center rounded-full bg-accion text-accion-texto shadow-lg shadow-black/25 transition-[opacity,transform,visibility,filter] duration-200 hover:brightness-110 sm:right-6 sm:bottom-6 ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"
      }`}
    >
      <Icono nombre="arrow-up" tamano={22} />
    </button>
  );
}
