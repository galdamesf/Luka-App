import { ACHICAR_DESDE, LADO_MAXIMO, nombreAchicado } from "@/dominio/tamano-boleta";

/**
 * Achica una foto en el navegador: la vuelve a dibujar como JPG, con el lado
 * mas largo de hasta 2400 px, bajando la calidad hasta que pese menos de 3 MB.
 * Al redibujarla tambien se van sus datos ocultos (la ubicacion del celular,
 * entre otros).
 *
 * Devuelve null si el navegador no la puede abrir (por ejemplo, una foto HEIC
 * fuera de Safari) o si no baja de 3 MB: entonces se sube tal cual, y si pasa
 * del tope el servidor lo dice.
 *
 * Solo corre en el navegador: usa createImageBitmap y un <canvas>.
 */
export async function achicarFoto(archivo: File): Promise<File | null> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (contexto === null) {
    imagen.close();
    return null;
  }
  // Fondo blanco: un PNG con transparencia no queda negro en JPG.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();

  for (const calidad of [0.85, 0.75, 0.65, 0.55]) {
    const jpg = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/jpeg", calidad));
    if (jpg !== null && jpg.size <= ACHICAR_DESDE) {
      return new File([jpg], nombreAchicado(archivo.name), { type: "image/jpeg", lastModified: Date.now() });
    }
  }
  return null;
}
