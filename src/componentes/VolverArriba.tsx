"use client";

import { useEffect, useState } from "react";
import { Icono } from "./Icono";

/** Desde que parte de la pantalla bajada aparece la flecha: media pantalla. */
const APARECE_DESDE = 0.5;

/** El anillo de progreso: radio y largo de su contorno, en el lienzo de 56x56. */
const RADIO = 26;
const CONTORNO = 2 * Math.PI * RADIO;

/**
 * La flecha para volver arriba. Aparece apenas se baja media pantalla en
 * una pagina larga y se queda mientras se sigue bajando; el anillo de
 * alrededor se va llenando con lo que llevas recorrido de la pagina. En una
 * pagina corta no aparece: no hay a donde volver.
 *
 * Ademas de subir, devuelve el foco al titulo de la pagina: si no, quien
 * navega con teclado sube la vista pero el siguiente Tab lo manda de nuevo
 * al final.
 */
export function VolverArriba() {
  const [visible, setVisible] = useState(false);
  // 0 a 100, en enteros: no hace falta redibujar por cada pixel.
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    let pendiente = false;
    const medir = () => {
      pendiente = false;
      const alto = document.documentElement.scrollHeight;
      const recorrible = alto - window.innerHeight;
      const larga = alto > window.innerHeight * 1.5;
      setVisible(larga && window.scrollY > window.innerHeight * APARECE_DESDE);
      setAvance(recorrible <= 0 ? 0 : Math.min(100, Math.round((window.scrollY / recorrible) * 100)));
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
      title={`Volver arriba · llevas el ${avance}% de la página`}
      className={`group no-imprimir fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex size-14 cursor-pointer items-center justify-center rounded-full bg-superficie text-acento-tinta shadow-lg shadow-black/25 transition-[opacity,transform,visibility,filter] duration-200 hover:brightness-110 sm:right-6 sm:bottom-6 ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"
      }`}
    >
      {/* El anillo: la pista tenue completa y encima lo recorrido. Empieza
          arriba (rotado -90°) y avanza en el sentido del reloj. */}
      <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90">
        <circle cx="28" cy="28" r={RADIO} fill="none" strokeWidth="3" className="stroke-borde" />
        <circle
          cx="28"
          cy="28"
          r={RADIO}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CONTORNO}
          strokeDashoffset={CONTORNO * (1 - avance / 100)}
          className="stroke-acento-canto transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <span className="relative inline-flex size-10 items-center justify-center rounded-full bg-acento text-acento-tinta shadow-[0_3px_0_var(--acento-canto)] transition-[transform,box-shadow] duration-75 group-active:translate-y-0.5 group-active:shadow-[0_1px_0_var(--acento-canto)]">
        <Icono nombre="arrow-up" tamano={20} />
      </span>
    </button>
  );
}
