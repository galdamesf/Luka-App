import { guardarBoletaDelHogar } from "./almacen-boletas";

/**
 * Saca la foto de la boleta de un formulario (el campo "boleta") y la guarda
 * en el almacen, en el hogar de quien la sube, si vino alguna. Devuelve el nombre del archivo,
 * null si no se adjunto nada, o el motivo del rechazo.
 *
 * Vive aqui y no en un archivo de acciones: un archivo "use server" publica
 * cada funcion que exporta como accion llamable desde el navegador, y esta no
 * debe serlo.
 */
export async function boletaDelFormulario(
  hogarId: string,
  datos: FormData,
): Promise<{ archivo: string | null } | { error: string }> {
  const adjunto = datos.get("boleta");

  if (adjunto === null || typeof adjunto === "string") return { archivo: null };
  if (adjunto.size === 0) return { archivo: null };

  const guardado = await guardarBoletaDelHogar(adjunto, hogarId);
  return guardado.ok ? { archivo: guardado.archivo } : { error: guardado.motivo };
}
