"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un trazo a mano sobre una palabra de un titular: el circulo alrededor de
 * «claro», en el cierre, o el subrayado de «preguntan», en las preguntas.
 *
 * Se dibuja una sola vez, cuando el titular entra en pantalla. Sin JavaScript
 * o con movimiento reducido el circulo ya esta completo: solo se esconde para
 * poder dibujarse si de verdad se va a dibujar.
 *
 * El viewBox (2,5 : 1) es la proporcion de la palabra, asi que estirarlo con
 * preserveAspectRatio="none" casi no deforma el trazo, y el grosor crece y se
 * achica con la letra del titular.
 */
export function TrazoCirculo({ forma = "circulo" }: { forma?: "circulo" | "subrayado" }) {
  const ref = useRef<SVGSVGElement>(null);
  const [fase, setFase] = useState<"quieto" | "espera" | "dibuja">("quieto");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setFase("dibuja");
      return;
    }
    setFase("espera");
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setFase("dibuja");
          observador.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    forma === "subrayado" ? (
      <svg ref={ref} data-fase={fase} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" className="trazo-subrayado">
        <path pathLength={1} d="M3 8 C 42 4, 96 3, 150 5 C 170 6, 186 7, 197 4" />
      </svg>
    ) : (
      <svg ref={ref} data-fase={fase} viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true" className="trazo-circulo">
        <path pathLength={1} d="M150 8 C 95 -2, 18 8, 8 38 C 0 66, 70 78, 128 72 C 182 66, 202 42, 186 22 C 176 10, 150 6, 122 9" />
      </svg>
    )
  );
}
