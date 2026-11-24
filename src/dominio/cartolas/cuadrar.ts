import { formatearCLP } from "@/lib/dinero";
import type { CartolaLeida } from "./tipos";

/**
 * Cuadrar la cartola: antes de anotar nada, lo que Luka leyo tiene que sumar
 * exactamente lo que el banco dice. Si falta una fila, si un monto se leyo
 * mal o si un cargo quedo como abono, la suma no calza y no se anota nada:
 * es preferible no traer la cartola que traerla con un error.
 *
 *   - Los cargos suman lo que el resumen dice de cheques, otros cargos e
 *     impuestos, y los abonos, lo de depositos y otros abonos.
 *   - El saldo inicial, mas los abonos, menos los cargos, da el saldo final.
 *   - Cada saldo diario que imprime el banco calza con la cuenta que va
 *     llevando Luka fila por fila.
 */

export type Cuadre = {
  cuadra: boolean;
  /** Por que no cuadra, en palabras. Vacio si cuadra. */
  problemas: string[];
  cargos: number;
  abonos: number;
};

function fechaCorta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function cuadrar(cartola: Pick<CartolaLeida, "filas" | "totales">): Cuadre {
  const problemas: string[] = [];
  const cargos = cartola.filas.filter((f) => f.lado === "cargo").reduce((suma, f) => suma + f.monto, 0);
  const abonos = cartola.filas.filter((f) => f.lado === "abono").reduce((suma, f) => suma + f.monto, 0);
  const totales = cartola.totales;

  if (!totales) {
    problemas.push("La cartola no trae el resumen con sus totales, y sin él no se puede cuadrar.");
    return { cuadra: false, problemas, cargos, abonos };
  }
  if (cargos !== totales.cargos) {
    problemas.push(`Los cargos suman ${formatearCLP(cargos)} y el banco dice ${formatearCLP(totales.cargos)}.`);
  }
  if (abonos !== totales.abonos) {
    problemas.push(`Los abonos suman ${formatearCLP(abonos)} y el banco dice ${formatearCLP(totales.abonos)}.`);
  }
  if (totales.saldoInicial + totales.abonos - totales.cargos !== totales.saldoFinal) {
    problemas.push("El saldo inicial más los abonos, menos los cargos, no da el saldo final del resumen.");
  }

  let saldo = totales.saldoInicial;
  for (const fila of cartola.filas) {
    saldo += fila.lado === "abono" ? fila.monto : -fila.monto;
    if (fila.saldo !== null && fila.saldo !== saldo) {
      problemas.push(`El saldo del ${fechaCorta(fila.fecha)} da ${formatearCLP(saldo)} y la cartola dice ${formatearCLP(fila.saldo)}.`);
      break;
    }
  }

  return { cuadra: problemas.length === 0, problemas, cargos, abonos };
}
