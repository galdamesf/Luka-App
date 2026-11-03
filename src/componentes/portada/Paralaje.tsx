"use client";

import { useEffect } from "react";

/**
 * El parallax de la portada: cada capa marcada con `data-paralaje` se mueve a
 * su propia velocidad al hacer scroll.
 *
 *   data-paralaje="0.2"        velocidad: cuantos px se corre por cada px que
 *                              su centro esta lejos del centro de la pantalla
 *   data-paralaje-min="0"      tope hacia arriba (px, negativo sube)
 *   data-paralaje-max="80"     tope hacia abajo
 *
 * Como funciona, y por que asi:
 *
 * - Cada capa descansa (corrimiento 0) cuando su centro pasa por el centro de
 *   la pantalla. Lo que ya parte arriba de ese centro (el heroe) descansa
 *   donde esta al cargar: asi nada salta al abrir la pagina.
 * - La velocidad es positiva: lo que viene abajo llega un poco mas abajo y
 *   sube mas rapido que el scroll. Con todas positivas, dos secciones vecinas
 *   se separan en vez de juntarse, y los topes (nunca mas que el aire entre
 *   secciones) impiden que una capa le pise el texto a otra. Lo vigila
 *   herramientas/revisar_app.py recorriendo la pagina a varios anchos.
 * - Las posiciones de reposo se miden con todo en 0 y se vuelven a medir
 *   cuando algo cambia de tamano (una pregunta que se abre, la ventana).
 * - Solo se toca una variable CSS que alimenta `transform` (globals.css):
 *   nada de layout, y las capas que ya usan `translate` o `rotate` (el hover
 *   de las tarjetas, el giro de los stickers) siguen funcionando.
 * - En celular el recorrido se achica, y con movimiento reducido no hay
 *   parallax.
 */
export function Paralaje() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const capas = [...document.querySelectorAll<HTMLElement>("[data-paralaje]")].map((el) => ({
      el,
      velocidad: Number(el.dataset.paralaje) || 0,
      min: el.dataset.paralajeMin === undefined ? -80 : Number(el.dataset.paralajeMin),
      max: el.dataset.paralajeMax === undefined ? 80 : Number(el.dataset.paralajeMax),
      centro: 0,
    }));
    if (capas.length === 0) return;

    let cuadro = 0;

    function medir() {
      for (const c of capas) c.el.style.setProperty("--paralaje", "0px");
      // Una sola lectura de layout para todas, con los corrimientos en 0.
      for (const c of capas) {
        const r = c.el.getBoundingClientRect();
        c.centro = r.top + window.scrollY + r.height / 2;
      }
    }

    function pintar() {
      cuadro = 0;
      const mitad = window.innerHeight / 2;
      const escala = window.innerWidth < 768 ? 0.6 : 1;
      for (const c of capas) {
        const distancia = c.centro - window.scrollY - Math.min(mitad, c.centro);
        const y = Math.min(c.max, Math.max(c.min, distancia * c.velocidad * escala));
        c.el.style.setProperty("--paralaje", `${y.toFixed(1)}px`);
      }
    }

    const pedir = () => {
      if (cuadro === 0) cuadro = requestAnimationFrame(pintar);
    };
    const remedir = () => {
      medir();
      pintar();
    };

    remedir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", remedir);
    // Una pregunta que se abre o una fuente que termina de cargar mueve todo
    // lo que esta abajo: hay que volver a medir donde descansa cada capa.
    const observador = new ResizeObserver(() => remedir());
    observador.observe(document.body);

    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", remedir);
      observador.disconnect();
      for (const c of capas) c.el.style.removeProperty("--paralaje");
    };
  }, []);

  return null;
}
