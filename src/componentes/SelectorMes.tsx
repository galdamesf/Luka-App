import Link from "next/link";
import { Icono } from "./Icono";
import { mesVecino, nombreDelMes } from "./formato";

type Props = {
  mes: string;
  /** A que pagina llevan las flechas. Por omision, el dashboard. */
  ruta?: string;
  /** Las fechas del periodo ("27 oct – 26 nov"), cuando el mes no parte el 1. */
  rango?: string;
};

/**
 * Navegacion entre meses por enlaces, no por botones con JavaScript: asi cada
 * mes tiene su propia URL, funciona el boton atras del navegador y se puede
 * compartir o marcar un mes concreto.
 */
export function SelectorMes({ mes, ruta = "/", rango }: Props) {
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

      <span aria-live="polite" className="flex min-w-[10.5rem] flex-col items-center text-center leading-tight">
        <span className="text-sm font-medium capitalize">{nombreDelMes(mes)}</span>
        {rango !== undefined && <span className="cifra text-[11px] text-texto-tenue">{rango}</span>}
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
