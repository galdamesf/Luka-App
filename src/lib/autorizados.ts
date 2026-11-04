import type { ReglasDeEntrada } from "@/dominio/entrada";

/**
 * La lista de correos de CORREOS_AUTORIZADOS en el .env, separados por coma.
 *
 * Solo cuenta el primero: entra como dueno de «Mi hogar» (el de los datos que
 * ya existian) la primera vez, mientras ese hogar no tenga dueno. Despues, a
 * los demas se los invita desde la pagina Hogar (ver src/dominio/entrada.ts).
 * La comparacion ignora mayusculas y espacios, porque Google a veces entrega
 * el correo con otra capitalizacion y un espacio de mas en el .env no puede
 * dejar a Fernando afuera de su propia app.
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
 * Abierta: cada pagina, cada accion y cada boleta leen y escriben solo en el
 * hogar de quien mira (lo prueban tests/unit/puertas.test.ts y los tests de
 * tests/db), asi que alguien nuevo parte con un hogar vacio y no ve nada de
 * nadie. Quien tiene una invitacion entra al hogar que lo invito.
 *
 * Es una constante y no una variable del .env a proposito: abrir o cerrar la
 * puerta de una app de plata es un cambio de codigo, con su commit, no una
 * linea que se escribe a medias.
 */
export const PUERTA_ABIERTA = true;

/** Las reglas con que se decide la entrada (ver src/dominio/entrada.ts). */
export function reglasDeEntrada(
  entorno: Record<string, string | undefined> = process.env,
): ReglasDeEntrada {
  return {
    listaDeAntes: correosAutorizados(entorno.CORREOS_AUTORIZADOS),
    puertaAbierta: PUERTA_ABIERTA,
  };
}
