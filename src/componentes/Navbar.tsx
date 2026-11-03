"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { InterruptorTema } from "./InterruptorTema";
import { Icono } from "./Icono";
import type { NombreIcono } from "./iconos";
import { Luka } from "./Luka";
import { usarDesplazamiento } from "./usarDesplazamiento";

const ENLACES: readonly { href: string; etiqueta: string; icono?: NombreIcono }[] = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/informes", etiqueta: "Informes" },
  // En celular va solo el icono: con el texto completo, el navbar no cabe.
  { href: "/como-usar", etiqueta: "¿Cómo usar?", icono: "circle-help" },
];

/**
 * Navbar flotante, con el mismo diseno que el de Vitalia: arriba va ancho y
 * sin fondo, y al bajar se encoge en una pildora centrada con borde, sombra
 * y desenfoque.
 *
 * Una diferencia a proposito: en Vitalia el navbar arriba va en blanco
 * porque flota sobre un hero oscuro. Esta app no tiene hero —la pagina
 * arranca con tarjetas sobre fondo claro—, asi que arriba el texto va en
 * tinta. Lo que cambia al bajar es la forma, no el color.
 *
 * El contenedor de afuera no recibe clics (`pointer-events-none`) para que
 * la franja vacia que queda a los lados de la pildora no tape lo que hay
 * debajo; la pildora si los recibe.
 */
export function Navbar() {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const abajo = usarDesplazamiento(24);
  // Al cambiar de pestana se conserva el mes que estabas mirando.
  const mes = parametros.get("mes");
  const sufijo = mes === null ? "" : `?mes=${mes}`;

  return (
    <div
      className="pointer-events-none sticky z-40 print:static"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className={`mx-auto w-full max-w-6xl transition-[padding] duration-300 ${
          abajo ? "pt-2" : "pt-3"
        }`}
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <header
          data-abajo={abajo}
          className={`navbar-luka pointer-events-auto mx-auto flex items-center border transition-[max-width,height,padding,gap,border-radius,border-color,background-color,backdrop-filter] duration-300 ease-out print:border-0 print:bg-transparent ${
            abajo
              ? "h-16 max-w-[640px] gap-1 rounded-full border-borde bg-superficie/90 px-2 backdrop-blur-md sm:max-w-[880px]"
              : "h-[4.5rem] max-w-6xl gap-2 rounded-[28px] sm:gap-3 border-transparent bg-transparent px-0 backdrop-blur-none"
          }`}
        >
          {/* La marca: el dibujo y el nombre son un solo enlace a inicio. */}
          <Link
            href={`/${sufijo}`}
            aria-label="Luka, ir al inicio"
            className={`flex shrink-0 cursor-pointer items-center gap-2 leading-none tracking-tight transition-[transform,font-size] duration-300 hover:opacity-80 ${
              abajo ? "text-xl" : "text-xl sm:text-2xl"
            }`}
            style={{ fontFamily: "var(--font-marca)", fontWeight: 800 }}
          >
            <Luka
              className={`w-auto transition-[height] duration-300 ${
                abajo ? "h-10 sm:h-11" : "h-10 sm:h-12"
              }`}
            />
            {/* En celular va solo el dibujo: con tres enlaces, el nombre no
                cabe y empujaba "Salir" fuera de la pantalla. El nombre lo
                sigue diciendo el aria-label del enlace. */}
            <span className="max-sm:sr-only">Luka</span>
          </Link>

          <nav aria-label="Secciones" className={abajo ? "ml-1" : "ml-1 sm:ml-5"}>
            <ul className="flex items-center gap-0.5">
              {ENLACES.map(({ href, etiqueta, icono }) => {
                // Informes queda marcado tambien en sus subpaginas (el reporte semanal).
                const activo = href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={`${href}${sufijo}`}
                      aria-current={activo ? "page" : undefined}
                      className={`inline-flex cursor-pointer items-center rounded-full py-2 text-sm font-semibold transition-[color,background-color,padding] duration-300 ${
                        // En celular, un poco menos de aire entre enlaces: son tres.
                        abajo ? "px-2 sm:px-2.5" : "px-2 sm:px-3"
                      } ${
                        activo
                          ? "bg-(--nav-activo) text-(--nav-tinta)"
                          : "text-(--nav-tinta-suave) hover:bg-(--nav-encima) hover:text-(--nav-tinta)"
                      }`}
                    >
                      {icono === undefined ? (
                        etiqueta
                      ) : (
                        <>
                          <span aria-hidden="true" className="sm:hidden">
                            <Icono nombre={icono} tamano={18} />
                          </span>
                          <span className="sr-only sm:not-sr-only">{etiqueta}</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 print:hidden">
            <InterruptorTema />
            {/* La salida: discreta, porque en una app de la casa se usa poco. */}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/bienvenida" })}
              className="cursor-pointer rounded-full px-2.5 py-2 text-sm font-semibold text-(--nav-tinta-suave) transition-colors hover:bg-(--nav-encima) hover:text-(--nav-tinta)"
            >
              Salir
            </button>
          </div>
        </header>
      </div>
    </div>
  );
}
