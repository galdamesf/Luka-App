import { CSSProperties, ReactNode } from "react";

/** Las poses que Luka sabe hacer. Se van sumando a medida que se necesitan. */
export type PoseLuka = "rastreando" | "echado";

type Props = {
  pose?: PoseLuka;
  /**
   * Alto en pixeles. El ancho sale solo del viewBox.
   * Si se omite, no se escribe style y manda la clase — necesario para dar
   * un tamano distinto por breakpoint, porque el style inline le gana a
   * cualquier clase.
   */
  alto?: number;
  /** Lo que lee un lector de pantalla. null lo deja decorativo. */
  descripcion?: string | null;
  className?: string;
};

/**
 * Luka, el beagle de la app.
 *
 * Tres cosas que importan y que ya costaron caro una vez:
 *
 * 1. Ninguna pose lleva piso debajo. La criatura tiene que poder ponerse
 *    sobre cualquier fondo sin arrastrar un suelo propio.
 * 2. Nada de <clipPath id>. Si el mismo dibujo aparece dos veces en la
 *    pagina, url(#id) resuelve siempre a la primera copia; si esa esta
 *    oculta, el recorte deja de existir y las formas se derraman. El <svg>
 *    ya recorta solo lo que se sale del viewBox.
 * 3. Ningun elemento mezcla un atributo `transform` con una animacion CSS de
 *    transform: la animacion REEMPLAZA al atributo en vez de sumarse, y la
 *    rotacion fija desaparece en cuanto corre. Donde hace falta un giro fijo
 *    bajo una animacion, van en grupos distintos.
 *
 * Con `prefers-reduced-motion` las animaciones se apagan (regla en
 * globals.css) y cada transform cae a su valor estatico, que aqui es a
 * proposito la pose de reposo. Una pose futura cuyo reposo NO sea la
 * identidad necesita una base inline que calce, o al congelarse va a quedar
 * en una postura que nadie dibujo.
 *
 * Los viewBox salen de medir la caja real de cada dibujo, no de recortar a
 * ojo: a ojo le corte las patas una vez.
 */
