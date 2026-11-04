import { leerHogarActual } from "@/lib/hogar-actual";
import { almacenDelEntorno } from "@/lib/almacen-boletas";
import { nombreValido, tipoDeBoleta } from "@/lib/boletas";

/**
 * Sirve una foto de boleta desde el almacen (el disco en tu Mac, un Vercel
 * Blob privado en la nube), del hogar de quien mira (boletas/<hogar>/). La
 * boleta de otro hogar responde 404, igual que una que no existe: ni siquiera
 * se confirma que este en algun lado.
 *
 * El nombre pedido se valida contra el patron exacto que generamos al guardar,
 * antes de tocar el sistema de archivos. Cualquier cosa que no calce se
 * rechaza con 400: no hay forma de pedir un archivo de otra carpeta.
 *
 * Y antes que nada, la sesion: el middleware no pasa por aqui (la ruta
 * termina en .jpg o .pdf, y su matcher deja fuera todo lo que tiene
 * extension), asi que la puerta se revisa en la ruta misma, contra la base:
 * sin sesion, o si la persona ya no es parte de su hogar, 401.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const hogar = await leerHogarActual();
  if (hogar === null) {
    return new Response("Necesitas entrar a Luka para ver esta boleta", {
      status: 401,
    });
  }

  const { archivo } = await params;

  if (!nombreValido(archivo)) {
    return new Response("Nombre de archivo no válido", { status: 400 });
  }

  // Solo en el hogar de quien mira: la de otro hogar no existe aqui.
  const bytes = await almacenDelEntorno().leer(hogar.hogarId, archivo);
  if (bytes === null) return new Response("Boleta no encontrada", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": tipoDeBoleta(archivo),
      // El contenido de un nombre dado nunca cambia: el nombre es aleatorio
      // y se genera de nuevo por cada archivo.
      "Cache-Control": "private, max-age=31536000, immutable",
      // Por si acaso: que el navegador no intente adivinar el tipo.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
