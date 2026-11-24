/**
 * El contacto «Luka» para el celular: con el guardado, reenviar un aviso del
 * banco es escribir «Luka» en «Para», sin acordarse de la direccion.
 */

const DIRECCION = /^[^\s@,;:\\<>"]+@[^\s@,;:\\<>"]+\.[^\s@,;:\\<>"]+$/;

/**
 * La direccion en trozos, para que en el celular se corte despues del «+» y
 * antes de la «@», no en medio de «gmail»: «luka.buzon+» «k7m2x9q4ab» «@gmail.com».
 */
export function trozosDeLaDireccion(direccion: string): string[] {
  const arroba = direccion.lastIndexOf("@");
  const mas = direccion.indexOf("+");
  const cortes = [mas >= 0 && mas < arroba ? mas + 1 : -1, arroba].filter((corte) => corte > 0);
  const trozos: string[] = [];
  let desde = 0;
  for (const corte of cortes) {
    trozos.push(direccion.slice(desde, corte));
    desde = corte;
  }
  trozos.push(direccion.slice(desde));
  return trozos.filter((trozo) => trozo.length > 0);
}

/** El nombre del archivo que se descarga. */
export const ARCHIVO_DEL_CONTACTO = "Luka.vcf";

/**
 * La tarjeta de contacto (vCard 3.0, la que abren los contactos del iPhone,
 * de Android y del Mac) con la direccion de Luka de la persona. Las lineas
 * terminan en CRLF, como pide el formato.
 */
export function tarjetaDeContacto(direccion: string): string {
  const limpia = direccion.trim();
  if (!DIRECCION.test(limpia)) throw new Error("La dirección de Luka no es válida.");
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:;Luka;;;",
    "FN:Luka",
    `EMAIL;TYPE=INTERNET:${limpia}`,
    "NOTE:Reenvíale los avisos de tu banco y Luka anota tus gastos.",
    "END:VCARD",
    "",
  ].join("\r\n");
}
