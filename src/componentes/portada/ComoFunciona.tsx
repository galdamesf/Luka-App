"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * «Cómo funciona, en seis paneles»: el lienzo que se recorre de lado.
 *
 * Es el mismo componente de la seccion Plan Constancia de la tienda Vitalia,
 * traido a Luka. Lo que lo define:
 *
 * - El lienzo va A SANGRE y se desliza de lado, con encaje por panel. La
 *   variable --borde-l alinea el primer panel (y cada encaje) con el borde del
 *   contenido de la pagina, no con el de la ventana.
 * - Con el foco puesto en el lienzo, las flechas del teclado lo recorren de a
 *   un panel: deslizar de lado no puede ser la unica forma de llegar al final.
 * - Cada panel dibuja su garabato LA PRIMERA VEZ que se ve, con los trazos
 *   saliendo uno tras otro. El texto nunca se esconde esperando esa animacion.
 * - Los dibujos son trazos a mano: `pathLength={1}` deja que cada camino se
 *   dibuje sin tener que medirlo, con stroke-dashoffset de 1 a 0.
 * - El panel destacado es «Te queda», relleno en durazno: es el unico numero
 *   que de verdad importa de toda la portada.
 *
 * Las cifras llegan como props desde el servidor, del mismo mes que muestra la
 * app. Ningun numero esta escrito a mano aqui.
 */

type Props = {
  /** Lo que queda del mes, ya formateado. */
  queda: string;
  /** Cuantas categorias trae la app. */
  categorias: number;
};

const EXPO = "cubic-bezier(.16,1,.3,1)";

