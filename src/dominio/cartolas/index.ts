import { BANCOS } from "@/dominio/bancos";
import { armarLineas, compacto } from "./lineas";
import { esCartolaConsorcio, leerCartolaConsorcio } from "./consorcio";
import { esCartolaSantander, leerCartolaSantander } from "./santander";
import type { LecturaDeCartola, PaginaDeCartola } from "./tipos";

export { cuadrar, type Cuadre } from "./cuadrar";
export { claveDeLaCartola, clavesDeLasFilas, FUENTE_DE_LA_CARTOLA, lecturaDeLaFila } from "./filas";
export type * from "./tipos";

/**
 * Las cartolas que Luka sabe leer, una plantilla por banco. Para agregar
 * otro banco: su plantilla en esta carpeta, con una cartola de ejemplo con
 * datos inventados en los tests, y su nombre aqui.
 */
const PLANTILLAS = [
  {
    banco: "Santander",
    // Lo que dice el correo de Santander: "Usa como contraseña tu RUT sin guión ni dígito verificador".
    pista: "tu RUT sin puntos, sin guión y sin el dígito verificador",
    es: esCartolaSantander,
    leer: leerCartolaSantander,
  },
  {
    banco: "Consorcio",
    // Lo que dice el correo de Consorcio: "ingresa los últimos 4 dígitos del RUT sin dígito verificador".
    // Del titular: la cuenta puede ser de otra persona del hogar, y es su RUT el que abre el PDF.
    pista: "el RUT del titular de la cuenta, pero solo sus últimos 4 dígitos y sin el dígito verificador",
    es: esCartolaConsorcio,
    leer: leerCartolaConsorcio,
  },
] as const;

/** Los bancos cuyas cartolas Luka sabe leer, como se llaman en el catalogo. */
export const BANCOS_CON_CARTOLA: readonly string[] = PLANTILLAS.map((p) => p.banco);

/** Cual es la clave del PDF de cada banco, como lo dice su correo. */
export const PISTA_DE_LA_CLAVE: Readonly<Record<string, string>> = Object.fromEntries(PLANTILLAS.map((p) => [p.banco, p.pista]));

/** El banco que parece haber hecho este PDF, por lo que dice arriba, o null. */
function bancoQueParece(paginas: readonly PaginaDeCartola[]): string | null {
  const primera = paginas[0];
  if (!primera) return null;
  const arriba = compacto(armarLineas(primera).slice(0, 20).map((l) => l.texto).join(" "));
  for (const banco of BANCOS) {
    const nombres = [banco.nombre, ...(banco.otrosNombres ?? [])].map(compacto);
    if (nombres.some((nombre) => nombre.length >= 4 && arriba.includes(nombre))) return banco.nombre;
  }
  return null;
}

/** Lee la cartola con la plantilla de su banco. */
export function leerCartola(paginas: readonly PaginaDeCartola[]): LecturaDeCartola {
  const plantilla = PLANTILLAS.find((p) => p.es(paginas));
  if (plantilla) return plantilla.leer(paginas);
  const banco = bancoQueParece(paginas);
  return {
    ok: false,
    motivo: "formato-desconocido",
    banco,
    detalle: banco
      ? BANCOS_CON_CARTOLA.includes(banco)
        ? `Esta cartola de ${banco} viene en un formato que Luka todavía no conoce.`
        : `Luka todavía no sabe leer las cartolas de ${banco}.`
      : "No parece la cartola de ningún banco que Luka sepa leer.",
  };
}
