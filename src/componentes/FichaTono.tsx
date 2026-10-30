import { Icono } from "./Icono";
import type { NombreIcono } from "./iconos";
import { TONOS, type Tono } from "./tonos";

/** El cuadrito solido con el icono en blanco: el color dice que dato es, no si es bueno. */
export function FichaTono({ tono, icono }: { tono: Tono; icono: NombreIcono }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${TONOS[tono].ficha}`}
    >
      <Icono nombre={icono} tamano={18} />
    </span>
  );
}
