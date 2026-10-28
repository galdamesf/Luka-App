/**
 * Geometria para dibujar graficos en SVG a mano.
 *
 * Todo aqui es matematica pura: recibe numeros, devuelve numeros o strings de
 * `d`. No toca el DOM ni React, asi que se puede testear entero.
 *
 * Decision: interpolacion cubica MONOTONA (Fritsch-Carlson), no Catmull-Rom.
 * Catmull-Rom se pasa de los datos en los quiebres, y en un grafico de plata
 * eso significa que la curva baja de cero entre dos meses positivos: dibuja
 * una deuda que no existe. La monotona garantiza que la curva se queda dentro
 * del rango de los puntos que une.
 */

export type Punto = { x: number; y: number };

/** Redondeo a 2 decimales, para que los `d` queden cortos y deterministas. */
const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Escala lineal de dominio a rango.
 *
 * Si el dominio es un punto (todos los valores iguales), devuelve el medio del
 * rango en vez de dividir por cero.
 */
export function escala(
  dominio: readonly [number, number],
  rango: readonly [number, number],
): (valor: number) => number {
  const [d0, d1] = dominio;
  const [r0, r1] = rango;
  const ancho = d1 - d0;

  if (!Number.isFinite(ancho)) throw new Error("dominio invalido");
  if (ancho === 0) return () => (r0 + r1) / 2;

  return (valor) => r0 + ((valor - d0) / ancho) * (r1 - r0);
}

/**
 * Niveles "redondos" para el eje de montos: 0, 200k, 400k... en vez de
 * 0, 183.333, 366.666.
 *
 * Devuelve siempre al menos dos niveles, el ultimo mayor o igual al maximo.
 */
export function nivelesRedondos(maximo: number, objetivo = 5): number[] {
  if (!Number.isFinite(maximo) || maximo <= 0) return [0, 1];

  const crudo = maximo / Math.max(1, objetivo);
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const normalizado = crudo / magnitud;

  const paso =
    magnitud * (normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10);

  const niveles: number[] = [];
  for (let v = 0; v < maximo + paso * 0.5; v += paso) niveles.push(r2(v));
  if ((niveles.at(-1) ?? 0) < maximo) niveles.push(r2((niveles.at(-1) ?? 0) + paso));
  return niveles;
}

/**
 * Pendientes de Fritsch-Carlson.
 *
 * La clave es el `<= 0`: cuando el punto es un maximo o un minimo local, la
 * pendiente se fuerza a 0 y la curva llega plana. Eso es lo que impide que se
 * pase de los datos.
 */
function pendientes(p: readonly Punto[]): number[] {
  const n = p.length;
  if (n < 2) return [0];

  const secantes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = p[i + 1]!.x - p[i]!.x;
    secantes.push(dx === 0 ? 0 : (p[i + 1]!.y - p[i]!.y) / dx);
  }

  const m: number[] = [secantes[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    const a = secantes[i - 1]!;
    const b = secantes[i]!;

    if (a * b <= 0) {
      m.push(0);
    } else {
      const dx0 = p[i]!.x - p[i - 1]!.x;
      const dx1 = p[i + 1]!.x - p[i]!.x;
      const w1 = 2 * dx1 + dx0;
      const w2 = dx1 + 2 * dx0;
      m.push((w1 + w2) / (w1 / a + w2 / b));
    }
  }
  m.push(secantes[n - 2]!);
  return m;
}

/** Los dos puntos de control de cada tramo, ya listos para la `C` del SVG. */
export function controles(
  p: readonly Punto[],
): { c1: Punto; c2: Punto; fin: Punto }[] {
  const m = pendientes(p);
  const tramos: { c1: Punto; c2: Punto; fin: Punto }[] = [];

  for (let i = 0; i < p.length - 1; i += 1) {
    const a = p[i]!;
    const b = p[i + 1]!;
    const dx = (b.x - a.x) / 3;

    tramos.push({
      c1: { x: a.x + dx, y: a.y + m[i]! * dx },
      c2: { x: b.x - dx, y: b.y - m[i + 1]! * dx },
      fin: b,
    });
  }
  return tramos;
}

