import { useId, type CSSProperties, type ReactNode } from "react";

/** Las poses que Luka sabe hacer. Se van sumando a medida que se necesitan. */
export type PoseLuka = "rastreando" | "echado" | "lupa";

type Props = {
  pose?: PoseLuka;
  /** En el paseo del header: el movimiento lo calcula EscenaPaseo, no el CSS. */
  paseando?: boolean;
  /**
   * Sin movimiento: el dibujo no lleva las clases que anima globals.css. La
   * portada lo usa asi (alli nada queda en bucle). La lupa va siempre quieta.
   */
  quieto?: boolean;
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
 * El dibujo es el de siempre (formas planas, sin contorno, los mismos
 * colores), afinado: la lista blanca de la frente va dentro de la cabeza y ya
 * no asoma como un cuerno; el collar es un collar angosto con su borde,
 * argolla y una placa con una huella; el ojo lleva ceja y un segundo brillo;
 * la nariz, su brillo; la oreja, sombra interior y luz en el borde; la cola
 * termina en una punta blanca y redonda, y las patas tienen dedos.
 *
 * Tres cosas que importan y que ya costaron caro una vez:
 *
 * 1. Ninguna pose lleva piso debajo. La criatura tiene que poder ponerse
 *    sobre cualquier fondo sin arrastrar un suelo propio. A lo mas, una
 *    sombra translucida bajo las patas (la lupa), que se apoya en cualquiera.
 * 2. Los recortes (<clipPath>) llevan un id propio por cada dibujo, sacado de
 *    useId. Con un id fijo, si el mismo dibujo aparece dos veces en la pagina
 *    url(#id) resuelve siempre a la primera copia; si esa esta oculta, el
 *    recorte deja de existir y las formas se derraman. Con un id por copia,
 *    cada una recorta con lo suyo.
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

const COLOR = {
  tan: "#cdb49a",
  tanOscuro: "#b3977b",
  crema: "#f3ece3",
  vientre: "#eee0cd",
  pata: "#e8d9c3",
  pie: "#f7f0e5",
  pieLejano: "#d9c7af",
  oreja: "#8d7358",
  orejaSombra: "#75604a",
  orejaLuz: "#a3876b",
  montura: "#2a2a33",
  monturaLuz: "#3b3b47",
  tinta: "#0f172a",
  collar: "#f2823f",
  collarSombra: "#d9733f",
  argolla: "#c9b9a4",
  ceja: "#a88d71",
  lengua: "#e8857a",
  boca: "#6b2f2a",
  echadoPecho: "#e3d5c3",
};

const D = {
  cabeza: "M118 174c20 0 34 14 32 34-2 18-14 30-32 32-20 2-36-10-38-28-2-20 14-38 38-38z",
  hocico: "M104 198c-14 8-28 22-36 36-5 9-2 17 7 19 7 1 14-2 20-8 11-11 18-26 20-38z",
  lista: "M121 172c-9 0-17 5-23 13-4 5-7 11-8 17l12 2c1-6 4-11 8-16 4-5 9-8 14-10z",
  oreja: "M128 182c14-2 24 10 26 32 2 24-4 44-14 50-8 5-16 0-18-12-3-16-1-32-2-45-1-14-2-24 8-25z",
  orejaSombra: "M148 194c6 8 8 20 8 34 0 18-4 30-10 34-4 2-8 1-10-3 8-6 12-18 12-34 0-12-2-22 0-31z",
  cuerpo: "M150 178c46 0 86 12 92 34 5 20-8 42-30 48-30 8-82 6-106-6-18-9-18-34-4-52 10-14 28-24 48-24z",
  montura: "M150 178c46 0 86 12 92 34 2 8 1 16-2 23-6-26-44-40-90-40-18 0-33 5-43 13 10-18 27-30 43-30z",
  // La pechera: nace bajo el menton y baja siguiendo el pecho.
  vientre:
    "M100 226 C110 236 126 242 148 245 C170 248 192 248 212 244 C206 256 196 264 182 267 C154 273 118 270 98 261 C90 257 88 248 92 238 C94 233 97 229 100 226 Z",
  cola: "M233 200c3-22 11-40 22-52 7-8 15-7 18 1 3 9-3 16-10 23-11 11-19 23-22 35z",
  collar: "M160 177c7 12 10 28 8 44-5 2-10 2-15 1 2-15 0-30-7-42 5-3 9-4 14-3z",
  collarBorde: "M168 213c-1 3-1 6-1 8-5 2-10 2-15 1 0-3 1-6 1-9 5 1 10 1 15 0z",
  pataCerca: "M133 228c9 0 15 9 15 21v19h-15z",
};

/** Un id que url(#…) acepte: useId trae caracteres que ahi no van. */
function useIdDibujo(): string {
  return "luka" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Un nombre de clase solo si el dibujo se mueve. */
const si = (mueve: boolean, clase: string) => (mueve ? clase : undefined);

/** Los recortes de la cabeza, la oreja, la cola y el cuerpo. */
function Recortes({ uid }: { uid: string }) {
  return (
    <defs>
      <clipPath id={`${uid}-cabeza`}><path d={D.cabeza} /></clipPath>
      <clipPath id={`${uid}-oreja`}><path d={D.oreja} /></clipPath>
      <clipPath id={`${uid}-cola`}><path d={D.cola} /></clipPath>
      <clipPath id={`${uid}-cuerpo`}><path d={D.cuerpo} /></clipPath>
    </defs>
  );
}

function Oreja({ uid }: { uid: string }) {
  return (
    <>
      <path d={D.oreja} fill={COLOR.oreja} />
      <g clipPath={`url(#${uid}-oreja)`}>
        <path d={D.orejaSombra} fill={COLOR.orejaSombra} opacity="0.55" />
        <path d="M131 190c-3 14-2 30 0 46" fill="none" stroke={COLOR.orejaLuz} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </g>
    </>
  );
}

/** La cabeza. Con `contento`, la boca se abre y asoma la lengua. */
function Cabeza({
  uid,
  contento = false,
  mueve,
  oreja,
}: {
  uid: string;
  contento?: boolean;
  mueve: boolean;
  oreja: ReactNode;
}) {
  return (
    <>
      <path d={D.cabeza} fill={COLOR.tan} />
      <g clipPath={`url(#${uid}-cabeza)`}>
        <path d={D.lista} fill={COLOR.crema} />
      </g>
      <path d={D.hocico} fill={COLOR.crema} />
      <g transform="rotate(-24 74 244)">
        <ellipse cx="74" cy="244" rx="12" ry="10" fill={COLOR.tinta} />
        <ellipse cx="70" cy="240" rx="4.5" ry="2.4" fill="#ffffff" opacity="0.45" />
      </g>
      {contento ? (
        <>
          <path d="M84 246c2 9 12 11 17 3-6 2-12 1-17-3z" fill={COLOR.boca} />
          <path d="M89 250c0 5 7 6 9 1-3 0-6 0-9-1z" fill={COLOR.lengua} />
          <path d="M84 246c5 4 11 5 17 3" stroke={COLOR.tinta} strokeWidth="2.8" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <path d="M86 248c4 3 9 3 13 1" stroke={COLOR.tinta} strokeWidth="3" strokeLinecap="round" fill="none" />
      )}
      <path d="M101 186c5-4 12-5 18-2" stroke={COLOR.ceja} strokeWidth="3" strokeLinecap="round" fill="none" />
      <g className={si(mueve, "luka-ojo")}>
        <circle cx="110" cy="200" r="10.5" fill={COLOR.tinta} />
        <circle cx="113.5" cy="196.5" r="3.6" fill="#ffffff" />
        <circle cx="106.6" cy="204" r="1.5" fill="#ffffff" opacity="0.85" />
      </g>
      {oreja}
    </>
  );
}

/** Una pata con su pie; las de adelante llevan dedos. */
function Pata({ d, color, pie, pieX, dedos = true }: { d: string; color: string; pie: string; pieX: number; dedos?: boolean }) {
  return (
    <>
      <path d={d} fill={color} />
      <ellipse cx={pieX} cy="268" rx="13" ry="7" fill={pie} />
      {dedos && (
        <path d={`M${pieX - 4} 263.5v4M${pieX + 3} 263.5v4`} stroke={COLOR.pieLejano} strokeWidth="1.6" strokeLinecap="round" />
      )}
    </>
  );
}

function Cola({ uid }: { uid: string }) {
  return (
    <>
      <path d={D.cola} fill={COLOR.oreja} />
      <g clipPath={`url(#${uid}-cola)`}>
        <circle cx="268" cy="150" r="10.5" fill={COLOR.crema} />
      </g>
    </>
  );
}

function Lomo({ uid }: { uid: string }) {
  return (
    <>
      <path d={D.cuerpo} fill={COLOR.tan} />
      <path d={D.montura} fill={COLOR.montura} />
      <g clipPath={`url(#${uid}-cuerpo)`}>
        <path d="M166 183c28 2 54 8 66 20" fill="none" stroke={COLOR.monturaLuz} strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d={D.vientre} fill={COLOR.vientre} />
    </>
  );
}

function Collar() {
  return (
    <>
      <path d={D.collar} fill={COLOR.collar} />
      <path d={D.collarBorde} fill={COLOR.collarSombra} />
      <circle cx="160" cy="226" r="2.4" fill="none" stroke={COLOR.argolla} strokeWidth="1.4" />
      <circle cx="160" cy="233" r="5.6" fill={COLOR.pie} />
      <g fill={COLOR.pieLejano}>
        <ellipse cx="160" cy="234.6" rx="1.9" ry="1.5" />
        <circle cx="157.9" cy="232.2" r="0.8" />
        <circle cx="159.3" cy="231.2" r="0.8" />
        <circle cx="160.7" cy="231.2" r="0.8" />
        <circle cx="162.1" cy="232.2" r="0.8" />
      </g>
    </>
  );
}

/**
 * Rastreando: el logo. Las clases y los data-* son los que mueven las
 * animaciones de globals.css (cola, olfato, oreja, pestaneo, cuerpo) y el
 * paso del paseo en EscenaPaseo.
 */
function Rastreando({ uid, mueve }: { uid: string; mueve: boolean }) {
  return (
    <>
      <Recortes uid={uid} />
      <g className={si(mueve, "luka-cuerpo")}>
        <g className={si(mueve, "luka-cola")} data-cola>
          <Cola uid={uid} />
        </g>
        <g className={si(mueve, "luka-pata")} data-pata="3" style={{ transformOrigin: "224.5px 236px" }}>
          <Pata d="M216 222c10 0 17 10 17 24v22h-17z" color={COLOR.tanOscuro} pie={COLOR.pieLejano} pieX={224} dedos={false} />
        </g>
        <g className={si(mueve, "luka-pata")} data-pata="4" style={{ transformOrigin: "157.5px 236px" }}>
          <Pata d="M150 226c9 0 15 9 15 21v21h-15z" color={COLOR.tanOscuro} pie={COLOR.pieLejano} pieX={157} dedos={false} />
        </g>
        <Lomo uid={uid} />
        <g className={si(mueve, "luka-pata")} data-pata="1" style={{ transformOrigin: "176.5px 236px" }}>
          <Pata d="M168 226c10 0 17 10 17 24v18h-17z" color={COLOR.pata} pie={COLOR.pie} pieX={176} />
        </g>
        <g className={si(mueve, "luka-pata")} data-pata="2" style={{ transformOrigin: "140.5px 236px" }}>
          <Pata d={D.pataCerca} color={COLOR.pata} pie={COLOR.pie} pieX={140} />
        </g>
        <g className={si(mueve, "luka-olfato")} data-cabeza>
          <Cabeza
            uid={uid}
            mueve={mueve}
            oreja={
              <g className={si(mueve, "luka-oreja")}>
                <Oreja uid={uid} />
              </g>
            }
          />
        </g>
        <Collar />
      </g>
    </>
  );
}

/** Echado: el pie de pagina. Respira, mueve la oreja y parpadea lento. */
function Echado({ uid, mueve }: { uid: string; mueve: boolean }) {
  const cola = "M190 132c13-5 20-14 20-25 0-6-4-10-9-9-5 1-8 6-8 13 0 10-1 17-3 21z";
  const cabeza = "M90 110c14 0 24 10 23 23-1 13-10 21-23 22-14 1-25-7-27-20-2-13 11-25 27-25z";
  return (
    <>
      <defs>
        <clipPath id={`${uid}-cola`}><path d={cola} /></clipPath>
        <clipPath id={`${uid}-cabeza`}><path d={cabeza} /></clipPath>
      </defs>
      <g className={si(mueve, "luka-dormido")}>
        <path d={cola} fill={COLOR.oreja} />
        <g clipPath={`url(#${uid}-cola)`}>
          <circle cx="206" cy="101" r="6.5" fill={COLOR.crema} />
        </g>
        <path d="M114 104c38-5 76-2 90 11 11 10 5 27-10 31-26 7-74 7-98 0-13-4-16-15-8-24 7-9 15-16 26-18z" fill={COLOR.tan} />
        <path d="M122 102c34-4 64 0 78 11 5 4 7 9 7 14-8-17-36-26-72-23-18 2-33 7-41 15 7-10 17-15 28-17z" fill={COLOR.montura} />
        <path d="M90 134c28 8 72 9 102 3-4 7-12 11-23 13-27 4-55 2-73-5-6-2-8-6-6-11z" fill={COLOR.crema} />
        <path d="M84 134c14-2 25 2 26 8 1 6-7 10-20 11-12 1-21-3-21-8 0-5 5-10 15-11z" fill={COLOR.echadoPecho} />
        <ellipse cx="88" cy="150" rx="18" ry="5" fill={COLOR.crema} />
        <path d={cabeza} fill={COLOR.tan} />
        <g clipPath={`url(#${uid}-cabeza)`}>
          <path d="M93 109c-6 1-11 4-15 9-3 4-5 8-6 12l8 2c1-4 3-8 5-11 3-4 6-6 10-8z" fill={COLOR.crema} />
        </g>
        <ellipse cx="76" cy="138" rx="22" ry="14" fill={COLOR.crema} />
        <g className={si(mueve, "luka-ojo-echado")}>
          <circle cx="85" cy="128" r="7.4" fill={COLOR.tinta} />
          <circle cx="87.6" cy="125.4" r="2.6" fill="#ffffff" />
          <circle cx="82.6" cy="131" r="1.1" fill="#ffffff" opacity="0.85" />
        </g>
        <ellipse cx="60" cy="141" rx="8" ry="6.4" fill={COLOR.tinta} />
        <ellipse cx="57.5" cy="138.6" rx="2.8" ry="1.5" fill="#ffffff" opacity="0.45" />
        <path
          className={si(mueve, "luka-oreja-echada")}
          d="M99 110c9-2 16 7 18 21 1 15-2 27-8 31-5 3-11 0-12-8-2-10-2-21-2-30 0-9-2-14 4-14z"
          fill={COLOR.oreja}
        />
        <path d="M119 107c4 7 5 16 5 24-3 2-7 2-10 1 1-8 0-17-4-24 3-1 6-2 9-1z" fill={COLOR.collar} />
        <path d="M124 128v3c-3 2-7 2-10 1v-3c3 1 7 1 10-1z" fill={COLOR.collarSombra} />
        <circle cx="119" cy="137" r="3.6" fill={COLOR.pie} />
      </g>
    </>
  );
}

/**
 * Con lupa: el mismo perro rastreando, quieto y contento, con la nariz hacia
 * abajo y la lupa bajo la nariz. Mira a la izquierda, como el logo. La lupa
 * es lo mas bajo del dibujo: va sobre la palabra que revisa, con Luka afuera
 * de ella.
 */
const LUPA = { x: 62, y: 287, r: 15 };
/** Cuanto alza la pata para tomar el mango (grados, giro horario). */
const PATA_LUPA = 48;
const rad = (g: number) => (g * Math.PI) / 180;
/** El mango sube del aro (arriba a la derecha del vidrio) a la pata que lo toma. */
const MANGO = (() => {
  const aro = { x: LUPA.x + LUPA.r * Math.cos(rad(-42)), y: LUPA.y + LUPA.r * Math.sin(rad(-42)) };
  const mano = { x: 140 - 36 * Math.sin(rad(PATA_LUPA)), y: 232 + 36 * Math.cos(rad(PATA_LUPA)) + 1 };
  return `M${aro.x.toFixed(1)} ${aro.y.toFixed(1)}L${mano.x.toFixed(1)} ${mano.y.toFixed(1)}`;
})();

function ConLupa({ uid }: { uid: string }) {
  return (
    <>
      <Recortes uid={uid} />
      <ellipse cx="166" cy="276" rx="84" ry="4.5" fill="#2b1708" opacity="0.1" />
      <Cola uid={uid} />
      <Pata d="M216 222c10 0 17 10 17 24v22h-17z" color={COLOR.tanOscuro} pie={COLOR.pieLejano} pieX={224} dedos={false} />
      <Pata d="M150 226c9 0 15 9 15 21v21h-15z" color={COLOR.tanOscuro} pie={COLOR.pieLejano} pieX={157} dedos={false} />
      <Lomo uid={uid} />
      <Pata d="M168 226c10 0 17 10 17 24v18h-17z" color={COLOR.pata} pie={COLOR.pie} pieX={176} />
      <path d={MANGO} stroke={COLOR.oreja} strokeWidth="6" strokeLinecap="round" />
      {/* La pata sale de detras de la oreja y toma el mango. */}
      <g transform={`rotate(${PATA_LUPA} 140 232)`}>
        <path d={D.pataCerca} fill={COLOR.pata} />
        <ellipse cx="140" cy="268" rx="12.5" ry="8" fill={COLOR.pie} />
      </g>
      {/* La cabeza baja hacia la lupa; la oreja sigue colgando. */}
      <g transform="rotate(-10 128 214)">
        <Cabeza
          uid={uid}
          contento
          mueve={false}
          oreja={
            <g transform="rotate(10 136 184)">
              <Oreja uid={uid} />
            </g>
          }
        />
      </g>
      <Collar />
      <circle cx={LUPA.x} cy={LUPA.y} r={LUPA.r} fill="#dbeeff" opacity="0.55" />
      <path d={`M${LUPA.x - 10} ${LUPA.y - 3}a10 10 0 0 1 6.5-7.5`} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
      <circle cx={LUPA.x} cy={LUPA.y} r={LUPA.r} fill="none" stroke={COLOR.montura} strokeWidth="4" />
    </>
  );
}

const VIEWBOX: Record<PoseLuka, string> = {
  rastreando: "52 137 240 144",
  echado: "46 94 176 68",
  lupa: "26 137 266 169",
};

export function Luka({
  pose = "rastreando",
  alto,
  descripcion = null,
  paseando = false,
  quieto = false,
  className = "",
}: Props) {
  const uid = useIdDibujo();
  const mueve = !quieto;
  const estilo: CSSProperties | undefined =
    alto === undefined ? undefined : { height: alto, width: "auto" };
  const accesible =
    descripcion === null
      ? { "aria-hidden": true as const }
      : { role: "img" as const, "aria-label": descripcion };

  return (
    <svg
      viewBox={VIEWBOX[pose]}
      style={estilo}
      className={`shrink-0 ${paseando ? "luka-pasea" : ""} ${className}`}
      {...accesible}
    >
      {pose === "rastreando" && <Rastreando uid={uid} mueve={mueve} />}
      {pose === "echado" && <Echado uid={uid} mueve={mueve} />}
      {pose === "lupa" && <ConLupa uid={uid} />}
    </svg>
  );
}
