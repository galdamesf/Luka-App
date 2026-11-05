import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accesoDeSesion } from "@/datos/dos-pasos";
import { RUTA_ELEGIR, RUTA_VERIFICAR, estadoDeAcceso, type EstadoDeAcceso } from "@/dominio/dos-pasos";
import { mismoHogar, type HogarDeSesion } from "@/lib/sesion";

/** Adonde se manda a quien ya no es parte del hogar con que entro. */
export const RUTA_SESION_TERMINADA = "/sesion/terminada";

/** Quien esta mirando y en que paso va. */
export type Acceso = {
  estado: EstadoDeAcceso;
  /** El hogar segun la base. null si no hay sesion o ya no coincide. */
  hogar: HogarDeSesion | null;
  sesionId: string | null;
  correo: string | null;
  /** Si tiene la verificacion en dos pasos activa (la app configurada). */
  appConfigurada: boolean;
};

const SIN_SESION: Acceso = { estado: "sin-sesion", hogar: null, sesionId: null, correo: null, appConfigurada: false };

/**
 * Quien esta mirando, revisado contra la base en cada visita: si sigue siendo
 * miembro del hogar con que entro, si ya eligio si usar la verificacion en
 * dos pasos, si tiene la app configurada y si esta sesion ya puso el codigo
 * (src/dominio/dos-pasos.ts).
 *
 * La cookie dice con que hogar se entro; la base dice si eso sigue siendo
 * cierto. Si a la persona la sacaron del hogar, aqui deja de coincidir y la
 * sesion se termina en su siguiente clic, sin esperar a que venza sola.
 *
 * Devuelve el rol de la base, no el de la cookie: si el dueno le cambia el
 * rol a alguien, vale desde ese momento.
 *
 * `cache` hace que varias lecturas en la misma pagina pregunten a la base una
 * sola vez.
 */
export const leerAcceso = cache(async (): Promise<Acceso> => {
  const sesion = await auth();
  const delToken = sesion?.hogar ?? null;
  const sesionId = sesion?.sesionId ?? null;
  const correo = sesion?.user?.email ?? null;
  if (delToken === null || sesionId === null) return SIN_SESION;

  const enLaBase = await accesoDeSesion(correo, sesionId);
  const hogar = mismoHogar(delToken, enLaBase.hogar) ? enLaBase.hogar : null;
  const estado = estadoDeAcceso({
    conHogar: hogar !== null,
    appConfigurada: enLaBase.appConfigurada,
    sesionVerificada: enLaBase.sesionVerificada,
    decidio: enLaBase.decidio,
  });
  return { estado, hogar, sesionId, correo, appConfigurada: enLaBase.appConfigurada };
});

/**
 * El hogar de quien mira, solo si ya puede verlo (puso el codigo, o eligio
 * entrar solo con Google). null si no: las rutas con datos (boletas, PDF)
 * responden 401 en vez de redirigir.
 */
export const leerHogarActual = cache(async (): Promise<HogarDeSesion | null> => {
  const acceso = await leerAcceso();
  return acceso.estado === "listo" ? acceso.hogar : null;
});

/**
 * Para las paginas y las acciones: el hogar de quien mira, o fuera.
 * - Sin hogar vigente, la sesion se cierra (RUTA_SESION_TERMINADA).
 * - Si todavia no elige si usar la verificacion, a la pregunta.
 * - Con la app activa y sin el codigo de esta sesion, a ponerlo.
 */
export async function hogarActual(): Promise<HogarDeSesion> {
  const acceso = await leerAcceso();
  if (acceso.estado === "elegir") redirect(RUTA_ELEGIR);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.estado !== "listo" || acceso.hogar === null) redirect(RUTA_SESION_TERMINADA);
  return acceso.hogar;
}
