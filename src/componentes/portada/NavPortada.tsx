"use client";

import Link from "next/link";
import { InterruptorTema } from "@/componentes/InterruptorTema";
import { Luka } from "@/componentes/Luka";
import { usarDesplazamiento } from "@/componentes/usarDesplazamiento";
import { ANCLA_PREGUNTAS, ANCLA_QUE_HACEMOS } from "./enlaces";

const ENLACE =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold text-texto-suave transition-colors hover:bg-superficie hover:text-texto";

/**
 * El navbar de la portada. Tiene la forma del de la app (arriba ancho y sin
 * fondo; al bajar, una pildora centrada con borde, desenfoque y sombra), pero
 * no sus enlaces: quien llega aca todavia no entro, asi que lleva «¿Que
 * hacemos?», «Preguntas», el tema y «Entrar».
 *
 * Luka va quieto: en la portada nada se mueve en bucle.
 *
 * El contenedor de afuera no recibe clics (`pointer-events-none`) para que la
 * franja vacia a los lados de la pildora no tape lo que hay debajo.
 */
export function NavPortada() {
  const abajo = usarDesplazamiento(24);

  return (
    <div className="pointer-events-none sticky top-0 z-40">
      <div className={`mx-auto w-full max-w-6xl px-4 transition-[padding] duration-300 ${abajo ? "pt-2" : "pt-3"}`}>
        <header
          className={`pointer-events-auto mx-auto flex items-center border transition-[max-width,height,padding,gap,border-radius,border-color,background-color,box-shadow] duration-300 ease-out ${
            abajo
              ? "h-16 max-w-[680px] gap-1 rounded-full border-borde bg-superficie/90 px-2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)] backdrop-blur-md"
              : "h-[4.5rem] max-w-6xl gap-2 rounded-[28px] border-transparent bg-transparent px-0"
          }`}
        >
          <Link
            href="/bienvenida"
            aria-label="Luka, ir al inicio"
            className="font-marca flex shrink-0 items-center gap-2 text-xl leading-none font-extrabold tracking-[-0.03em] text-texto @xl:text-2xl"
          >
            <Luka
              pose="rastreando"
              quieto
              className={`w-auto transition-[height] duration-300 ${abajo ? "h-10" : "h-10 @xl:h-12"}`}
            />
            <span className="sr-only @md:not-sr-only">Luka</span>
          </Link>

          <nav aria-label="Secciones" className={abajo ? "ml-1" : "ml-1 @2xl:ml-5"}>
            <ul className="flex items-center gap-0.5">
              <li>
                <a href={`#${ANCLA_QUE_HACEMOS}`} className={ENLACE}>
                  ¿Qué hacemos?
                </a>
              </li>
              <li className="hidden @2xl:block">
                <a href={`#${ANCLA_PREGUNTAS}`} className={ENLACE}>
                  Preguntas
                </a>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <InterruptorTema className="grid size-11 cursor-pointer place-items-center rounded-full text-texto-suave transition-colors hover:bg-superficie hover:text-texto" />
            <Link href="/ingresar" className="boton-luka">
              Entrar
            </Link>
          </div>
        </header>
      </div>
    </div>
  );
}
