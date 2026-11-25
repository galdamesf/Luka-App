import { esEnlaceParaDarElPermiso } from "@/dominio/buzon";

/**
 * Da el permiso que pide Gmail para reenviarle a Luka: abre el enlace de la
 * confirmacion, como lo haria la persona. Lo llama src/datos/buzon.ts solo
 * cuando lo pidio un correo confirmado de esa persona.
 *
 * true si Gmail contesto que quedo aceptado. Con cualquier otra cosa (otra
 * pagina, un error, sin respuesta a tiempo) false, y el enlace queda a la
 * vista para que la persona lo abra con un toque.
 */
export async function darPermisoDeGmail(
  enlace: string,
  { buscar = fetch, esperaMs = 10_000 }: { buscar?: typeof fetch; esperaMs?: number } = {},
): Promise<boolean> {
  if (!esEnlaceParaDarElPermiso(enlace)) return false;
  try {
    const respuesta = await buscar(enlace, {
      redirect: "follow",
      headers: { "Accept-Language": "es-CL,es;q=0.9,en;q=0.5" },
      signal: AbortSignal.timeout(esperaMs),
    });
    if (!respuesta.ok) return false;
    const pagina = await respuesta.text();
    return /confirmaci[oó]n exitosa|ahora puede reenviar|confirmation success|can now forward/i.test(pagina);
  } catch {
    return false;
  }
}
