import type { PaginaDeCartola } from "./tipos";

/**
 * Del texto suelto del PDF a lineas con sus palabras. Cada banco (y cada
 * version del mismo PDF) corta el texto distinto: a veces "05/10 O.Gerencia"
 * viene en un solo pedazo y a veces en dos. Por eso se trabaja con palabras,
 * cada una con donde empieza y donde termina en la pagina.
 */

export type Palabra = { x: number; fin: number; texto: string };

export type Linea = { y: number; palabras: Palabra[]; texto: string };

/** Dos pedazos a esta distancia vertical o menos estan en la misma linea. */
const MISMA_LINEA = 2.5;

/**
 * Las palabras de un pedazo, con su posicion estimada: el ancho del pedazo
 * repartido por caracteres. Basta para saber en que columna cae cada una.
 */
function palabrasDe(pieza: { x: number; ancho: number; texto: string }): Palabra[] {
  const largo = pieza.texto.length;
  if (largo === 0) return [];
  const porCaracter = pieza.ancho / largo;
  const palabras: Palabra[] = [];
  for (const encontrada of pieza.texto.matchAll(/\S+/g)) {
    const inicio = encontrada.index;
    palabras.push({
      x: pieza.x + inicio * porCaracter,
      fin: pieza.x + (inicio + encontrada[0].length) * porCaracter,
      texto: encontrada[0],
    });
  }
  return palabras;
}

/** Las lineas de una pagina, de arriba hacia abajo, cada una con sus palabras de izquierda a derecha. */
export function armarLineas(pagina: PaginaDeCartola): Linea[] {
  const piezas = [...pagina.piezas].sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: { y: number; piezas: typeof piezas }[] = [];
  for (const pieza of piezas) {
    const grupo = grupos.at(-1);
    if (grupo && Math.abs(grupo.y - pieza.y) <= MISMA_LINEA) grupo.piezas.push(pieza);
    else grupos.push({ y: pieza.y, piezas: [pieza] });
  }
  return grupos.map(({ y, piezas: delGrupo }) => {
    const palabras = delGrupo.flatMap(palabrasDe).sort((a, b) => a.x - b.x);
    return { y, palabras, texto: palabras.map((p) => p.texto).join(" ") };
  });
}

/** El texto sin espacios ni tildes, en mayusculas: "B A N C O S A N T A N D E R" -> "BANCOSANTANDER". */
export function compacto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** La palabra cuyo texto es este, en la linea, o undefined. */
export function palabraEn(linea: Linea, texto: string): Palabra | undefined {
  return linea.palabras.find((p) => p.texto === texto);
}

export function centro(palabra: Palabra): number {
  return (palabra.x + palabra.fin) / 2;
}

/** "1.234.567" -> 1234567, "-1.500" -> -1500. Null si no es un monto en pesos. */
export function leerPesos(texto: string): number | null {
  const encontrado = /^(-?)(\d{1,3}(?:\.\d{3})*)(-?)$/.exec(texto);
  if (!encontrado) return null;
  const valor = Number(encontrado[2]!.replace(/\./g, ""));
  return encontrado[1] === "-" || encontrado[3] === "-" ? -valor : valor;
}
