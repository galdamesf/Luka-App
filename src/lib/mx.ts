import { resolveMx } from "node:dns/promises";

/**
 * Los servidores que reciben el correo de un dominio (sus registros MX). Con
 * ellos Luka reconoce Google Workspace o Microsoft 365 detras de un dominio
 * propio, para mostrar los pasos que sirven (src/dominio/correos-registrados.ts).
 *
 * Si el DNS no contesta a tiempo o el dominio no tiene MX, devuelve una
 * lista vacia: se muestran los pasos generales, que sirven igual.
 */
export async function servidoresDeCorreo(dominio: string, milisegundos = 3_000): Promise<string[]> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    const plazo = new Promise<string[]>((resolver) => {
      reloj = setTimeout(() => resolver([]), milisegundos);
    });
    const consulta = resolveMx(dominio).then((registros) =>
      [...registros].sort((a, b) => a.priority - b.priority).map((registro) => registro.exchange.toLowerCase()),
    );
    return await Promise.race([consulta, plazo]);
  } catch {
    return [];
  } finally {
    if (reloj !== undefined) clearTimeout(reloj);
  }
}

/** Lo que busca los MX. Los tests le pasan uno propio, sin red. */
export type BuscarServidores = (dominio: string) => Promise<string[]>;
