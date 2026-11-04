import type { Metadata } from "next";
import { DocumentoLegal } from "@/componentes/legal/DocumentoLegal";
import { TERMINOS } from "@/dominio/legal";

export const metadata: Metadata = {
  title: "Términos de uso · Luka",
  description: "Las reglas para usar Luka, en simple.",
};

/** Los terminos de uso: publicos, con o sin sesion (el middleware los deja pasar siempre). */
export default function Terminos() {
  return <DocumentoLegal documento={TERMINOS} otro="privacidad" />;
}