/** La `d` de una linea. Con `suave: false` sale poligonal. */
export function rutaLinea(puntos: readonly Punto[], suave = true): string {
  if (puntos.length === 0) return "";
  const inicio = `M ${r2(puntos[0]!.x)} ${r2(puntos[0]!.y)}`;
  if (puntos.length === 1) return inicio;

  if (!suave) {
    return inicio + puntos.slice(1).map((p) => ` L ${r2(p.x)} ${r2(p.y)}`).join("");
  }

  return (
    inicio +
    controles(puntos)
      .map(
        ({ c1, c2, fin }) =>
          ` C ${r2(c1.x)} ${r2(c1.y)}, ${r2(c2.x)} ${r2(c2.y)}, ${r2(fin.x)} ${r2(fin.y)}`,
      )
      .join("")
  );
}

/** La `d` de un area: la misma linea, cerrada contra `yBase`. */
export function rutaArea(puntos: readonly Punto[], yBase: number, suave = true): string {
  if (puntos.length === 0) return "";
  const linea = rutaLinea(puntos, suave);
  const ultimo = puntos.at(-1)!;
  const primero = puntos[0]!;

  return `${linea} L ${r2(ultimo.x)} ${r2(yBase)} L ${r2(primero.x)} ${r2(yBase)} Z`;
}

/**
 * Donde se dio vuelta la plata: los puntos en que una serie pasa de estar
 * arriba a estar abajo de la otra.
 *
 * Tocarse NO es cruzarse. En meses sin datos las dos series valen 0 y quedan
 * pegadas; marcar eso como "cruce" llenaba el grafico de circulitos sobre la
 * linea del cero diciendo que la plata se dio vuelta doce veces, cuando no
 * habia pasado nada. Solo cuenta un cambio real de signo.
 */
export function cruces(a: readonly Punto[], b: readonly Punto[]): Punto[] {
  const n = Math.min(a.length, b.length);
  if (n < 2) return [];

  const diferencias = Array.from({ length: n }, (_, i) => a[i]!.y - b[i]!.y);
  const salida: Punto[] = [];

  // Se arrastra el ultimo signo distinto de cero: los tramos pegados se
  // saltan, y el cruce se anota solo cuando reaparece del otro lado.
  let signoPrevio = 0;
  let indicePrevio = -1;

  for (let i = 0; i < n; i += 1) {
    const signo = Math.sign(diferencias[i]!);
    if (signo === 0) continue;

    if (signoPrevio !== 0 && signo !== signoPrevio) {
      if (i - indicePrevio === 1) {
        // Tramo limpio: el cruce va interpolado donde de verdad se cortan.
        const d0 = diferencias[indicePrevio]!;
        const d1 = diferencias[i]!;
        const t = d0 / (d0 - d1);

        salida.push({
          x: r2(a[indicePrevio]!.x + t * (a[i]!.x - a[indicePrevio]!.x)),
          y: r2(a[indicePrevio]!.y + t * (a[i]!.y - a[indicePrevio]!.y)),
        });
      } else {
        // Estuvieron pegadas un rato y salieron por el otro lado: se marca
        // el medio de esa zona, que es donde se ve el cambio.
        const medio = Math.floor((indicePrevio + i) / 2);
        salida.push({ x: r2(a[medio]!.x), y: r2(a[medio]!.y) });
      }
    }

    signoPrevio = signo;
    indicePrevio = i;
  }

  return salida;
}

/**
 * El indice del punto mas cercano a una X. Es lo que hace que la linea guia
 * del cursor se pegue a un mes en vez de flotar entre dos.
 */
export function indiceMasCercano(puntos: readonly Punto[], x: number): number {
  if (puntos.length === 0) return -1;

  let mejor = 0;
  let distancia = Math.abs(puntos[0]!.x - x);
  for (let i = 1; i < puntos.length; i += 1) {
    const d = Math.abs(puntos[i]!.x - x);
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  }
  return mejor;
}

/**
 * Que posiciones del eje X llevan etiqueta.
 *
 * El ultimo punto siempre lleva, porque es el mes que la persona esta
 * mirando. Si al ponerlo queda pegado al anterior etiquetado, se saca ese
 * otro: con 12 meses y paso 2 quedaban "sep 2026" y "oct 2026" encimados.
 */
export function posicionesEtiquetadas(cantidad: number, maximo = 8): number[] {
  if (cantidad <= 0) return [];
  if (cantidad === 1) return [0];

  const paso = Math.max(1, Math.ceil(cantidad / Math.max(1, maximo)));
  const ultimo = cantidad - 1;

  const salida: number[] = [];
  for (let i = 0; i < cantidad; i += paso) salida.push(i);

  while (salida.length > 1 && ultimo - (salida.at(-1) as number) < paso) salida.pop();
  if (!salida.includes(ultimo)) salida.push(ultimo);

  return salida;
}
