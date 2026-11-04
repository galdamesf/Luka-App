import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { miembroDeSesion } from "@/datos/hogares";
import { mismoHogar, type HogarDeSesion } from "@/lib/sesion";

/** Adonde se manda a quien ya no es parte del hogar con que entro. */
export const RUTA_SESION_TERMINADA = "/sesion/terminada";

/**
 * El hogar de quien esta mirando, revisado contra la base en cada visita.
 *
 * La cookie dice con que hogar se entro; la base dice si eso sigue siendo
 * cierto. Si a la persona la sacaron del hogar, aqui deja de coincidir y la
 * sesion se termina en su siguiente clic, sin esperar a que venza sola.
 *
 * Devuelve el rol de la base, no el de la cookie: si el dueno le cambia el
 * rol a alguien, vale desde ese momento.
 *
 * null si no hay sesion o si ya no coincide. `cache` hace que varias lecturas
 * en la misma pagina pregunten a la base una sola vez.
 */
export const leerHogarActual = cache(async (): Promise<HogarDeSesion | null> => {
  const sesion = await auth();
  const delToken = sesion?.hogar ?? null;
  if (delToken === null) return null;

  const enLaBase = await miembroDeSesion(sesion?.user?.email);
  return mismoHogar(delToken, enLaBase) ? enLaBase : null;
});

/**
 * Para las paginas: el hogar de quien mira, o fuera. Sin hogar vigente, la
 * sesion se cierra (RUTA_SESION_TERMINADA) y vuelve a la pantalla de ingreso.
 */
export async function hogarActual(): Promise<HogarDeSesion> {
  const hogar = await leerHogarActual();
  if (hogar === null) redirect(RUTA_SESION_TERMINADA);
  return hogar;
}
