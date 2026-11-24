/**
 * La configuracion del buzon de Luka. Va aparte del IMAP (src/lib/buzon-imap.ts)
 * para que las paginas que solo muestran la direccion no carguen el cliente
 * de IMAP. Que se hace con cada correo esta en src/datos/buzon.ts.
 *
 * Para partir, el buzon es el Gmail de Luka: la misma cuenta y la misma
 * contrasena de aplicacion con que ya manda los codigos (CORREO_SMTP_*).
 * Cada persona tiene su direccion con «+clave», asi que todo llega a la
 * misma bandeja.
 *
 * Solo se tocan los correos que van a una direccion con clave: el resto del
 * correo de Luka (lo que le escriben a soporte) queda como esta, sin leer.
 */

export type ConfiguracionDelBuzon = {
  /** La direccion del buzon, sin clave: luka.support.app@gmail.com. */
  direccion: string;
  servidor: string;
  puerto: number;
  usuario: string;
  clave: string;
};

/**
 * La configuracion del .env, o null si falta el correo o la clave. Por
 * omision, la del correo con que Luka manda los codigos, en el IMAP de
 * Gmail. BUZON_* es para otro buzon.
 */
export function configuracionDelBuzon(
  entorno: Record<string, string | undefined> = process.env,
): ConfiguracionDelBuzon | null {
  const usuario = (entorno.BUZON_USUARIO?.trim() || entorno.CORREO_SMTP_USUARIO?.trim()) ?? "";
  // Google muestra la contrasena de aplicacion en grupos de cuatro.
  const clave = (entorno.BUZON_CLAVE || entorno.CORREO_SMTP_CLAVE || "").replace(/\s+/g, "");
  if (!usuario || !clave) return null;
  const direccion = (entorno.BUZON_DIRECCION?.trim() || usuario).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(direccion)) return null;

  const puerto = Number(entorno.BUZON_PUERTO?.trim() || 993);
  return {
    direccion,
    servidor: entorno.BUZON_SERVIDOR?.trim() || "imap.gmail.com",
    puerto: Number.isInteger(puerto) && puerto > 0 && puerto < 65536 ? puerto : 993,
    usuario,
    clave,
  };
}
