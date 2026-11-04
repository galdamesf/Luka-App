"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El circulo a mano alrededor de «claro», en el titular del cierre.
 *
 * Se dibuja una sola vez, cuando el titular entra en pantalla. Sin JavaScript
 * o con movimiento reducido el circulo ya esta completo: solo se esconde para
 * poder dibujarse si de verdad se va a dibujar.
 *
 * El viewBox (2,5 : 1) es la proporcion de la palabra, asi que estirarlo con
 * preserveAspectRatio="none" casi no deforma el trazo, y el grosor crece y se
 * achica con la letra del titular.
 */
export function TrazoCirculo() {
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
    <svg ref={ref} data-fase={fase} viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true" className="trazo-circulo">
      <path pathLength={1} d="M150 8 C 95 -2, 18 8, 8 38 C 0 66, 70 78, 128 72 C 182 66, 202 42, 186 22 C 176 10, 150 6, 122 9" />
    </svg>
  );
}
