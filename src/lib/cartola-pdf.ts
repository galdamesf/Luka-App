import { getDocumentProxy } from "unpdf";
import type { PaginaDeCartola, PiezaDeTexto } from "@/dominio/cartolas/tipos";

/**
 * Abrir la cartola en PDF del banco y sacar su texto con la posicion de cada
 * pedazo. Los bancos mandan la cartola con clave (Santander: el RUT sin
 * digito verificador; Consorcio: sus ultimos 4 digitos), y el texto viene en
 * columnas: para saber que monto va con que glosa hace falta saber donde esta
 * cada pedazo en la pagina, no solo el texto corrido.
 */

export type { PaginaDeCartola, PiezaDeTexto } from "@/dominio/cartolas/tipos";

export type PdfDeCartola =
  | { ok: true; paginas: PaginaDeCartola[] }
  | { ok: false; motivo: "falta-la-clave" | "clave-incorrecta" | "no-se-pudo-abrir" | "muy-grande" };

/** Ninguna cartola se acerca a esto; un PDF mas grande no es una cartola. */
export const MAXIMO_DE_LA_CARTOLA = 8 * 1024 * 1024;

const PAGINAS_MAXIMAS = 60;

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function abrirCartola(datos: Uint8Array, clave?: string): Promise<PdfDeCartola> {
  if (datos.byteLength > MAXIMO_DE_LA_CARTOLA) return { ok: false, motivo: "muy-grande" };
  let pdf;
  try {
    // pdf.js se queda con el buffer: le pasamos una copia.
    pdf = await getDocumentProxy(datos.slice(), clave ? { password: clave } : {});
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      const codigo = (error as Error & { code?: number }).code;
      return { ok: false, motivo: codigo === 2 ? "clave-incorrecta" : "falta-la-clave" };
    }
    return { ok: false, motivo: "no-se-pudo-abrir" };
  }

  try {
    const paginas: PaginaDeCartola[] = [];
    for (let numero = 1; numero <= Math.min(pdf.numPages, PAGINAS_MAXIMAS); numero++) {
      const pagina = await pdf.getPage(numero);
      const ancho = pagina.view[2] ?? 0;
      const alto = pagina.view[3] ?? 0;
      const contenido = await pagina.getTextContent();
      const piezas: PiezaDeTexto[] = [];
      for (const item of contenido.items) {
        if (!("str" in item)) continue;
        const texto = item.str.replace(/\s+/g, " ").trim();
        if (!texto) continue;
        piezas.push({
          x: redondear(item.transform[4]),
          y: redondear(item.transform[5]),
          ancho: redondear(item.width),
          alto: redondear(item.height || Math.abs(item.transform[3])),
          texto,
        });
      }
      paginas.push({ numero, ancho: redondear(ancho), alto: redondear(alto), piezas });
    }
    return { ok: true, paginas };
  } catch {
    return { ok: false, motivo: "no-se-pudo-abrir" };
  }
}
