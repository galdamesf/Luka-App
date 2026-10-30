import Link from "next/link";
import { Icono } from "./Icono";
import { mesVecino, nombreDelMes } from "./formato";

type Props = {
  mes: string;
  /** A que pagina llevan las flechas. Por omision, el dashboard. */
  ruta?: string;
};

/**
 * Navegacion entre meses por enlaces, no por botones con JavaScript: asi cada
 * mes tiene su propia URL, funciona el boton atras del navegador y se puede
 * compartir o marcar un mes concreto.
 */
export function SelectorMes({ mes, ruta = "/" }: Props) {
  const anterior = mesVecino(mes, -1);
  const siguiente = mesVecino(mes, 1);

  return (
    <nav aria-label="Navegación entre meses" className="flex items-center gap-1">
      <Link
        href={`${ruta}?mes=${anterior}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-borde text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto sm:size-9"
      >
        <Icono nombre="chevron-left" tamano={18} />
        <span className="sr-only">Ir a {nombreDelMes(anterior)}</span>
      </Link>

      <span
        aria-live="polite"
        className="min-w-[10.5rem] text-center text-sm font-medium capitalize"
      >
        {nombreDelMes(mes)}
      </span>

      <Link
        href={`${ruta}?mes=${siguiente}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-borde text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto sm:size-9"
      >
        <Icono nombre="chevron-right" tamano={18} />
        <span className="sr-only">Ir a {nombreDelMes(siguiente)}</span>
      </Link>
    </nav>
  );
}
