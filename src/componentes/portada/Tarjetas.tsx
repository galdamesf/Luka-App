import { ANCLA_QUE_HACEMOS } from "./enlaces";
import { Lienzo, type Dibujo } from "./Lienzo";

/** Un circulo a mano, algo torcido, como los de un lapiz. */
function circulo(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r} C ${cx + r * 0.9} ${cy - r}, ${cx + r} ${cy - r * 0.3}, ${cx + r} ${cy + r * 0.1} C ${cx + r} ${cy + r * 0.8}, ${cx + r * 0.4} ${cy + r}, ${cx} ${cy + r} C ${cx - r * 0.7} ${cy + r}, ${cx - r} ${cy + r * 0.5}, ${cx - r} ${cy} C ${cx - r} ${cy - r * 0.6}, ${cx - r * 0.5} ${cy - r * 1.05}, ${cx + r * 0.25} ${cy - r * 0.95}`;
}

/** El calendario con el dia de pago encerrado. */
const CALENDARIO: Dibujo = {
  viewBox: "0 0 150 92",
  caminos: [
    "M14 20 C 50 18, 98 19, 134 20 C 135 44, 135 66, 134 86 C 98 88, 52 87, 15 86 C 14 64, 13 42, 14 20",
    "M15 36 C 54 35, 96 35, 134 36",
    "M44 10 C 44 16, 44 22, 45 28",
    "M104 10 C 104 16, 104 22, 105 28",
    "M15 61 C 54 60, 96 60, 134 61",
    "M58 36 C 58 52, 58 70, 59 86",
    "M96 36 C 96 52, 96 70, 97 86",
    "M126 62 C 142 63, 146 78, 134 86 C 122 93, 98 90, 93 79 C 88 67, 100 59, 120 61",
  ],
};

/** El techo de una categoria: lo gastado, la raya del 80% y el aviso del 100%. */
const TECHO: Dibujo = {
  viewBox: "0 0 160 92",
  caminos: [
    "M10 50 C 52 49, 108 49, 150 50 C 151 58, 151 64, 150 72 C 108 73, 52 73, 10 72 C 9 64, 9 57, 10 50",
    "M18 70 L 26 52",
    "M32 70 L 40 52",
    "M46 70 L 54 52",
    "M60 70 L 68 52",
    "M74 70 L 82 52",
    "M88 70 L 96 52",
    "M102 70 L 110 52",
    "M122 40 C 122 56, 122 70, 123 84",
    "M150 14 C 150 20, 150 26, 151 32",
    "M151 39 L 151 40",
  ],
};

/** La boleta, con su borde de papel cortado. */
const BOLETA: Dibujo = {
  viewBox: "0 0 150 92",
  caminos: [
    "M48 6 C 66 5, 86 5, 104 6 C 104 30, 105 54, 105 76 L 97 84 L 89 76 L 81 84 L 73 76 L 65 84 L 57 76 L 49 84 C 48 58, 48 32, 48 6",
    "M58 22 C 72 21, 84 21, 96 22",
    "M58 36 C 70 35, 80 35, 90 36",
    "M58 50 C 72 49, 84 49, 96 50",
    "M30 38 C 24 33, 15 37, 19 44 C 23 50, 32 50, 30 57 C 28 63, 18 61, 15 56",
    "M23 31 L 23 63",
  ],
};

/** La cuenta marcada como pagada. */
const PAGADA: Dibujo = {
  viewBox: "0 0 150 92",
  caminos: [
    "M14 24 C 32 23, 48 23, 62 24 C 63 40, 63 56, 62 72 C 46 73, 30 73, 15 72 C 14 56, 14 40, 14 24",
    "M22 46 C 28 52, 32 58, 36 62 C 46 44, 58 28, 74 10",
    "M84 34 C 102 33, 120 33, 140 34",
    "M84 50 C 100 49, 114 49, 128 50",
    "M84 66 C 102 65, 120 65, 136 66",
  ],
};

/** Las cuotas: las pagadas con su tic, y la flecha en la que toca. */
const CUOTAS: Dibujo = {
  viewBox: "0 0 160 92",
  caminos: [
    ...[20, 50, 80, 110, 140].map((cx) => circulo(cx, 40, 11)),
    ...[20, 50, 80].map((cx) => `M${cx - 5} 40 L ${cx - 1} 45 L ${cx + 6} 35`),
    "M96 84 C 100 74, 104 66, 108 58",
    "M108 58 L 100 61",
    "M108 58 L 110 66",
  ],
};

/** El medidor del Health Score. */
const MEDIDOR: Dibujo = {
  viewBox: "0 0 160 92",
  caminos: [
    "M20 80 C 20 44, 46 16, 80 16 C 114 16, 140 44, 140 80",
    "M30 52 L 38 56",
    "M80 26 L 80 34",
    "M130 52 L 122 56",
    "M80 80 C 92 66, 104 54, 114 42",
    circulo(80, 80, 6),
  ],
};

/**
 * Lo que hace Luka, en seis paneles que se recorren de lado (Lienzo.tsx), cada
 * uno con su dibujo a mano. Cada promesa sale de la app tal como es hoy: el mes de pago a pago
 * (lib/periodo.ts), los avisos de presupuesto (dominio/presupuestos.ts), las
 * boletas, las categorias que trae (dominio/categorias-base.ts), las cuentas
 * y cuotas que se anotan solas y el Health Score (dominio/salud.ts).
 *
 * Es el destino de «¿Que hacemos?», en el navbar y en el heroe.
 */
export const TARJETAS: readonly { titulo: string; texto: string; dibujo: Dibujo; destacado?: boolean }[] = [
  {
    titulo: "Tu mes, de pago a pago",
    texto:
      "Tu día de inicio es el día en que te pagan. Si es el 27, tu octubre va del 27 de septiembre al 26 de octubre, y lo que te queda habla del mes que estás viviendo.",
    dibujo: CALENDARIO,
  },
  {
    titulo: "Presupuesto por categoría",
    texto:
      "Ponle un techo a la feria, al café o a la bencina. Luka te avisa desde el 80%, cuando llegas al 100% y si te pasas.",
    dibujo: TECHO,
  },
  {
    titulo: "Cada gasto con su boleta",
    texto:
      "El monto, su categoría y la foto o el PDF de la boleta, para cuando alguien pregunte de dónde salió. Trae veintidós categorías listas.",
    dibujo: BOLETA,
  },
  {
    titulo: "Cuentas que se anotan solas",
    texto:
      "La luz, el agua, internet. Marcas una como pagada y el gasto aparece en su categoría, ya restado de lo que te queda.",
    dibujo: PAGADA,
  },
  {
    titulo: "Cuotas que no se olvidan",
    texto:
      "Cada mes sabe qué cuota toca: la 12 de 24 del crédito, la 5 de 12 del notebook. Al pagarla, se anota sola.",
    dibujo: CUOTAS,
  },
  {
    titulo: "La salud de tu mes",
    texto:
      "El Health Score: un número de 0 a 100 que junta tu ahorro, tus presupuestos, tus cuentas, tus deudas y tu ritmo de gasto, con una recomendación para subirlo.",
    dibujo: MEDIDOR,
    destacado: true,
  },
];

/**
 * Cada panel lleva esquinas de 24 px y, abajo, el mismo canto de 3 px de los
 * botones (.boton-luka en globals.css): son de la misma familia. El de la
 * salud del mes va relleno de durazno. El lienzo va a sangre: el primer panel
 * se alinea con el resto de la portada (.lienzo, en globals.css).
 */
export function Tarjetas() {
  return (
    <section id={ANCLA_QUE_HACEMOS} aria-labelledby="portada-tarjetas" className="scroll-mt-24 pb-20 @3xl:pb-28">
      <Lienzo idTitulo="portada-tarjetas" idLienzo="lienzo-que-hacemos" paneles={TARJETAS} />
    </section>
  );
}
