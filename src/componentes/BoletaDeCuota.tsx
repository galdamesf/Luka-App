"use client";

import type { CuotaDelMes } from "@/dominio/balance";
import type { AccionFormulario } from "@/dominio/formulario";
import { VisorBoleta } from "./VisorBoleta";
import { AdjuntarBoleta } from "./AdjuntarBoleta";

type Props = {
  cuota: CuotaDelMes;
  /** Adjunta la foto al gasto del pago. Sin ella solo se puede ver. */
  accion?: AccionFormulario;
};

/**
 * La boleta de una cuota ya pagada: verla si tiene, o adjuntarla si no.
 *
 * La foto cuelga del gasto que se creo al pagar, igual que en cualquier otro
 * gasto. Si ese gasto ya no existe no hay donde guardarla, y no se ofrece.
 *
 * Renderiza bloques (<dialog>, <details> con <form>): va dentro de un div,
 * nunca de un <p> o un <span>.
 */
export function BoletaDeCuota({ cuota, accion }: Props) {
  if (!cuota.pagada) return null;
  if (cuota.boletaArchivo !== null) {
    return <VisorBoleta archivo={cuota.boletaArchivo} descripcion={`la cuota de ${cuota.deuda.nombre}`} />;
  }
  if (cuota.gastoId === null || accion === undefined) return null;
  return (
    <AdjuntarBoleta
      gastoId={cuota.gastoId}
      descripcion={`la cuota de ${cuota.deuda.nombre}`}
      accion={accion}
    />
  );
}
