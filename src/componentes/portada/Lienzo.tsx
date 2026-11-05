"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icono } from "@/componentes/Icono";
import { CabeceraDeSeccion } from "./CabeceraDeSeccion";
import { TrazoCirculo } from "./TrazoCirculo";

/**
 * El lienzo de paneles de «¿Qué hacemos?»: paneles altos en fila que se
 * recorren de lado, como el de la tienda Vitalia (plan-constancia.tsx).
 *
 * - Se desliza con el dedo o el trackpad, y cada panel encaja en su lugar.
 * - Las flechas de arriba avanzan de a un panel; en cada punta, la de ese
 *   lado se apaga.
 * - Con el foco en el lienzo, las flechas del teclado avanzan de a un panel
 *   e Inicio y Fin van al primero y al ultimo (WCAG 2.1.1).
 * - Cada panel dibuja su garabato la primera vez que se ve. Sin JavaScript o
 *   con movimiento reducido no hay nada escondido: todo aparece dibujado.
 */

export type Dibujo = {
  viewBox: string;
  /** Cada trazo se dibuja despues del anterior. */
  caminos: readonly string[];
};

export type Panel = {
  titulo: string;
  texto: string;
  dibujo: Dibujo;
  /** El panel que va relleno de durazno. */
  destacado?: boolean;
};

const PALABRAS = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

/** «seis», para el titulo. */
export function enPalabras(n: number): string {
  return PALABRAS[n] ?? String(n);
}

const reducido = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Lienzo({ idTitulo, idLienzo, paneles }: { idTitulo: string; idLienzo: string; paneles: readonly Panel[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });
  const [vistos, setVistos] = useState<number[]>([]);
  // Solo se esconden los dibujos si de verdad se van a dibujar.
  const [animar, setAnimar] = useState(false);

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const inicio = el.scrollLeft <= 4;
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setBordes((antes) => (antes.inicio === inicio && antes.fin === fin ? antes : { inicio, fin }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cuadro = 0;
    const alMover = () => {
      if (!cuadro)
        cuadro = requestAnimationFrame(() => {
          cuadro = 0;
          medir();
        });
    };
    medir();
    el.addEventListener("scroll", alMover, { passive: true });
    const tamano = new ResizeObserver(medir);
    tamano.observe(el);
    return () => {
      cancelAnimationFrame(cuadro);
      el.removeEventListener("scroll", alMover);
      tamano.disconnect();
    };
  }, [medir]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || reducido()) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-panel]"));
    setAnimar(true);
    const observador = new IntersectionObserver(
      (entradas) => {
        const nuevos: number[] = [];
        for (const entrada of entradas) {
          if (entrada.intersectionRatio >= 0.55) {
            nuevos.push(Number((entrada.target as HTMLElement).dataset.panel));
            observador.unobserve(entrada.target);
          }
        }
        if (nuevos.length) setVistos((antes) => [...antes, ...nuevos.filter((n) => !antes.includes(n))]);
      },
      { threshold: [0, 0.55, 0.8, 1] },
    );
    for (const item of items) observador.observe(item);
    return () => observador.disconnect();
  }, []);

  const mover = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const panel = el.querySelector("li");
    const paso = panel ? panel.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * paso, behavior: reducido() ? "auto" : "smooth" });
  };

  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const behavior: ScrollBehavior = reducido() ? "auto" : "smooth";
    if (evento.key === "ArrowRight") mover(1);
    else if (evento.key === "ArrowLeft") mover(-1);
    else if (evento.key === "Home") el.scrollTo({ left: 0, behavior });
    else if (evento.key === "End") el.scrollTo({ left: el.scrollWidth, behavior });
    else return;
    evento.preventDefault();
  };

  return (
    <>
      {/* La cabecera de las secciones de la portada, centrada: el titular con
          su palabra en durazno, subrayada a mano, y debajo las flechas. */}
      <CabeceraDeSeccion
        id={idTitulo}
        debajo={
          <div className="flex items-center justify-center gap-2">
            <span className="font-mano mr-2 hidden text-[1.45rem] leading-none font-bold text-anotacion @3xl:inline">
              desliza, o usa las flechas
            </span>
            {(
              [
                { dir: -1, etiqueta: "Panel anterior", icono: "arrow-left", apagado: bordes.inicio },
                { dir: 1, etiqueta: "Panel siguiente", icono: "arrow-right", apagado: bordes.fin },
              ] as const
            ).map(({ dir, etiqueta, icono, apagado }) => (
              <button
                key={etiqueta}
                type="button"
                aria-label={etiqueta}
                aria-controls={idLienzo}
                aria-disabled={apagado}
                onClick={() => !apagado && mover(dir)}
                className="grid size-11 cursor-pointer place-items-center rounded-full border-2 border-borde bg-superficie text-texto transition-colors hover:border-acento-canto hover:text-anotacion aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-borde aria-disabled:hover:text-texto"
              >
                <Icono nombre={icono} tamano={18} />
              </button>
            ))}
          </div>
        }
      >
        Lo que hace Luka, en{" "}
        <span className="palabra-subrayada text-anotacion">
          {enPalabras(paneles.length)} paneles
          <TrazoCirculo forma="subrayado" />
        </span>
      </CabeceraDeSeccion>

      <div
        ref={ref}
        id={idLienzo}
        role="group"
        aria-label={`Los ${enPalabras(paneles.length)} paneles. Se recorren de lado.`}
        tabIndex={0}
        onKeyDown={alTeclear}
        data-animar={animar || undefined}
        data-paralaje="0.08"
        data-paralaje-min="-50"
        data-paralaje-max="50"
        className="lienzo mt-9 snap-x snap-mandatory overflow-x-auto pt-1 pb-6"
      >
        <ul className="flex w-max gap-5">
          {paneles.map((panel, i) => (
            <li
              key={panel.titulo}
              data-panel={i}
              data-visto={vistos.includes(i) || undefined}
              className={`panel-luka relative flex min-h-[360px] w-[80vw] max-w-[330px] shrink-0 snap-start flex-col rounded-3xl border-2 p-7 shadow-[0_3px_0_var(--acento-canto)] transition-transform duration-200 hover:-translate-y-0.5 @3xl:min-h-[400px] @3xl:w-[340px] @3xl:max-w-none ${
                panel.destacado ? "border-acento-canto bg-acento text-acento-tinta" : "border-borde bg-superficie"
              }`}
            >
              <span
                aria-hidden="true"
                className={`font-mano absolute top-3 right-6 text-[2rem] leading-none font-bold ${
                  panel.destacado ? "" : "text-anotacion"
                }`}
              >
                {i + 1}
              </span>
              <h3
                className={`pr-8 text-[1.55rem] leading-[1.05] font-black tracking-[-0.02em] ${
                  panel.destacado ? "" : "text-titulo"
                }`}
              >
                {panel.titulo}
              </h3>
              <p className={`mt-4 leading-relaxed text-pretty ${panel.destacado ? "" : "text-texto-tenue"}`}>
                {panel.texto}
              </p>
              {/* Los dibujos van con el lapiz durazno; en el panel durazno, en tinta. */}
              <div className={`mt-auto pt-6 ${panel.destacado ? "" : "text-anotacion"}`}>
                <svg aria-hidden="true" focusable="false" viewBox={panel.dibujo.viewBox} className="dibujo h-[96px] w-auto overflow-visible">
                  {panel.dibujo.caminos.map((d, j) => (
                    <path key={d} d={d} pathLength={1} style={{ "--i": j } as CSSProperties} />
                  ))}
                </svg>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
