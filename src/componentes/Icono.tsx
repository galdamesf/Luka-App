import { trazosDe, type Elemento } from "./iconos";

type Props = {
  nombre: string;
  /** Tamano en pixeles. 16 junto a texto, 20 en botones. */
  tamano?: number;
  className?: string;
};

function dibujar(elemento: Elemento, indice: number) {
  switch (elemento.tipo) {
    case "path":
      return <path key={indice} d={elemento.d} />;
    case "circle":
      return <circle key={indice} cx={elemento.cx} cy={elemento.cy} r={elemento.r} />;
    case "rect":
      return (
        <rect
          key={indice}
          x={elemento.x}
          y={elemento.y}
          width={elemento.ancho}
          height={elemento.alto}
          rx={elemento.rx}
        />
      );
  }
}

/**
 * Siempre decorativo: aria-hidden y sin foco. Lo que anuncia el lector de
 * pantalla es el texto que acompana al icono, nunca el icono.
 */
export function Icono({ nombre, tamano = 16, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {trazosDe(nombre).map(dibujar)}
    </svg>
  );
}
