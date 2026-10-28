/**
 * Categorias base para un hogar en Chile.
 *
 * `esencial: true` marca lo que llega igual todos los meses.
 *
 * ---------------------------------------------------------------------------
 * POR QUE EL COLOR VIENE DEL GRUPO Y NO DE LA CATEGORIA
 * ---------------------------------------------------------------------------
 *
 * El color de cada categoria tiene que cumplir tres cosas al mismo tiempo:
 *
 * 1. Verse sobre fondo claro (#ffffff) Y sobre fondo oscuro (#1b2336), porque
 *    la misma tarjeta se dibuja en los dos modos. Eso exige 3:1 contra ambos
 *    (WCAG 1.4.11) y encierra la paleta en una banda de luminancia estrecha.
 * 2. Dejar leer el texto encima: 4.5:1 con blanco o negro, el que convenga.
 * 3. Distinguirse de los demas: delta E 15 en OKLab para vision normal y 8
 *    para daltonismo, medido entre TODOS los pares, porque en una grilla de
 *    tarjetas se ven todas juntas.
 *
 * Con 13 colores fijos las tres juntas no tienen solucion. No es falta de
 * busqueda: se barrio el cubo sRGB completo con cuatro estrategias distintas
 * y el techo es delta E 8.9 para vision normal y 4.7 para daltonismo, muy
 * lejos de 15 y 8. La banda de luminancia que imponen (1) y (2) simplemente
 * no tiene espacio para 13 tonos separados.
 *
 * Con 5 grupos si: delta E 18.4 normal y 7.7 en el peor caso de daltonismo,
 * verificado con el validador de la habilidad dataviz en los dos modos y
 * sobre todos los pares. El 7.7 cae en la banda 6-8, que es legal solo con
 * identificacion secundaria, y aqui la hay siempre: cada tarjeta y cada fila
 * llevan su nombre y su propio icono, mas 2px de separacion entre tarjetas.
 * El color agrupa y refuerza; nunca identifica solo.
 *
 * El gris de "Otros" queda FUERA de la paleta categorica a proposito: un
 * neutro no pasa el piso de croma (0.1) porque justamente se tiene que leer
 * como "sin clasificar". Por eso se valida aparte, solo por contraste.
 *
 * El grupo es una propiedad fija de la categoria, nunca de su ranking: filtrar
 * o cambiar de mes no repinta ninguna tarjeta.
 *
 * Hay tests que verifican todo esto: tests/unit/categorias-base.test.ts.
 */

/** Los 5 colores categoricos mas el neutro. Un grupo = un area de la vida. */
export const GRUPOS_GASTO = {
  hogar:        { nombre: "Hogar",        color: "#009993" },
  alimentacion: { nombre: "Alimentación", color: "#c38409" },
  movilidad:    { nombre: "Movilidad",    color: "#0963ff" },
  bienestar:    { nombre: "Bienestar",    color: "#db1b51" },
  ocio:         { nombre: "Ocio",         color: "#9c5ac9" },
  otros:        { nombre: "Otros",        color: "#64748b" },
} as const;

export type ClaveGrupo = keyof typeof GRUPOS_GASTO;

/** Las 5 claves que si son colores categoricos. `otros` es el neutro. */
export const GRUPOS_CATEGORICOS = [
  "hogar",
  "alimentacion",
  "movilidad",
  "bienestar",
  "ocio",
] as const satisfies readonly ClaveGrupo[];

export const CATEGORIAS_BASE = [
  { nombre: "Arriendo",            grupo: "hogar",        icono: "house",          esencial: true  },
  { nombre: "Cuentas",             grupo: "hogar",        icono: "zap",            esencial: true  },
  { nombre: "Internet y teléfono", grupo: "hogar",        icono: "wifi",           esencial: true  },
  { nombre: "Supermercado",        grupo: "alimentacion", icono: "shopping-cart",  esencial: true  },
  { nombre: "Restaurantes",        grupo: "alimentacion", icono: "utensils",       esencial: false },
  { nombre: "Transporte",          grupo: "movilidad",    icono: "bus",            esencial: true  },
  { nombre: "Salud y farmacia",    grupo: "bienestar",    icono: "heart-pulse",    esencial: true  },
  { nombre: "Educación",           grupo: "bienestar",    icono: "graduation-cap", esencial: true  },
  { nombre: "Entretención",        grupo: "ocio",         icono: "film",           esencial: false },
  { nombre: "Ropa",                grupo: "ocio",         icono: "shirt",          esencial: false },
  { nombre: "Suscripciones",       grupo: "ocio",         icono: "repeat",         esencial: false },
  { nombre: "Regalos",             grupo: "ocio",         icono: "gift",           esencial: false },
  { nombre: "Otros",               grupo: "otros",        icono: "ellipsis",       esencial: false },
] as const satisfies readonly {
  nombre: string;
  grupo: ClaveGrupo;
  icono: string;
  esencial: boolean;
}[];

export type CategoriaBase = (typeof CATEGORIAS_BASE)[number];

/** El color con que se pinta una categoria. Viene de su grupo, siempre. */
export function colorDeGrupo(grupo: ClaveGrupo): string {
  return GRUPOS_GASTO[grupo].color;
}

/**
 * Las categorias con su color ya resuelto, que es como las consume la interfaz
 * y como se siembran en la base.
 */
export const CATEGORIAS_CON_COLOR = CATEGORIAS_BASE.map((c) => ({
  ...c,
  color: colorDeGrupo(c.grupo),
}));

/** El color con que se pinta una categoria, buscando por su color guardado. */
export function grupoDeColor(color: string): ClaveGrupo | null {
  const normalizado = color.trim().toLowerCase();
  for (const clave of Object.keys(GRUPOS_GASTO) as ClaveGrupo[]) {
    if (GRUPOS_GASTO[clave].color === normalizado) return clave;
  }
  return null;
}

/**
 * Los dos colores del grafico de flujo: lo que entra contra lo que sale.
 *
 * NO son verde y rojo, aunque sea lo obvio para plata. Medido: cualquier par
 * verde/rojo queda entre delta E 3.8 y 5.7 bajo deuteranopia, el daltonismo
 * mas comun (alrededor del 6% de los hombres). O sea las dos areas del
 * grafico se verian del mismo color para esa persona, que es exactamente el
 * error que el grafico existe para evitar.
 *
 * Teal contra naranja es el reemplazo seguro: delta E 28.8 en vision normal y
 * 13.8 en el peor daltonismo, y pasa el validador en los dos modos.
 */
export const SERIES_FLUJO = {
  ingresos: { nombre: "Ingresos", color: "#0d9488" },
  gastos: { nombre: "Gastos", color: "#ea580c" },
} as const;

/** Fondos contra los que se dibujan las tarjetas de categoria. */
export const FONDO_CLARO = "#ffffff";
export const FONDO_OSCURO = "#1b2336";
