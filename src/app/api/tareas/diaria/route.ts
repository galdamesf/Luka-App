import { revisarElBuzon } from "@/datos/buzon";
import { enviarResumenesDiarios } from "@/datos/conectar";
import { configuracionDelBuzon } from "@/lib/buzon";
import { traeElSecreto } from "@/lib/automatico";

/**
 * La tarea de cada mañana (vercel.json): revisa el buzon, por si nadie abrio
 * Luka desde ayer, y despues manda el resumen diario a quien lo quiere.
 *
 * La llama Vercel con «Authorization: Bearer <CRON_SECRET>». Sin CRON_SECRET
 * en las variables del proyecto no corre: manda correos, y no puede quedar
 * abierta a cualquiera. El middleware la deja pasar sin sesion.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(peticion: Request): Promise<Response> {
  if (!process.env.CRON_SECRET?.trim()) {
    return Response.json({ ok: false, error: "Falta CRON_SECRET en las variables del proyecto." }, { status: 503 });
  }
  if (!traeElSecreto(peticion.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  // El buzon primero: asi el resumen ya cuenta lo que llego en la noche.
  let buzon: Awaited<ReturnType<typeof revisarElBuzon>> | { error: string } | null = null;
  if (configuracionDelBuzon() !== null) {
    try {
      buzon = await revisarElBuzon();
    } catch (error) {
      console.error("La tarea diaria no pudo revisar el buzon:", error);
      buzon = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  const resumen = await enviarResumenesDiarios();
  return Response.json({ ok: true, buzon, resumen });
}
