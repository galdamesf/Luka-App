/**
 * Los colores del paisaje del header.
 *
 * Viven en su propio modulo y no dentro del componente por dos razones: la
 * prueba de contraste los recorre uno por uno, y el runner de pruebas no
 * transforma JSX (tsconfig trae jsx: "preserve", como pide Next).
 *
 * Lo que la prueba exige: ningun tono del dibujo puede acercarse a los cuatro
 * colores con que Luka avisa —verde «te sobra», ocre «vas en el 80 %», rojo
 * «llegaste al tope», azul deuda—. En esta app el color significa algo, asi
 * que un cerro verde seria una mentira. El par mas cercano hoy queda a 11 en
 * OKLab. Ademas, el frente tiene que ser oscuro: Luka es claro y solo se lee
 * recortado contra algo mas oscuro que el.
 *
 * La paleta es violeta, la de la seccion Nosotros de la tienda Vitalia traida
 * al atardecer de Luka. No sigue al tema: es una pintura, no interfaz.
 */
export const PALETA_PAISAJE = {
  "cielo-2": "#f9dcd0",
  "cielo-3": "#fdd2b2",
  "cielo-4": "#f4bba4",
  "dorado": "#dfa2b2",
  "nube-alta": "#fbe4d9",
  "nube-media": "#f8d7c3",
  "nube-baja": "#f0c3b6",
  "nube-oro": "#e2afbd",
  "nieve-luz": "#fdf8f3",
  "nieve-sombra": "#ded3f0",
  "roca-luz": "#a68fd2",
  "roca-media": "#8b70c2",
  "roca-sombra": "#6f55a8",
  "pre-lejos": "#9d85c7",
  "pre-media": "#8468b4",
  "pre-cerca": "#6b519c",
  "llano-lejos": "#c2addc",
  "llano-medio": "#ab93cf",
  "llano-cerca": "#9379bf",
  "alamo-lejos": "#7a60ab",
  "alamo-medio": "#5d4591",
  "alamo": "#3b2a6e",
  "matorral": "#2a1d57",
  "pirca": "#33255f",
  "piedra": "#3e2e71",
  "piedra-clara": "#473680",
  "senda": "#4e3c86",
  "borde": "#241a4e",
  "flor": "#f3b793",
  "condor": "#8d78b5",
} as const;

export type TonoPaisaje = keyof typeof PALETA_PAISAJE;
