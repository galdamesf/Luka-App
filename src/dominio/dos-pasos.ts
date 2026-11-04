import type { EstadoFormulario } from "./formulario";

/**
 * Las reglas de la verificacion en dos pasos, sin base de datos ni
 * criptografia: cuanto dura un codigo, cuantos intentos hay, en que estado
 * esta quien entra y como se escriben los codigos. La criptografia (TOTP,
 * cifrado, huellas) esta en src/lib/dos-pasos.ts y lo que toca la base en
 * src/datos/dos-pasos.ts.
 *
 * Entrar a Luka son dos pasos, para todos los miembros:
 *  1. Google: dice quien eres.
 *  2. Un codigo de 6 digitos de la app de autenticacion de tu celular (Google
 *     Authenticator u otra): prueba que tienes tu celular. Si lo perdiste,
 *     sirve uno de los codigos de respaldo, una vez cada uno.
 * Sin el paso 2 no se ve nada: ni paginas, ni boletas, ni el PDF semanal.
 */

export const DOS_PASOS = {
  /** Digitos del codigo de la app (lo estandar: Google Authenticator usa 6). */
  digitos: 6,
  /** Cada cuanto cambia el codigo de la app. */
  segundosPorPaso: 30,
  /**
   * Cuantos pasos se aceptan antes y despues del actual: el reloj del
   * celular puede ir un poco corrido, y escribir el codigo toma unos segundos.
   */
  tolerancia: 1,
  /** Intentos fallidos seguidos antes de bloquear. */
  intentos: 5,
  /** Cuanto dura el bloqueo. */
  minutosDeBloqueo: 15,
  /** Cuantos codigos de respaldo se entregan cada vez. */
  codigosDeRespaldo: 10,
  /** Caracteres de cada codigo de respaldo, sin contar el guion. */
  largoDeRespaldo: 10,
} as const;

/**
 * En que punto esta quien abre Luka:
 * - "sin-sesion": no entro con Google, o ya no es parte del hogar.
 * - "configurar": entro con Google pero todavia no tiene la app configurada.
 * - "verificar": tiene la app, y en esta sesion todavia no puso el codigo.
 * - "listo": hizo los dos pasos. Recien aqui se ve el hogar.
 */
export type EstadoDeAcceso = "sin-sesion" | "configurar" | "verificar" | "listo";

export function estadoDeAcceso({
  conHogar,
  appConfigurada,
  sesionVerificada,
}: {
  conHogar: boolean;
  appConfigurada: boolean;
  sesionVerificada: boolean;
}): EstadoDeAcceso {
  if (!conHogar) return "sin-sesion";
  // Sin app no hay nada que verificar: primero se configura, aunque la sesion
  // ya estuviera verificada (por ejemplo, al pasar la app a otro celular).
  if (!appConfigurada) return "configurar";
  return sesionVerificada ? "listo" : "verificar";
}

/** Adonde va cada estado que no es "listo". */
export const RUTA_VERIFICAR = "/verificacion";
export const RUTA_CONFIGURAR = "/verificacion/configurar";

/* ---------------------------------------------------------------------------
   Intentos y bloqueo
   --------------------------------------------------------------------------- */

export type Intentos = { intentos: number; bloqueadoHasta: Date | null };

/** true mientras dure el bloqueo. */
export function estaBloqueado(bloqueadoHasta: Date | null, ahora: Date): boolean {
  return bloqueadoHasta !== null && bloqueadoHasta.getTime() > ahora.getTime();
}

/**
 * Como quedan los intentos despues de un codigo equivocado: uno mas, y al
 * llegar al limite se bloquea y la cuenta vuelve a cero para despues.
 */
export function trasUnFallo(intentos: number, ahora: Date): Intentos {
  const siguientes = intentos + 1;
  if (siguientes >= DOS_PASOS.intentos) {
    return { intentos: 0, bloqueadoHasta: new Date(ahora.getTime() + DOS_PASOS.minutosDeBloqueo * 60_000) };
  }
  return { intentos: siguientes, bloqueadoHasta: null };
}

/** Cuantos minutos quedan de bloqueo, redondeado hacia arriba (al menos 1). */
export function minutosDeBloqueo(bloqueadoHasta: Date, ahora: Date): number {
  return Math.max(1, Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60_000));
}

