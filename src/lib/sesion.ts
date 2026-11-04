/**
 * Las reglas de la sesion de Luka: cuanto dura y cuando deja de valer.
 *
 * Antes la sesion duraba lo que trae next-auth por omision: 30 dias. Por eso
 * al correr `npm run dev` y abrir localhost:3000 se caia directo en el panel,
 * sin pasar por la portada ni por Google. Ahora una sesion se corta con lo
 * primero que pase de estas tres cosas:
 *
 *  1. 30 minutos sin usar la app. Cada pagina que se abre corre el reloj de
 *     nuevo (next-auth vuelve a firmar la cookie), asi que mientras se usa no
 *     se corta. Esto lo aplica next-auth con session.maxAge.
 *  2. 8 horas desde que se entro con Google, aunque se haya usado todo el rato.
 *  3. Un arranque nuevo del servidor: cada `npm run dev` deja sin efecto las
 *     sesiones del arranque anterior. Apagar la terminal es cerrar la puerta.
 *
 * 2 y 3 las decide sesionVigente(), logica pura para poder probarla sin
 * levantar Next. La marca del arranque nace en next.config.ts.
 */

export const MINUTOS_SIN_USO = 30;
export const HORAS_MAXIMAS = 8;

/** Para session.maxAge de next-auth, que va en segundos. */
export const SEGUNDOS_SIN_USO = MINUTOS_SIN_USO * 60;
export const SEGUNDOS_MAXIMOS = HORAS_MAXIMAS * 60 * 60;

/** Lo que Luka le agrega al token de next-auth al entrar con Google. */
export type SelloSesion = {
  /** Segundos Unix del ingreso con Google. */
  iniciada: number;
  /** La marca del arranque del servidor en que se entro (LUKA_ARRANQUE). */
  arranque: string;
};

export function sellarSesion(ahora: number, arranque: string): SelloSesion {
  return { iniciada: ahora, arranque };
}

/**
 * Si un token todavia sirve.
 *
 * Recibe el token tal cual lo guarda next-auth (un objeto cualquiera), porque
 * una cookie de antes de este cambio no trae el sello y tiene que quedar
 * afuera, no romper. Sin marca de arranque no vale ninguna sesion: si
 * next.config.ts dejara de ponerla, la puerta queda cerrada, no abierta.
 */
export function sesionVigente(
  token: Record<string, unknown>,
  ahora: number,
  arranqueActual: string,
): boolean {
  if (arranqueActual === "") return false;
  const { iniciada, arranque } = token;
  if (typeof iniciada !== "number" || typeof arranque !== "string") return false;
  if (arranque !== arranqueActual) return false;
  const edad = ahora - iniciada;
  return edad >= 0 && edad <= SEGUNDOS_MAXIMOS;
}

/** Segundos Unix de ahora, la unidad que usan los JWT. */
export function ahoraEnSegundos(): number {
  return Math.floor(Date.now() / 1000);
}
