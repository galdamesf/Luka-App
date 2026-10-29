/**
 * La curva que separa una seccion de la siguiente, como los cerros de la
 * portada.
 *
 * Dos cosas que importan y que ya costaron caro al disenarla:
 *
 * 1. La onda se rellena con el color de la seccion que viene ABAJO, no con
 *    el suyo: asi la de abajo "sube" por la curva. Por eso `color` recibe el
 *    nombre de un token y no el de la seccion que la contiene.
 * 2. La seccion que termina en una onda necesita aire abajo, y ese aire lo
 *    pone `.con-onda`. Si la seccion escribe su propio `padding` con cero al
 *    final, se lo come y la curva termina encima del texto.
 *
 * Son ocho curvas distintas; no se repite la misma dos veces seguidas.
 */

const CURVAS = [
  "M0,96 C180,24 360,8 540,36 C760,70 900,120 1080,116 C1240,112 1340,78 1440,52 L1440,120 L0,120 Z",
  "M0,60 C200,120 420,118 640,78 C860,38 1080,10 1260,34 C1340,45 1400,62 1440,76 L1440,120 L0,120 Z",
  "M0,40 C160,92 300,104 460,86 C660,64 820,10 1020,14 C1200,18 1340,58 1440,96 L1440,120 L0,120 Z",
  "M0,104 C140,56 300,30 500,44 C700,58 840,110 1040,104 C1220,99 1350,62 1440,36 L1440,120 L0,120 Z",
  "M0,70 C120,18 280,6 480,30 C700,56 880,104 1080,96 C1250,89 1360,52 1440,22 L1440,120 L0,120 Z",
  "M0,28 C180,78 340,100 540,92 C760,83 920,28 1120,24 C1270,21 1370,48 1440,70 L1440,120 L0,120 Z",
  "M0,88 C200,110 380,96 560,62 C780,20 960,2 1160,26 C1290,41 1380,72 1440,98 L1440,120 L0,120 Z",
  "M0,52 C160,10 360,6 560,40 C780,78 940,118 1140,110 C1280,104 1380,78 1440,56 L1440,120 L0,120 Z",
] as const;

/** Los tokens de color con los que una onda se puede rellenar. */
export type ColorDeOnda =
  | "fondo"
  | "superficie"
  | "superficie-tenue"
  | "durazno"
  | "acento"
  | "noche"
  | "pie";

type Props = {
  /** El color de la seccion que viene DEBAJO, no el de la que la contiene. */
  color: ColorDeOnda;
  /** Cual de las ocho curvas, de 1 a 8. */
  curva?: number;
  className?: string;
};

export function Onda({ color, curva = 1, className = "" }: Props) {
  // El modulo deja que se pida la 9 o la 0 sin romper el dibujo.
  const forma = CURVAS[(Math.trunc(curva) - 1 + CURVAS.length * 2) % CURVAS.length];

  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 -bottom-px block h-[clamp(26px,4vw,56px)] w-full ${className}`}
    >
      <path d={forma} fill={`var(--${color})`} />
    </svg>
  );
}