/** El mensaje para un codigo equivocado, con lo que queda. */
export function mensajeDeFallo(resultado: Intentos, ahora: Date): string {
  if (resultado.bloqueadoHasta !== null) {
    const minutos = minutosDeBloqueo(resultado.bloqueadoHasta, ahora);
    return `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} y prueba de nuevo.`;
  }
  const quedan = DOS_PASOS.intentos - resultado.intentos;
  return `Ese código no es. Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`}.`;
}

/** El mensaje mientras dura un bloqueo. */
export function mensajeDeBloqueo(bloqueadoHasta: Date, ahora: Date): string {
  const minutos = minutosDeBloqueo(bloqueadoHasta, ahora);
  return `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} y prueba de nuevo.`;
}

/* ---------------------------------------------------------------------------
   Como se escriben los codigos
   --------------------------------------------------------------------------- */

/** El codigo de la app tal como lo escribio la persona, sin espacios. null si no tiene la forma. */
export function limpiarCodigoDeApp(texto: string): string | null {
  const limpio = texto.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${DOS_PASOS.digitos}}$`).test(limpio) ? limpio : null;
}

/**
 * Las letras y numeros de los codigos de respaldo: sin I, O, 0 ni 1, que se
 * confunden al copiarlos a mano. Son 32, asi que cada uno vale 5 bits: un
 * codigo de 10 tiene 50 bits, imposible de adivinar en 5 intentos.
 */
export const ALFABETO_DE_RESPALDO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Un codigo de respaldo tal como lo escribio la persona: en mayusculas, sin
 * espacios ni guiones. null si no tiene la forma.
 */
export function limpiarCodigoDeRespaldo(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/[\s-]/g, "");
  if (limpio.length !== DOS_PASOS.largoDeRespaldo) return null;
  for (const letra of limpio) if (!ALFABETO_DE_RESPALDO.includes(letra)) return null;
  return limpio;
}

/** Como se muestra un codigo de respaldo: ABCDE-FGHJK. */
export function formatearCodigoDeRespaldo(limpio: string): string {
  const mitad = Math.ceil(limpio.length / 2);
  return `${limpio.slice(0, mitad)}-${limpio.slice(mitad)}`;
}

/** La clave de la app para escribirla a mano, de a 4: ABCD EFGH … */
export function agruparClave(clave: string): string {
  return clave.match(/.{1,4}/g)?.join(" ") ?? clave;
}

/**
 * El nombre con que Luka aparece en la app de autenticacion. En tu Mac se
 * llama distinto para no confundir los dos codigos.
 */
export function nombreEnLaApp(entorno: Record<string, string | undefined> = process.env): string {
  return entorno.VERCEL_ENV === "production" ? "Luka" : "Luka (local)";
}

/**
 * El enlace que lleva el codigo QR (el formato de Google Authenticator):
 * otpauth://totp/Luka:tu@correo?secret=…&issuer=Luka
 */
export function enlaceDeLaApp({ emisor, correo, clave }: { emisor: string; correo: string; clave: string }): string {
  const etiqueta = `${encodeURIComponent(emisor)}:${encodeURIComponent(correo)}`;
  // encodeURIComponent y no URLSearchParams: este pone "+" en vez de "%20",
  // y algunas apps lo muestran tal cual («Luka+(local)»).
  const pares: [string, string][] = [
    ["secret", clave],
    ["issuer", emisor],
    ["algorithm", "SHA1"],
    ["digits", String(DOS_PASOS.digitos)],
    ["period", String(DOS_PASOS.segundosPorPaso)],
  ];
  const parametros = pares.map(([nombre, valor]) => `${nombre}=${encodeURIComponent(valor)}`).join("&");
  return `otpauth://totp/${etiqueta}?${parametros}`;
}

/* ---------------------------------------------------------------------------
   Lo que devuelven las acciones que entregan codigos de respaldo
   --------------------------------------------------------------------------- */

/**
 * El estado de un formulario que, si sale bien, entrega codigos de respaldo
 * para mostrarlos una sola vez (al configurar la app o al pedir nuevos).
 */
export type EstadoConCodigos = EstadoFormulario & { codigos: string[] | null };

export const ESTADO_CON_CODIGOS: EstadoConCodigos = { ok: false, mensaje: null, errores: {}, codigos: null };
