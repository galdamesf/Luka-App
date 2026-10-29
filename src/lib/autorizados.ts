/**
 * La lista de correos que pueden entrar a Luka.
 *
 * Viene de CORREOS_AUTORIZADOS en el .env: correos separados por coma. La
 * comparacion ignora mayusculas y espacios, porque Google a veces entrega el
 * correo con otra capitalizacion y un espacio de mas en el .env no puede
 * dejar a Fernando afuera de su propia app.
 *
 * Con la lista vacia NO entra nadie: una app de plata con la puerta abierta
 * por un .env a medio escribir seria peor que una que te pide configurarla.
 */
export function correosAutorizados(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

export function estaAutorizado(
  correo: string | null | undefined,
  lista: string[],
): boolean {
  if (!correo) return false;
  return lista.includes(correo.trim().toLowerCase());
}
