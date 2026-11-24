import { timingSafeEqual } from "node:crypto";

/**
 * Lo que Luka hace sola, sin que nadie apriete un boton: revisar el buzon al
 * abrir el panel y la tarea programada de cada mañana (revisar el buzon y
 * mandar el resumen diario). Aqui solo lo que se decide con el entorno.
 */

type Entorno = Record<string, string | undefined>;

/**
 * Si Luka revisa el buzon sola. En Vercel si; en tu computador no, salvo con
 * BUZON_AUTOMATICO=1: el buzon es uno solo, y si la app de tu computador y
 * la de la nube lo revisaran a la vez, el primero que lee un correo se lo
 * lleva a su base. Con BUZON_AUTOMATICO=0 no se revisa solo en ninguna
 * parte.
 */
export function revisionAutomatica(entorno: Entorno = process.env): boolean {
  const valor = entorno.BUZON_AUTOMATICO?.trim().toLowerCase();
  if (valor === "1" || valor === "si" || valor === "true") return true;
  if (valor === "0" || valor === "no" || valor === "false") return false;
  return entorno.VERCEL === "1";
}

/**
 * La direccion de Luka para los enlaces de los correos: LUKA_URL si esta, si
 * no el dominio de produccion que Vercel le da al proyecto, y en tu
 * computador, localhost.
 */
export function urlDeLuka(entorno: Entorno = process.env): string {
  const propia = entorno.LUKA_URL?.trim();
  if (propia) return propia.replace(/\/+$/, "");
  const deVercel = entorno.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (deVercel) return `https://${deVercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/**
 * Si la peticion trae el secreto de las tareas programadas. Vercel lo manda
 * solo, como «Authorization: Bearer <CRON_SECRET>», cuando CRON_SECRET esta
 * en las variables del proyecto. Sin CRON_SECRET no pasa nadie: la tarea
 * manda correos, y no puede quedar abierta a cualquiera.
 */
export function traeElSecreto(autorizacion: string | null, entorno: Entorno = process.env): boolean {
  const secreto = entorno.CRON_SECRET?.trim();
  if (!secreto || !autorizacion) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(autorizacion.trim());
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
