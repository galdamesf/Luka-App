import type { Metadata } from "next";
import { DocumentoLegal } from "@/componentes/legal/DocumentoLegal";
import { PRIVACIDAD } from "@/dominio/legal";

export const metadata: Metadata = {
  title: "Política de privacidad · Luka",
  description: "Qué datos guarda Luka, para qué, dónde, quién los ve y cómo borrarlos.",
};

/**
 * La politica de privacidad: publica, con o sin sesion (el middleware la deja
 * pasar siempre). Google la pide para publicar el ingreso con Google.
 */
export default function Privacidad() {
  return <DocumentoLegal documento={PRIVACIDAD} otro="terminos" />;
}
