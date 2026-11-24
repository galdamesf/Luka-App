import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Adjunto, Comprobante } from "@/dominio/comprobantes/tipos";

/**
 * Los ejemplos de comprobantes de las pruebas. Tienen la forma de los correos
 * reales de cada banco y tienda, pero todos los datos son inventados: nombres,
 * RUT, cuentas, montos y fechas. Nunca pegar aqui un correo real sin cambiar
 * sus datos.
 *
 * Cada archivo trae encabezados, una linea en blanco y el cuerpo tal como lo
 * entrega el buzon (HTML o texto):
 *
 *   De: Santander <mensajeria@santander.cl>
 *   Reenviado-por: camila@ejemplo.cl
 *   Asunto: Comprobante Transferencia de fondos
 *   Recibido: 2026-11-18T23:41:17Z
 *   Adjunto: boleta.pdf | application/pdf | boleta-digital.pdf.txt
 *
 * En "Adjunto", lo tercero es el archivo con el texto del adjunto (lo que el
 * buzon saca del PDF), o "-" si no trae texto, como una cartola con clave.
 */

const CARPETA = dirname(fileURLToPath(import.meta.url));

/** Quien reenvia, si el ejemplo no lo dice. */
export const REENVIA_POR_OMISION = "camila@ejemplo.cl";

export function cargarEjemplo(ruta: string): Comprobante {
  const contenido = readFileSync(join(CARPETA, ruta), "utf8").replace(/\r\n/g, "\n");
  const corte = contenido.indexOf("\n\n");
  if (corte === -1) throw new Error(`El ejemplo ${ruta} no tiene la linea en blanco despues de los encabezados.`);

  const encabezados = new Map<string, string>();
  const adjuntos: Adjunto[] = [];
  for (const linea of contenido.slice(0, corte).split("\n")) {
    const dos = linea.indexOf(":");
    if (dos === -1) throw new Error(`Encabezado sin ":" en ${ruta}: ${linea}`);
    const clave = linea.slice(0, dos).trim().toLowerCase();
    const valor = linea.slice(dos + 1).trim();
    if (clave === "adjunto") {
      const [nombre = "", tipo = "", archivo = "-"] = valor.split("|").map((parte) => parte.trim());
      const carpeta = dirname(ruta);
      adjuntos.push({
        nombre,
        tipo,
        ...(archivo === "-" ? {} : { texto: readFileSync(join(CARPETA, carpeta, archivo), "utf8") }),
      });
    } else {
      encabezados.set(clave, valor);
    }
  }

  const de = encabezados.get("de");
  const recibido = encabezados.get("recibido");
  if (!de || !recibido) throw new Error(`Al ejemplo ${ruta} le falta "De" o "Recibido".`);

  return {
    remitente: de,
    reenviadoPor: encabezados.get("reenviado-por") ?? REENVIA_POR_OMISION,
    asunto: encabezados.get("asunto") ?? "",
    recibido: new Date(recibido),
    texto: contenido.slice(corte + 2),
    ...(adjuntos.length > 0 ? { adjuntos } : {}),
  };
}

/** Una respuesta de la API guardada en tests/fixtures/comprobantes/ia. */
export function cargarRespuesta(nombre: string): unknown {
  return JSON.parse(readFileSync(join(CARPETA, "ia", nombre), "utf8"));
}
