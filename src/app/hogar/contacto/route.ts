import { leerHogarActual } from "@/lib/hogar-actual";
import { leerMiBuzon } from "@/datos/buzon";
import { configuracionDelBuzon } from "@/lib/buzon";
import { ARCHIVO_DEL_CONTACTO, tarjetaDeContacto } from "@/dominio/contacto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El contacto «Luka» con la direccion de Luka de quien lo pide: /hogar/contacto.
 * En el celular se abre en los contactos y se guarda con un toque.
 *
 * La direccion es solo de esa persona: se vuelve a revisar aqui, contra la
 * base, que siga en su hogar.
 */
export async function GET() {
  const hogar = await leerHogarActual();
  if (hogar === null) return new Response("Necesitas iniciar sesión.", { status: 401 });

  const configuracion = configuracionDelBuzon();
  if (configuracion === null) return new Response("El buzón de Luka todavía no está configurado.", { status: 404 });

  const { direccion } = await leerMiBuzon(hogar.hogarId, hogar.miembroId, { base: configuracion.direccion, cuantas: 0 });
  return new Response(tarjetaDeContacto(direccion), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ARCHIVO_DEL_CONTACTO}"`,
      "Cache-Control": "no-store",
    },
  });
}
