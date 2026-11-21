import type { Moneda, TipoMovimiento } from "./comprobantes/tipos";
import type { MedioPago } from "./esquemas";
import type { MotivoParaDejarFuera, Revision, SentidoMovimiento } from "./movimientos";

/**
 * Lo que ve la bandeja «Por revisar», ya en datos planos: lo arma
 * src/datos/movimientos.ts y lo dibuja src/componentes/BandejaPorRevisar.tsx.
 *
 * Vive aca y no junto a las acciones por lo mismo que EstadoFormulario
 * (src/dominio/formulario.ts): un archivo "use server" solo exporta
 * funciones async.
 */

export type ItemPorRevisar = {
  id: string;
  tipo: TipoMovimiento;
  sentido: SentidoMovimiento;
  /** Pesos si es CLP; centavos si es USD. */
  monto: number;
  moneda: Moneda;
  /** AAAA-MM-DD */
  fecha: string;
  comercio: string;
  fuente: string;
  medioPago: MedioPago | null;
  ultimos4: string | null;
  cuotas: number | null;
  contraparte: { nombre: string | null; banco: string | null; ultimos4: string | null };
  /** De 0 a 1, si lo leyo la IA. */
  confianza: number | null;
  /** Las fuentes de lo que se junto con este: "Aviso de cargo de Consorcio". */
  juntados: string[];
  revision: Revision;
};

/** Lo que Luka dejo fuera hace poco, con su motivo. */
export type ItemDejadoFuera = {
  id: string;
  comercio: string;
  monto: number;
  moneda: Moneda;
  fecha: string;
  fuente: string;
  motivo: MotivoParaDejarFuera;
  /** Si se puede volver a la bandeja: lo que salio de una cuenta, no lo que entro. */
  puedeAnotarse: boolean;
};

export type Bandeja = {
  porRevisar: ItemPorRevisar[];
  dejadosFuera: ItemDejadoFuera[];
  /**
   * Si la bandeja se muestra en el panel: cuando hay algo por revisar o hubo
   * movimientos hace poco. Asi no aparece vacia en un hogar que todavia no
   * reenvia sus comprobantes, y no desaparece de golpe al confirmar el ultimo
   * (con el aviso para deshacer todavia a la vista).
   */
  visible: boolean;
};

/** Lo que devuelve el boton «Deshacer» del aviso. */
export type Deshacer = {
  de: "confirmacion" | "descarte" | "anotar-igual";
  ids: string[];
};

/** La regla que se ofrece crear despues de confirmar un gasto. */
export type ReglaPosible = {
  movimientoId: string;
  categoriaId: string;
  /** El nombre de la categoria elegida. */
  categoria: string;
  /** El comercio como se muestra: "Líder". */
  etiqueta: string;
  /** true si ya habia una regla y se elegio otra categoria: la pregunta es si cambiarla. */
  cambia: boolean;
};

/** Lo que devuelven las acciones de la bandeja. */
export type ResultadoBandeja = {
  ok: boolean;
  /** El aviso para mostrar, o el error. */
  titulo: string | null;
  mensaje: string | null;
  deshacer: Deshacer | null;
  regla: ReglaPosible | null;
};
