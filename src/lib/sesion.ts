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
 *     En la nube la marca nace con cada build: cada despliegue de Luka cierra
 *     las sesiones abiertas.
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

/**
 * El hogar que lleva la sesion: con que hogar entro, como que miembro y con
 * que rol. Se guarda en el token al entrar con Google (src/auth.ts).
 */
export type HogarDeSesion = {
  hogarId: string;
  miembroId: string;
  rol: "DUENO" | "MIEMBRO";
};

/**
 * Lee el hogar del token. null si falta o viene a medias: un token de antes
 * de los hogares no trae hogar y tiene que quedar afuera, no romper.
 */
export function hogarDelToken(token: Record<string, unknown>): HogarDeSesion | null {
  const { hogarId, miembroId, rol } = token;
  if (typeof hogarId !== "string" || hogarId === "") return null;
  if (typeof miembroId !== "string" || miembroId === "") return null;
  if (rol !== "DUENO" && rol !== "MIEMBRO") return null;
  return { hogarId, miembroId, rol };
}

/**
 * El id de la sesion, que nace al entrar con Google (src/lib/ingreso.ts): 32
 * caracteres hexadecimales al azar. Con el se anota que la sesion ya hizo el
 * segundo paso (src/datos/dos-pasos.ts). null si falta o tiene otra forma.
 */
export function sesionDelToken(token: Record<string, unknown>): string | null {
  const { sesionId } = token;
  return typeof sesionId === "string" && /^[0-9a-f]{32}$/.test(sesionId) ? sesionId : null;
}

/** sesionVigente, y ademas con un hogar: sin hogar no hay nada que mostrar. */
export function tokenVigente(
  token: Record<string, unknown>,
  ahora: number,
  arranqueActual: string,
): boolean {
  return sesionVigente(token, ahora, arranqueActual) && hogarDelToken(token) !== null;
}

/**
 * Si lo que dice la sesion sigue siendo cierto en la base: la persona sigue
 * siendo ese miembro de ese hogar. Si la sacaron, o la sacaron y la invitaron
 * a otro hogar, ya no coincide y la sesion se termina.
 */
export function mismoHogar(
  sesion: HogarDeSesion | null,
  enLaBase: HogarDeSesion | null,
): boolean {
  if (sesion === null || enLaBase === null) return false;
  return sesion.hogarId === enLaBase.hogarId && sesion.miembroId === enLaBase.miembroId;
}
