/**
 * Trazados de los iconos, como datos.
 *
 * Van aca en vez de lucide-react para no sumar una dependencia por un punado de iconos,
 * y como datos en vez de JSX para que los tests puedan verificarlos sin
 * montar React. El componente que los dibuja es Icono.tsx.
 *
 * Estilo lucide: lienzo 24x24, sin relleno, trazo 2, puntas redondeadas.
 */

export type Elemento =
  | { readonly tipo: "path"; readonly d: string }
  | { readonly tipo: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly tipo: "rect";
      readonly x: number;
      readonly y: number;
      readonly ancho: number;
      readonly alto: number;
      readonly rx: number;
    };

const p = (d: string): Elemento => ({ tipo: "path", d });
const c = (cx: number, cy: number, r: number): Elemento => ({ tipo: "circle", cx, cy, r });
const r = (x: number, y: number, ancho: number, alto: number, rx: number): Elemento => ({
  tipo: "rect", x, y, ancho, alto, rx,
});

export const ICONOS = {
  // --- categorias (los nombres los guarda el seed en `icono`) ---
  "house": [
    p("M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"),
    p("M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
  ],
  "zap": [
    p("M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"),
  ],
  "wifi": [
    p("M12 20h.01"),
    p("M2 8.82a15 15 0 0 1 20 0"),
    p("M5 12.86a10 10 0 0 1 14 0"),
    p("M8.5 16.43a5 5 0 0 1 7 0"),
  ],
  "shopping-cart": [
    c(8, 21, 1),
    c(19, 21, 1),
    p("M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"),
  ],
  "bus": [
    p("M8 6v6"),
    p("M15 6v6"),
    p("M2 12h19.6"),
    p("M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"),
    c(7, 18, 2),
    p("M9 18h5"),
    c(16, 18, 2),
  ],
  "heart-pulse": [
    p("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"),
    p("M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"),
  ],
  "graduation-cap": [
    p("M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"),
    p("M22 10v6"),
    p("M6 12.5V16a6 3 0 0 0 12 0v-3.5"),
  ],
  "utensils": [
    p("M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"),
    p("M7 2v20"),
    p("M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"),
  ],
  "film": [
    r(2, 3, 20, 18, 2),
    p("M7 3v18"),
    p("M3 7.5h4"),
    p("M3 12h18"),
    p("M3 16.5h4"),
    p("M17 3v18"),
    p("M17 7.5h4"),
    p("M17 16.5h4"),
  ],
  "shirt": [
    p("M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"),
  ],
  "repeat": [
    p("m17 2 4 4-4 4"),
    p("M3 11v-1a4 4 0 0 1 4-4h14"),
    p("m7 22-4-4 4-4"),
    p("M21 13v1a4 4 0 0 1-4 4H3"),
  ],
  "gift": [
    r(3, 8, 18, 4, 1),
    p("M12 8v13"),
    p("M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"),
    p("M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"),
  ],
  "ellipsis": [c(12, 12, 1), c(19, 12, 1), c(5, 12, 1)],

  // --- interfaz ---
  "sun": [
    c(12, 12, 4),
    p("M12 2v2"), p("M12 20v2"),
    p("m4.93 4.93 1.41 1.41"), p("m17.66 17.66 1.41 1.41"),
    p("M2 12h2"), p("M20 12h2"),
    p("m6.34 17.66-1.41 1.41"), p("m19.07 4.93-1.41 1.41"),
  ],
  "moon": [p("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z")],
  "chevron-left": [p("m15 18-6-6 6-6")],
  "chevron-right": [p("m9 18 6-6-6-6")],
  "trash": [
    p("M3 6h18"),
    p("M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"),
    p("M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"),
  ],
  "plus": [p("M5 12h14"), p("M12 5v14")],
  "check": [p("M20 6 9 17l-5-5")],
  "paperclip": [
    p("M13.234 20.252 21 12.3"),
    p("m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"),
  ],
  "camera": [
    p("M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"),
    c(12, 13, 3),
  ],
  "undo": [p("M3 7v6h6"), p("M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13")],
  "alert": [
    p("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"),
    p("M12 9v4"),
    p("M12 17h.01"),
  ],
  "x": [
    p("M18 6 6 18"),
    p("m6 6 12 12"),
  ],
  "external-link": [
    p("M15 3h6v6"),
    p("M10 14 21 3"),
    p("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"),
  ],
  "trending-up": [
    p("M16 7h6v6"),
    p("m22 7-8.5 8.5-5-5L2 17"),
  ],
  "trending-down": [
    p("M16 17h6v-6"),
    p("m22 17-8.5-8.5-5 5L2 7"),
  ],
  "activity": [
    p("M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"),
  ],
  "fuel": [
    p("M3 22h12"),
    p("M4 9h10"),
    p("M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"),
    p("M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"),
  ],
  "shopping-basket": [
    p("m15 11-1 9"),
    p("m19 11-4-7"),
    p("M2 11h20"),
    p("m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"),
    p("M4.5 15.5h15"),
    p("m5 11 4-7"),
    p("m9 11 1 9"),
  ],
  "coffee": [
    p("M10 2v2"),
    p("M14 2v2"),
    p("M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"),
    p("M6 2v2"),
  ],
  "chevron-down": [
    p("m6 9 6 6 6-6"),
  ],
  "credit-card": [
    r(2, 5, 20, 14, 2),
    p("M2 10h20"),
  ],
  "pencil": [
    p("M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"),
    p("m15 5 4 4"),
  ],
  "table": [
    p("M12 3v18"),
    p("M3 9h18"),
    p("M3 15h18"),
    r(3, 3, 18, 18, 2),
  ],
  "droplet": [
    p("M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"),
  ],
  "apple": [
    p("M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"),
    p("M10 2c1 .5 2 2 2 5"),
  ],
  "egg": [
    p("M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"),
  ],
  "plane": [
    p("M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"),
  ],
  "umbrella": [
    p("M22 12a10.06 10.06 1 0 0-20 0Z"),
    p("M12 12v8a2 2 0 0 0 4 0"),
    p("M12 2v1"),
  ],

  // --- el resumen del dashboard ---
  "wallet": [
    p("M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"),
    p("M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"),
  ],
  "receipt": [
    p("M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"),
    p("M16 8H8"),
    p("M16 12H8"),
    p("M13 16H8"),
  ],
  "arrow-down-left": [
    p("M17 7 7 17"),
    p("M17 17H7V7"),
  ],
  "calendar": [
    r(3, 4, 18, 18, 2),
    p("M16 2v4"),
    p("M8 2v4"),
    p("M3 10h18"),
  ],
  "lightbulb": [
    p("M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"),
    p("M9 18h6"),
    p("M10 22h4"),
  ],
  "arrow-right": [
    p("M5 12h14"),
    p("m12 5 7 7-7 7"),
  ],
  "search": [
    c(11, 11, 8),
    p("m21 21-4.3-4.3"),
  ],
  "clock": [
    c(12, 12, 10),
    p("M12 6v6l4 2"),
  ],
  "piggy-bank": [
    p("M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"),
    p("M16 10h.01"),
    p("M2 8v1a2 2 0 0 0 2 2h1"),
  ],
  "arrow-up": [
    p("m5 12 7-7 7 7"),
    p("M12 19V5"),
  ],
  "download": [
    p("M12 15V3"),
    p("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"),
    p("m7 10 5 5 5-5"),
  ],
  "file-text": [
    p("M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"),
    p("M14 2v4a2 2 0 0 0 2 2h4"),
    p("M10 9H8"),
    p("M16 13H8"),
    p("M16 17H8"),
  ],
} as const satisfies Record<string, readonly Elemento[]>;

export type NombreIcono = keyof typeof ICONOS;

export const NOMBRES_ICONO = Object.keys(ICONOS) as NombreIcono[];

/** Icono de reserva, para que un nombre desconocido no rompa la pagina. */
export const ICONO_POR_OMISION: NombreIcono = "ellipsis";

export function trazosDe(nombre: string): readonly Elemento[] {
  return ICONOS[nombre as NombreIcono] ?? ICONOS[ICONO_POR_OMISION];
}
