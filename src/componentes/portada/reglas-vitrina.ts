import { formatearCLP } from "@/lib/dinero";
import { periodoDeFecha, periodoVecino } from "@/lib/periodo";
import { nombreDelMes, rangoLargo } from "@/componentes/formato";

/**
 * Las cuentas de la vitrina de la portada, sin React: el semaforo de cada
 * fila, el aviso de la feria y el «Dia de inicio». Siguen las reglas de la
 * app (dominio/presupuestos.ts y lib/periodo.ts); los tests de la portada las
 * comparan contra esas mismas funciones para que no se desvien.
 *
 * No se llama vitrina.ts a proposito: en el Mac los nombres no distinguen
 * mayusculas, y "./vitrina" desde Vitrina.tsx se resolvia a si mismo.
 */

/** «Hoy» en el mes de ejemplo: 18 de octubre. */
export const HOY_EJEMPLO = "2026-10-18";
/** El dia de inicio del mes de ejemplo: con el 27, octubre va del 27 sep al 26 oct. */
export const DIA_INICIO_EJEMPLO = 27;

/**
 * El semaforo de una fila, con los umbrales de la app: aviso desde el 80 %,
 * sin saldo al llegar justo al techo y pasado al superarlo.
 */
export type EstadoFila = "sobra" | "aviso" | "tope" | "pasado";

export function estadoDeFila(gastado: number, techo: number): EstadoFila {
  if (gastado > techo) return "pasado";
  if (gastado >= techo) return "tope";
  if ((gastado / techo) * 100 >= 80) return "aviso";
  return "sobra";
}

/** Cuanto se uso, 0 a 100 o mas. Sin techo no hay porcentaje. */
export function porcentajeUsado(gastado: number, techo: number): number {
  return techo <= 0 ? 0 : (gastado / techo) * 100;
}

/** Como en la app: «85%», sin espacio. */
export function textoPorcentaje(p: number): string {
  return p > 999 ? "999+%" : `${Math.round(p)}%`;
}

/** Un monto con signo menos de verdad: «−$15.000». */
export function montoConSigno(monto: number): string {
  return monto < 0 ? `−${formatearCLP(-monto)}` : formatearCLP(monto);
}

/** Lo que se escribe en el campo del presupuesto, en pesos enteros y con tope. */
export function leerMonto(texto: string): number {
  return Math.min(99_999_999, Number.parseInt(texto.replace(/\D/g, ""), 10) || 0);
}

export type AvisoFeria = {
  /** "sin" cuando la feria se queda sin presupuesto (el campo vacio). */
  estado: EstadoFila | "sin";
  titulo: string;
  linea: string;
};

/**
 * El aviso de la feria con las frases de la app: los tres avisos de
 * componentes/Presupuestos.tsx y la linea de cada fila de FilaPresupuesto.tsx.
 */
export function avisoDeFeria(gastado: number, techo: number): AvisoFeria {
  if (techo <= 0) {
    return {
      estado: "sin",
      titulo: "La feria no tiene presupuesto.",
      linea: "Ponle un techo y acá vas a ver cuánto te queda.",
    };
  }
  const estado = estadoDeFila(gastado, techo);
  const restante = techo - gastado;
  const usado = textoPorcentaje(porcentajeUsado(gastado, techo));
  const linea =
    restante < 0
      ? `te pasaste por ${formatearCLP(-restante)} · ${usado} usado`
      : `te quedan ${formatearCLP(restante)} · ${usado} usado`;
  const titulo = {
    pasado: "Te pasaste del presupuesto en Feria.",
    tope: "Llegaste al 100% en Feria: ahí ya no te queda nada.",
    aviso: "Estás llegando al límite en Feria.",
    sobra: "Feria va dentro de su presupuesto: sin avisos.",
  }[estado];
  return { estado, titulo, linea };
}

/** "2026-10" → "octubre". */
const soloElMes = (mes: string) => nombreDelMes(mes).split(" ")[0] as string;

/**
 * En que mes estas hoy (18 de octubre) segun el dia de inicio, y cual viene
 * despues: lo mismo que muestra el ajuste «Dia de inicio» de la app.
 */
export function mesConDiaDeInicio(dia: number) {
  const este = periodoDeFecha(HOY_EJEMPLO, dia);
  const siguiente = periodoVecino(este, 1);
  return {
    nombre: soloElMes(este.mes),
    siguiente: soloElMes(siguiente.mes),
    /** «27 de septiembre al 26 de octubre». */
    rango: rangoLargo(este.desde, este.hasta, false),
    dias: este.dias,
  };
}
