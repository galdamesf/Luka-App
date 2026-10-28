/**
 * Calculo de contraste segun WCAG 2.1.
 *
 * Se usa para verificar el tema en los tests y, mas adelante, para elegir el
 * color de texto sobre los segmentos de los graficos.
 */

const HEX = /^#([0-9a-f]{6})$/i;

/** Luminancia relativa de un color #RRGGBB, entre 0 y 1. */
export function luminancia(color: string): number {
  const encontrado = HEX.exec(color.trim());
  if (!encontrado) {
    throw new Error(`Color invalido: "${color}". Se espera el formato #RRGGBB.`);
  }
  const hex = encontrado[1] as string;

  const canales = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineal = canales.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

/** Razon de contraste entre dos colores, de 1:1 a 21:1. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto normal necesita 4.5:1 (WCAG AA, criterio 1.4.3). */
export function sirveParaTexto(frente: string, fondo: string): boolean {
  return contraste(frente, fondo) >= 4.5;
}

/** Elementos graficos y de interfaz necesitan 3:1 (WCAG AA, criterio 1.4.11). */
export function sirveParaGrafico(frente: string, fondo: string): boolean {
  return contraste(frente, fondo) >= 3;
}

/** Elige blanco o negro, el que se lea mejor sobre el color dado. */
export function textoLegibleSobre(fondo: string): "#ffffff" | "#000000" {
  return contraste("#ffffff", fondo) >= contraste("#000000", fondo)
    ? "#ffffff"
    : "#000000";
}

// ---------------------------------------------------------------------------
// Distancia perceptual (OKLab)
// ---------------------------------------------------------------------------

/**
 * El contraste WCAG mide legibilidad de texto sobre un fondo. No sirve para
 * saber si DOS COLORES se distinguen entre si: negro y azul marino tienen
 * contraste parecido contra blanco y aun asi se confunden.
 *
 * Para eso se usa distancia en OKLab, que esta armado para que una diferencia
 * numerica corresponda a una diferencia percibida. La convencion es
 * multiplicar por 100 y hablar de "delta E".
 */

type Oklab = { L: number; a: number; b: number };

function aLineal(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function canales(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) throw new Error(`Color invalido: "${color}". Se espera el formato #RRGGBB.`);
  const crudo = hex[1] as string;
  return [0, 2, 4].map((i) => Number.parseInt(crudo.slice(i, i + 2), 16) / 255) as [
    number, number, number,
  ];
}

/**
 * Matrices de Machado, Oliveira y Fernandes (2009) para severidad 1.0, en RGB
 * lineal. Simulan los tres tipos de daltonismo.
 */
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type TipoVision = keyof typeof MACHADO;

function oklabDesdeLineal(r: number, g: number, b: number): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function aOklab(color: string): Oklab {
  const [r, g, b] = canales(color).map(aLineal) as [number, number, number];
  return oklabDesdeLineal(r, g, b);
}

/**
 * Croma en OKLab: que tan colorido es, independiente de si es claro u oscuro.
 * Bajo 0.1 un color de categoria se empieza a leer como gris.
 */
export function croma(color: string): number {
  const { a, b } = aOklab(color);
  return Math.hypot(a, b);
}

/**
 * Como ve este color alguien con daltonismo, en RGB lineal.
 *
 * El recorte a [0, 1] NO es cosmetico: la matriz saca valores fuera del gamut
 * y una pantalla no puede mostrarlos, asi que la distancia medida sin recortar
 * sale optimista. Medido en esta paleta: 9.9 sin recortar contra 7.7
 * recortando, o sea la diferencia entre creer que pasa y saber que no.
 */
function simularCvd(color: string, tipo: TipoVision): [number, number, number] {
  const [r, g, b] = canales(color).map(aLineal) as [number, number, number];
  const m = MACHADO[tipo];
  const recortar = (c: number) => Math.max(0, Math.min(1, c));

  return [
    recortar(m[0]![0]! * r + m[0]![1]! * g + m[0]![2]! * b),
    recortar(m[1]![0]! * r + m[1]![1]! * g + m[1]![2]! * b),
    recortar(m[2]![0]! * r + m[2]![1]! * g + m[2]![2]! * b),
  ];
}

/**
 * Distancia perceptual entre dos colores, en centesimas de OKLab.
 *
 * Sin `tipo` mide vision normal. Con `tipo` mide como los ve alguien con ese
 * daltonismo.
 *
 * Referencias: bajo 8 dos colores se confunden incluso mirandolos juntos; 15
 * es la separacion que hace falta cuando el color es lo UNICO que identifica
 * cada serie.
 */
export function distanciaPerceptual(a: string, b: string, tipo?: TipoVision): number {
  const x = tipo ? oklabDesdeLineal(...simularCvd(a, tipo)) : aOklab(a);
  const y = tipo ? oklabDesdeLineal(...simularCvd(b, tipo)) : aOklab(b);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b) * 100;
}

/**
 * El par mas confundible de una lista, con su distancia.
 *
 * Con `tipo` responde la pregunta que importa de verdad: el peor par para
 * alguien que no distingue rojo de verde no es el mismo que el peor par para
 * el resto.
 */
export function parMasCercano(
  colores: readonly string[],
  tipo?: TipoVision,
): { a: string; b: string; distancia: number } | null {
  if (colores.length < 2) return null;

  let peor = { a: colores[0] as string, b: colores[1] as string, distancia: Infinity };
  for (let i = 0; i < colores.length; i += 1) {
    for (let j = i + 1; j < colores.length; j += 1) {
      const d = distanciaPerceptual(colores[i] as string, colores[j] as string, tipo);
      if (d < peor.distancia) {
        peor = { a: colores[i] as string, b: colores[j] as string, distancia: d };
      }
    }
  }
  return peor;
}