const POSES: Record<PoseLuka, { viewBox: string; dibujo: ReactNode }> = {
  rastreando: {
    viewBox: "52 137 240 144",
    dibujo: (
      <g className="luka-cuerpo">
        <g className="luka-cola">
          <path d="M233 200c3-22 11-40 22-52 7-8 15-7 18 1 3 9-3 16-10 23-11 11-19 23-22 35z" fill="#8d7358" />
          <path d="M273 149c-3-8-11-9-18-1-4 4-7 9-10 15 9-7 19-10 28-14z" fill="#f3ece3" />
        </g>
        <path d="M216 222c10 0 17 10 17 24v22h-17z" fill="#b3977b" />
        <ellipse cx="224" cy="268" rx="13" ry="7" fill="#e3d5c3" />
        <path d="M150 226c9 0 15 9 15 21v21h-15z" fill="#b3977b" />
        <ellipse cx="157" cy="268" rx="13" ry="7" fill="#e3d5c3" />
        <path d="M150 178c46 0 86 12 92 34 5 20-8 42-30 48-30 8-82 6-106-6-18-9-18-34-4-52 10-14 28-24 48-24z" fill="#cdb49a" />
        <path d="M150 178c46 0 86 12 92 34 2 8 1 16-2 23-6-26-44-40-90-40-18 0-33 5-43 13 10-18 27-30 43-30z" fill="#2a2a33" />
        <path d="M124 238c22 8 60 10 86 5-6 10-16 17-28 20-30 8-74 6-98-6-5-3-8-7-10-12 14 0 34-3 50-7z" fill="#f3ece3" />
        <path d="M168 226c10 0 17 10 17 24v18h-17z" fill="#e3d5c3" />
        <path d="M133 228c9 0 15 9 15 21v19h-15z" fill="#e3d5c3" />
        <ellipse cx="176" cy="268" rx="13" ry="7" fill="#f3ece3" />
        <ellipse cx="140" cy="268" rx="13" ry="7" fill="#f3ece3" />
        <g className="luka-olfato">
          <path d="M118 174c20 0 34 14 32 34-2 18-14 30-32 32-20 2-36-10-38-28-2-20 14-38 38-38z" fill="#cdb49a" />
          <path d="M104 198c-14 8-28 22-36 36-5 9-2 17 7 19 7 1 14-2 20-8 11-11 18-26 20-38z" fill="#f3ece3" />
          <g transform="rotate(-24 74 244)">
            <ellipse cx="74" cy="244" rx="12" ry="10" fill="#0f172a" />
          </g>
          <path d="M86 248c4 3 9 3 13 1" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M126 170c8 2 12 9 12 19 0 7-2 13-5 18l-13-5c3-6 5-13 5-19 0-6-1-10 1-13z" fill="#f3ece3" />
          <g className="luka-ojo">
            <circle cx="110" cy="200" r="10.5" fill="#0f172a" />
            <circle cx="113.5" cy="196.5" r="3.6" fill="#ffffff" />
          </g>
          <path className="luka-oreja" d="M128 182c14-2 24 10 26 32 2 24-4 44-14 50-8 5-16 0-18-12-3-16-1-32-2-45-1-14-2-24 8-25z" fill="#8d7358" />
        </g>
        <path d="M158 174c9 13 12 30 9 46-8 3-16 3-24 1 3-16 1-32-8-45 8-3 15-4 23-2z" fill="#b45309" />
        <circle cx="156" cy="222" r="6.5" fill="#e3d5c3" />
      </g>
    ),
  },

  echado: {
    viewBox: "46 94 176 68",
    dibujo: (
      <g className="luka-dormido">
        <path d="M190 132c13-5 20-14 20-25 0-6-4-10-9-9-5 1-8 6-8 13 0 10-1 17-3 21z" fill="#8d7358" />
        <path d="M210 107c0-6-4-10-9-9-3 1-6 3-7 8 5-2 11-1 16 1z" fill="#f3ece3" />
        <path d="M114 104c38-5 76-2 90 11 11 10 5 27-10 31-26 7-74 7-98 0-13-4-16-15-8-24 7-9 15-16 26-18z" fill="#cdb49a" />
        <path d="M122 102c34-4 64 0 78 11 5 4 7 9 7 14-8-17-36-26-72-23-18 2-33 7-41 15 7-10 17-15 28-17z" fill="#2a2a33" />
        <path d="M90 134c28 8 72 9 102 3-4 7-12 11-23 13-27 4-55 2-73-5-6-2-8-6-6-11z" fill="#f3ece3" />
        <path d="M84 134c14-2 25 2 26 8 1 6-7 10-20 11-12 1-21-3-21-8 0-5 5-10 15-11z" fill="#e3d5c3" />
        <ellipse cx="88" cy="150" rx="18" ry="5" fill="#f3ece3" />
        <path d="M90 110c14 0 24 10 23 23-1 13-10 21-23 22-14 1-25-7-27-20-2-13 11-25 27-25z" fill="#cdb49a" />
        <ellipse cx="76" cy="138" rx="22" ry="14" fill="#f3ece3" />
        <path d="M96 107c6 1 9 7 9 14 0 5-1 9-3 13l-9-4c2-4 3-9 3-13 0-4-1-8 0-10z" fill="#f3ece3" />
        <g className="luka-ojo-echado">
          <circle cx="85" cy="128" r="7.4" fill="#0f172a" />
          <circle cx="87.6" cy="125.4" r="2.6" fill="#ffffff" />
        </g>
        <ellipse cx="60" cy="141" rx="8" ry="6.4" fill="#0f172a" />
        <path className="luka-oreja-echada" d="M99 110c9-2 16 7 18 21 1 15-2 27-8 31-5 3-11 0-12-8-2-10-2-21-2-30 0-9-2-14 4-14z" fill="#8d7358" />
        <path d="M118 106c6 8 8 20 7 30-5 2-11 2-15 1 2-10 0-21-6-29 5-2 9-3 14-2z" fill="#b45309" />
        <circle cx="116" cy="138" r="4.3" fill="#e3d5c3" />
      </g>
    ),
  },
};

export function Luka({ pose = "rastreando", alto, descripcion = null, className = "" }: Props) {
  const { viewBox, dibujo } = POSES[pose];
  const estilo: CSSProperties | undefined =
    alto === undefined ? undefined : { height: alto, width: "auto" };
  const accesible =
    descripcion === null
      ? { "aria-hidden": true as const }
      : { role: "img" as const, "aria-label": descripcion };

  return (
    <svg viewBox={viewBox} style={estilo} className={`shrink-0 ${className}`} {...accesible}>
      {dibujo}
    </svg>
  );
}
