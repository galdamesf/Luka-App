/**
 * El paisaje del header: cerros y bosque en capas planas, detras de Luka.
 *
 * Decisiones que conviene conocer:
 *
 * - Los verdes son apagados a proposito. Un verde saturado se leeria como el
 *   --exito de "te sobra", y en esta app el color significa algo. Los seis
 *   tonos estan medidos contra los cuatro colores de senal y el mas cercano
 *   queda a 11 en OKLab; las pruebas de contraste lo vigilan.
 * - Los arboles van a los costados y ninguno entra en el tercio del medio:
 *   ahi camina Luka, y su cuerpo es claro como los cerros. Recortado contra
 *   el cielo se lee; contra un cerro, no (1,03 de contraste, medido).
 * - El dibujo no lleva movimiento. Lo unico que se mueve en el header es
 *   Luka, y un fondo animado le robaria la atencion.
 *
 * El `viewBox` tiene el suelo en y=300 para que las patas del perro caigan
 * sobre esa linea.
 */

/** Un conifero plano, como los del sur. */
function Arbol({
  x,
  y,
  alto,
  color,
  tronco,
}: {
  x: number;
  y: number;
  alto: number;
  color: string;
  tronco: string;
}) {
  const ancho = alto * 0.52;
  const patas = alto * 0.16;
  const copa = alto - patas;
  return (
    <g>
      <rect
        x={x - alto * 0.045}
        y={y - patas}
        width={alto * 0.09}
        height={patas + 2}
        fill={tronco}
      />
      {/* Tres faldones, de mas ancho abajo a mas angosto arriba. */}
      {[0, 1, 2].map((n) => {
        const base = y - patas - (copa / 3) * n;
        const w = (ancho / 2) * (1 - n * 0.22);
        const h = copa / 3 + copa * 0.12;
        return (
          <path
            key={n}
            d={`M${x} ${base - h} L${x + w} ${base} L${x - w} ${base} Z`}
            fill={color}
          />
        );
      })}
    </g>
  );
}

export function Paisaje({ className = "" }: { className?: string }) {
  const lejos = "var(--paisaje-bosque-lejos)";
  const cerca = "var(--paisaje-bosque-cerca)";
  const tronco = "var(--paisaje-tronco)";

  return (
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 block w-full ${className}`}
    >
      {/* Cerros, de mas lejos a mas cerca. */}
      <path
        d="M0,196 C150,142 300,126 470,152 C650,180 800,228 980,218 C1150,209 1330,166 1440,138 L1440,320 L0,320 Z"
        fill="var(--paisaje-cerro-lejos)"
      />
      <path
        d="M0,238 C180,204 340,196 520,214 C720,234 880,268 1080,258 C1240,250 1360,226 1440,208 L1440,320 L0,320 Z"
        fill="var(--paisaje-cerro-cerca)"
      />

      {/* Bosque lejano: una hilera chica sobre el cerro. */}
      {[60, 118, 176, 232, 1208, 1266, 1322, 1380].map((x, n) => (
        <Arbol
          key={`lejos-${x}`}
          x={x}
          y={252 - (n % 3) * 3}
          alto={46 + (n % 3) * 7}
          color={lejos}
          tronco={lejos}
        />
      ))}

      {/* Bosque cercano: arboles grandes, solo a los costados. */}
      {/* Los de x 400 y 1040 existen para el telefono: ahi el dibujo se
          recorta al centro (de x 365 a 1074, medido a 390px) y los de los
          bordes no se ven. Quedan fuera de la zona del perro, que ocupa de
          492 a 947 en ese mismo recorte. */}
      {[
        [84, 300, 118],
        [168, 300, 92],
        [246, 300, 134],
        [330, 300, 78],
        [404, 300, 104],
        [1040, 300, 110],
        [1116, 300, 86],
        [1196, 300, 128],
        [1286, 300, 96],
        [1368, 300, 118],
      ].map(([x, y, alto]) => (
        <Arbol
          key={`cerca-${x}`}
          x={x as number}
          y={y as number}
          alto={alto as number}
          color={cerca}
          tronco={tronco}
        />
      ))}

      {/* El suelo donde camina. */}
      <path d="M0,300 L1440,300 L1440,320 L0,320 Z" fill="var(--paisaje-suelo)" />
    </svg>
  );
}