/** Un trazo a mano. Cada camino se dibuja solo, uno tras otro. */
function Tinta({
  d,
  viewBox,
  ancho = 2,
  className = "",
}: {
  d: string[];
  viewBox: string;
  ancho?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      className={`tinta block overflow-visible ${className}`}
    >
      {d.map((p, i) => (
        <path
          key={p}
          d={p}
          pathLength={1}
          strokeWidth={ancho}
          style={{ "--i": i } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

const BOLETA = [
  "M30 8 C 60 7, 90 8, 118 7",
  "M30 8 C 29 30, 30 52, 29 74",
  "M118 7 C 119 30, 118 52, 119 74",
  "M29 74 L 38 68 L 47 75 L 56 68 L 65 75 L 74 68 L 83 75 L 92 68 L 101 75 L 110 68 L 119 74",
  "M44 24 C 60 23, 76 24, 92 23",
  "M44 36 C 56 35, 68 36, 80 35",
  "M44 48 C 62 47, 82 48, 104 47",
];
const CAJONES = [
  "M20 20 C 60 19, 100 20, 140 19",
  "M20 20 C 19.5 40, 20.5 60, 20 80",
  "M140 19 C 140.5 40, 139.5 60, 140 80",
  "M20 80 C 60 81, 100 80, 140 80",
  "M20 40 C 60 39.5, 100 40.5, 140 40",
  "M20 60 C 60 60.5, 100 59.5, 140 60",
  "M70 30 C 77 29.5, 84 30.5, 90 30",
  "M70 50 C 77 50.5, 84 49.5, 90 50",
  "M70 70 C 77 69.5, 84 70.5, 90 70",
];
const SEMAFORO = [
  "M20 76 C 60 77, 110 75, 150 76",
  "M34 76 C 34 58, 34 40, 35 24 C 45 23, 56 23, 66 23 C 66 40, 67 58, 67 76",
  "M90 76 C 90 62, 90 46, 91 34 C 101 33, 112 33, 122 33 C 122 48, 123 62, 123 76",
  "M34 44 C 45 43, 56 44, 66 43",
];
const CUENTA = [
  "M24 18 C 60 17, 100 18, 136 17",
  "M24 18 C 23 40, 24 62, 23 82",
  "M136 17 C 137 40, 136 62, 137 82",
  "M23 82 C 60 83, 100 82, 137 82",
  "M44 44 L 58 58 L 92 30",
  "M44 66 C 66 65, 90 66, 112 65",
];
const CUOTAS = [
  "M16 70 C 60 71, 110 69, 154 70",
  "M28 70 C 28 56, 28 44, 29 34 C 37 33, 45 33, 53 33 C 53 46, 54 58, 54 70",
  "M66 70 C 66 52, 66 36, 67 24 C 75 23, 83 23, 91 23 C 91 40, 92 56, 92 70",
  "M104 70 C 104 46, 104 28, 105 14 C 113 13, 121 13, 129 13 C 129 34, 130 52, 130 70",
];
const ESTRELLA = ["M50 6 L 60 36 L 92 37 L 66 56 L 76 88 L 50 69 L 24 88 L 34 56 L 8 37 L 40 36 Z"];

export function ComoFunciona({ queda, categorias }: Props) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [borde, setBorde] = useState({ inicio: true, fin: false });

  const mirarBordes = useCallback(() => {
    const el = lienzo.current;
    if (!el) return;
    const inicio = el.scrollLeft <= 4;
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setBorde((p) => (p.inicio === inicio && p.fin === fin ? p : { inicio, fin }));
  }, []);

  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    let cuadro = 0;
    const alDesplazar = () => {
      if (!cuadro)
        cuadro = requestAnimationFrame(() => {
          cuadro = 0;
          mirarBordes();
        });
    };
    mirarBordes();
    el.addEventListener("scroll", alDesplazar, { passive: true });
    const tamano = new ResizeObserver(mirarBordes);
    tamano.observe(el);
    return () => {
      cancelAnimationFrame(cuadro);
      el.removeEventListener("scroll", alDesplazar);
      tamano.disconnect();
    };
  }, [mirarBordes]);

  // Cada panel dibuja su garabato la primera vez que se ve, al bajar por la
  // pagina o al deslizar el lienzo.
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const paneles = Array.from(el.querySelectorAll<HTMLElement>("[data-panel]"));
    if (typeof IntersectionObserver === "undefined") {
      paneles.forEach((p) => (p.dataset.visto = ""));
      return;
    }
    const ojo = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.intersectionRatio >= 0.55) {
            (e.target as HTMLElement).dataset.visto = "";
            ojo.unobserve(e.target);
          }
        }
      },
      { threshold: [0, 0.55, 0.8, 1] },
    );
    paneles.forEach((p) => ojo.observe(p));
    return () => ojo.disconnect();
  }, []);

  const ir = (dir: 1 | -1) => {
    const el = lienzo.current;
    if (!el) return;
    const panel = el.querySelector("li");
    const paso = panel ? panel.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * paso, behavior: quieto ? "auto" : "smooth" });
  };

  const porTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = lienzo.current;
    if (!el) return;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const modo: ScrollBehavior = quieto ? "auto" : "smooth";
    if (e.key === "ArrowRight") ir(1);
    else if (e.key === "ArrowLeft") ir(-1);
    else if (e.key === "Home") el.scrollTo({ left: 0, behavior: modo });
    else if (e.key === "End") el.scrollTo({ left: el.scrollWidth, behavior: modo });
    else return;
    e.preventDefault();
  };

  const paneles = [
    {
      titulo: "Anotas el gasto",
      cuerpo: <p>Monto, categoría y la foto de la boleta. Diez segundos, y queda guardado con su fecha.</p>,
      arte: <Tinta d={BOLETA} viewBox="0 0 150 84" className="h-24 w-[170px]" />,
    },
    {
      titulo: "Cae en su cajón",
      cuerpo: (
        <p>
          {categorias} categorías ya cargadas: Supermercado, Feria, Bencina, Café y las demás. A
          cualquiera le pones techo.
        </p>
      ),
      arte: <Tinta d={CAJONES} viewBox="0 0 160 100" className="h-25 w-40" />,
    },
    {
      titulo: "El color te avisa",
      cuerpo: (
        <p>
          Verde mientras sobra, ocre desde el 80 % y rojo al llegar al tope. No hay que leer nada:
          se ve.
        </p>
      ),
      arte: <Tinta d={SEMAFORO} viewBox="0 0 170 86" className="h-24 w-[170px]" />,
    },
    {
      destacado: true,
      titulo: "Te queda",
      cuerpo: (
        <>
          <p className="font-marca relative inline-block text-[3.4rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums">
            {queda}
            <Tinta
              d={ESTRELLA}
              viewBox="0 0 100 96"
              ancho={3.4}
              className="absolute -top-0.5 -right-11 h-9 w-9"
            />
          </p>
          <p className="mt-3">
            De octubre, después de lo esencial, las cuotas ya pagadas y lo demás. Luka lo rehace
            cada vez que anotas un gasto.
          </p>
        </>
      ),
      arte: null,
    },
    {
      titulo: "Las cuentas se marcan",
      cuerpo: <p>Luz, agua, internet, gas. Marcas una como pagada y Luka crea el gasto solo, en su categoría, sin que lo anotes de nuevo.</p>,
      arte: <Tinta d={CUENTA} viewBox="0 0 160 100" className="h-25 w-40" />,
    },
    {
      titulo: "Las cuotas siguen solas",
      cuerpo: <p>La cuota 12 de 24 se sabe sola, sin que la anotes. Entra en el porcentaje del mes aunque todavía no la pagues.</p>,
      arte: <Tinta d={CUOTAS} viewBox="0 0 170 84" className="h-24 w-[170px]" />,
    },
  ];

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-tit"
      className="con-onda relative bg-fondo pt-10 text-texto sm:pt-16"
    >
      <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6 px-4 sm:px-6">
        <h2
          id="como-funciona-tit"
          className="font-marca text-2xl leading-none font-extrabold tracking-[-0.03em] lg:text-[1.9rem]"
        >
          Cómo funciona, en seis paneles
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-acento mr-2 hidden text-xl italic sm:inline">
            Desliza, o usa las flechas
          </span>
          {([
            { dir: -1 as const, rotulo: "Panel anterior", d: "M19 12H5M12 19l-7-7 7-7", off: borde.inicio },
            { dir: 1 as const, rotulo: "Panel siguiente", d: "M5 12h14M12 5l7 7-7 7", off: borde.fin },
          ]).map(({ dir, rotulo, d, off }) => (
            <button
              key={rotulo}
              type="button"
              aria-label={rotulo}
              aria-controls="como-funciona-lienzo"
              aria-disabled={off}
              onClick={() => !off && ir(dir)}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border-2 border-borde bg-superficie text-texto transition-colors hover:border-acento-fuerte hover:text-acento-fuerte aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-borde aria-disabled:hover:text-texto"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-[18px] w-[18px] fill-none stroke-current stroke-[2.25] [stroke-linecap:round] [stroke-linejoin:round]"
              >
                <path d={d} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={lienzo}
        id="como-funciona-lienzo"
        tabIndex={0}
        onKeyDown={porTeclado}
        aria-label="Los seis paneles, uno al lado del otro"
        className="lienzo mt-6 snap-x snap-mandatory overflow-x-auto pb-5 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-(--acento-fuerte)"
      >
        <ul className="flex w-max list-none gap-4 px-(--borde-l)">
          {paneles.map((panel, i) => (
            <li
              key={panel.titulo}
              data-panel={i}
              style={{ "--dur": "700ms" } as React.CSSProperties}
              className={`relative flex min-h-[348px] w-[80vw] max-w-[340px] shrink-0 snap-start flex-col rounded-[28px] border-2 p-6 md:min-h-[392px] md:w-[340px] lg:w-[352px] lg:max-w-none ${
                panel.destacado
                  ? "border-acento bg-durazno text-durazno-texto"
                  : "border-borde bg-superficie"
              }`}
            >
              <span
                aria-hidden="true"
                className={`font-acento absolute top-3 right-5 text-[1.6rem] italic ${
                  panel.destacado ? "text-durazno-realce" : "text-acento-fuerte"
                }`}
              >
                {i + 1}
              </span>
              <h3 className="font-marca pr-8 text-[1.75rem] leading-[0.95] font-extrabold tracking-[-0.03em]">
                {panel.titulo}
              </h3>
              <div className="mt-4 text-base leading-relaxed text-pretty">{panel.cuerpo}</div>
              {panel.arte ? (
                <div
                  className={`mt-auto pt-6 ${panel.destacado ? "text-durazno-realce" : "text-acento-fuerte"}`}
                >
                  {panel.arte}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
