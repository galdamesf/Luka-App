/**
 * Los stickers del cierre: dibujos a mano alzada de las cosas que Luka anota
 * (la luz, el agua, la feria, la cuota, la boleta), repartidos por la banda
 * durazno. Trazo cafe oscuro de 2,4 y rellenos pastel que conversan con el
 * durazno. Son decorativos y van quietos.
 */

const TINTA = "#2b1708";
const T = { stroke: TINTA, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const DIBUJOS = {
  moneda: (
    <>
      <circle cx="32" cy="32" r="21" fill="#ffd36e" {...T} />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#c98a12" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
      <path d="M37 25c-2-2.6-10-3-10 2.2 0 5.4 11 3.8 11 9.4 0 5-8.6 5.2-11.6 2M32 19.5v4M32 41v4" fill="none" {...T} />
    </>
  ),
  boleta: (
    <>
      <path d="M18 9.5h28.5v41l-4-3-4.2 3-4-3-4.2 3-4-3-4.1 3-4-3z" fill="#fffaf2" {...T} />
      <path d="M24 19h16.5M24 26h11M24 33h16" fill="none" stroke="#c4a98d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36 40.5h5" fill="none" {...T} />
    </>
  ),
  casa: (
    <>
      <path d="M19 28v22.5h26V28" fill="#9ad6c4" {...T} />
      <path d="M12.5 31.5 32 13l19.5 18.5" fill="#ff8f8f" {...T} />
      <path d="M28 50.5V39h8v11.5" fill="#ff9f6e" {...T} />
    </>
  ),
  auto: (
    <>
      <path d="M9 39c0-5.4 3.2-8.4 8.6-9.4l5-8.4c1.2-2 3-3 5.2-3h12.4c2.2 0 4 1 5 3l4.4 8.4c5.2 1 7.4 4 7.4 9.4v4.5H9z" fill="#8cc8ff" {...T} />
      <path d="M26 21.5h12.5l3.4 8H22.4z" fill="#e8f4ff" {...T} />
      <circle cx="20.5" cy="44" r="5.2" fill={TINTA} />
      <circle cx="43.5" cy="44" r="5.2" fill={TINTA} />
    </>
  ),
  gota: (
    <>
      <path d="M32 9.5c6 9.4 15.6 18.4 15.6 27.6a15.6 15.6 0 0 1-31.2 0C16.4 27.9 26 18.9 32 9.5z" fill="#8cc8ff" {...T} />
      <path d="M24.8 37.5c.2 4.2 2.4 7 5.6 8.2" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  ampolleta: (
    <>
      <path d="M32 10a14 14 0 0 0-8.2 25.3c2.2 1.8 3.2 4.2 3.2 7.2h10c0-3 1-5.4 3.2-7.2A14 14 0 0 0 32 10z" fill="#ffe08a" {...T} />
      <path d="M27.4 47h9.2M28.6 52h6.8M32 2.5v3M12 22h-3M55 22h-3M17.5 9.5l2 2M46.5 9.5l-2 2" fill="none" {...T} />
    </>
  ),
  carro: (
    <>
      <path d="M17.5 21.5h33l-5.4 17H21.6z" fill="#ff9f6e" {...T} />
      <path d="M9 14.5h6.4l6.2 24h24.6" fill="none" {...T} />
      <circle cx="24" cy="46" r="3.6" fill={TINTA} />
      <circle cx="43" cy="46" r="3.6" fill={TINTA} />
    </>
  ),
  tarjeta: (
    <>
      <rect x="9.5" y="17.5" width="45" height="29" rx="5" fill="#c9b8ff" {...T} />
      <path d="M9.5 26.5h45" fill="none" stroke={TINTA} strokeWidth="4.5" />
      <path d="M16 38.5h11M33 38.5h5" fill="none" {...T} />
    </>
  ),
  calendario: (
    <>
      <rect x="11.5" y="14.5" width="41" height="38" rx="6" fill="#fffaf2" {...T} />
      <path d="M11.5 24.5h41v-4a6 6 0 0 0-6-6h-29a6 6 0 0 0-6 6z" fill="#ff8f8f" {...T} />
      <path d="M22 10.5v7M42 10.5v7" fill="none" {...T} />
      <text x="32" y="45" textAnchor="middle" fontFamily="Nunito Sans, sans-serif" fontWeight="900" fontSize="15" fill={TINTA}>27</text>
    </>
  ),
  huellas: (
    <>
      <g fill="#8d7358">
        <ellipse cx="20" cy="40" rx="6.2" ry="5.4" />
        <circle cx="13.4" cy="32.6" r="2.6" /><circle cx="19" cy="29.4" r="2.6" /><circle cx="25.4" cy="31" r="2.6" />
        <ellipse cx="42" cy="24" rx="6.2" ry="5.4" />
        <circle cx="35.4" cy="16.6" r="2.6" /><circle cx="41" cy="13.4" r="2.6" /><circle cx="47.4" cy="15" r="2.6" />
      </g>
    </>
  ),
} as const;

export type NombreSticker = keyof typeof DIBUJOS;

type PropsSticker = {
  nombre: NombreSticker;
  className?: string;
  giro?: number;
  /** Velocidad de parallax (ver Paralaje.tsx). */
  paralaje?: number;
};

export function Sticker({ nombre, className = "", giro = 0, paralaje }: PropsSticker) {
  // El giro va en `rotate` y no en `transform`: transform es del parallax.
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-paralaje={paralaje}
      data-paralaje-min={paralaje === undefined ? undefined : -70}
      data-paralaje-max={paralaje === undefined ? undefined : 70}
      className={`pointer-events-none drop-shadow-[0_6px_10px_rgba(43,23,8,0.14)] ${className}`}
      style={{ rotate: `${giro}deg` }}
    >
      {DIBUJOS[nombre]}
    </svg>
  );
}
