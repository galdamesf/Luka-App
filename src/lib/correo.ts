import { createTransport } from "nodemailer";

/**
 * Mandar correos desde Luka, por SMTP. Por ahora, solo el codigo para borrar
 * un hogar.
 *
 * Se configura en el .env (ver .env.example). Con Gmail basta el correo y una
 * «contrasena de aplicacion»; el servidor y el puerto ya vienen puestos. Sin
 * configurar, Luka no manda correos, y lo que los necesita lo dice en la
 * pantalla en vez de fallar callado.
 */

export type Correo = { para: string; asunto: string; texto: string; html: string };

/** Lo que manda un correo. Los tests le pasan uno propio que no sale a internet. */
export type EnviarCorreo = (correo: Correo) => Promise<void>;

export type ConfiguracionDeCorreo = {
  servidor: string;
  puerto: number;
  usuario: string;
  clave: string;
};

/** La configuracion del .env, o null si falta el correo o la clave. */
export function configuracionDeCorreo(
  entorno: Record<string, string | undefined> = process.env,
): ConfiguracionDeCorreo | null {
  const usuario = entorno.CORREO_SMTP_USUARIO?.trim();
  // Google muestra la contrasena de aplicacion en grupos de cuatro: se
  // aceptan con o sin espacios.
  const clave = entorno.CORREO_SMTP_CLAVE?.replace(/\s+/g, "");
  if (!usuario || !clave) return null;

  const puerto = Number(entorno.CORREO_SMTP_PUERTO?.trim() || 465);
  return {
    servidor: entorno.CORREO_SMTP_SERVIDOR?.trim() || "smtp.gmail.com",
    puerto: Number.isInteger(puerto) && puerto > 0 && puerto < 65536 ? puerto : 465,
    usuario,
    clave,
  };
}

/**
 * Un EnviarCorreo por SMTP. El 465 va cifrado desde el saludo; cualquier
 * otro puerto (587) sube a cifrado con STARTTLS si el servidor lo ofrece.
 * Desde el correo configurado y con el nombre «Luka».
 */
export function enviarPorSmtp(config: ConfiguracionDeCorreo): EnviarCorreo {
  const transporte = createTransport({
    host: config.servidor,
    port: config.puerto,
    secure: config.puerto === 465,
    auth: { user: config.usuario, pass: config.clave },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return async ({ para, asunto, texto, html }) => {
    await transporte.sendMail({
      from: { name: "Luka", address: config.usuario },
      to: para,
      subject: asunto,
      text: texto,
      html,
    });
  };
}

/** El EnviarCorreo del .env, o null si no esta configurado. */
export function enviarCorreoDelEntorno(
  entorno: Record<string, string | undefined> = process.env,
): EnviarCorreo | null {
  const config = configuracionDeCorreo(entorno);
  return config === null ? null : enviarPorSmtp(config);
}
