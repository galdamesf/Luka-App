"use client";

import { useEffect, useState } from "react";

/**
 * true cuando la pagina paso del umbral. Lo usa el navbar para encogerse.
 *
 * El scroll dispara muchisimas veces por segundo: se agrupa en un
 * requestAnimationFrame para no llamar a setState en cada evento. Y se
 * evalua una vez al montar, porque se puede llegar a la pagina ya abajo
 * (un ancla en la URL, o el navegador restaurando la posicion).
 */
export function usarDesplazamiento(umbral: number): boolean {
  const [pasado, setPasado] = useState(false);

  useEffect(() => {
    let cuadro = 0;
    const revisar = () => {
      cuadro = 0;
      setPasado(window.scrollY > umbral);
    };
    const alDesplazar = () => {
      if (cuadro === 0) cuadro = requestAnimationFrame(revisar);
    };

    revisar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("scroll", alDesplazar);
    };
  }, [umbral]);

  return pasado;
}
