import type { ReglasDeEntrada } from "@/dominio/entrada";

/**
 * La lista de correos de CORREOS_AUTORIZADOS en el .env, separados por coma.
 *
 * Solo cuenta el primero: entra como dueno de «Mi hogar» (el de los datos que
 * ya existian) la primera vez, mientras ese hogar no tenga dueno. Despues, a
 * los demas se los invita desde la pagina Hogar (ver src/dominio/entrada.ts).
 * La
 * comparacion ignora mayusculas y espacios, porque Google a veces entrega el
 * correo con otra capitalizacion y un espacio de mas en el .env no puede
 * dejar a Fernando afuera de su propia app.
 *
 * Con la lista vacia y la puerta cerrada solo entran los que ya son miembros
 * de un hogar o tienen una invitacion: una app de plata con la puerta abierta
 * por un .env a medio escribir seria peor que una que te pide configurarla.
 */
export function correosAutorizados(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

/**
 * Si cualquiera con Google puede entrar y tener su propio hogar.
 *
 * Cerrada por ahora, a proposito: las paginas todavia leen los datos de todos
 * los hogares, no solo los del que mira. Abrirla antes dejaria a alguien
 * nuevo viendo tus gastos. Se abre cuando cada pagina lea solo lo suyo.
 */
export const PUERTA_ABIERTA = false;

/** Las reglas con que se decide la entrada (ver src/dominio/entrada.ts). */
export function reglasDeEntrada(
  entorno: Record<string, string | undefined> = process.env,
): ReglasDeEntrada {
  return {
    listaDeAntes: correosAutorizados(entorno.CORREOS_AUTORIZADOS),
    puertaAbierta: PUERTA_ABIERTA,
  };
}
