import { PLANTILLAS, leerConPlantillas, type Plantilla } from "@/dominio/plantillas";
import { normalizarComprobante, type ComprobanteNormalizado } from "./normalizar";
import type { Lector, Lectura, LecturaLeida } from "./tipos";
import { pulirComercio } from "./valores";

/**
 * El lector completo, en este orden:
 *
 *   1. Las plantillas: si una calza, lee o descarta, sin IA.
 *   2. Si ninguna calza: una cartola se aparta, y un correo sin montos no es
 *      un comprobante (publicidad, avisos), asi que no se gasta IA en el.
 *   3. La IA, si esta configurada, para lo demas. Tambien cuando una
 *      plantilla calzo pero no encontro lo que esperaba.
 *   4. Sin IA, eso queda como "no se pudo leer", con el motivo.
 *
 * Si la IA falla por algo pasajero (sin red, demasiadas consultas), el error
 * sube tal cual: el buzon deja el correo para el proximo intento en vez de
 * darlo por perdido.
 */

/** La IA recibe el comprobante ya normalizado; los datos personales los borra ella. */
export type LectorNormalizado = (comprobante: ComprobanteNormalizado) => Promise<Lectura>;

export type OpcionesDelLector = {
  /** Por omision, las escritas a mano (src/dominio/plantillas). */
  plantillas?: readonly Plantilla[];
  /** Sin IA, lo que no tenga plantilla queda "no-se-pudo-leer". */
  leerConIA?: LectorNormalizado | null;
};

const ES_PDF = /pdf/i;

/** La cartola o el estado de cuenta del mes, aunque sea de un banco sin plantilla. */
export function pareceCartola(comprobante: ComprobanteNormalizado): boolean {
  const traePdf = comprobante.adjuntos.some((adjunto) => ES_PDF.test(adjunto.tipo) || /\.pdf$/i.test(adjunto.nombre));
  if (!traePdf) return false;
  return (
    /\bcartola\b|\bestado\s+de\s+cuenta\b/i.test(comprobante.asunto) ||
    /\b(?:tu|su)\s+(?:cartola|estado\s+de\s+cuenta)\b/i.test(comprobante.plano.slice(0, 1_500))
  );
}

const ALGUN_MONTO = /(?:\$|\bCLP|\bUSD)\s?\d|\b(?:monto|total|importe)\b\D{0,20}\d/i;

/** Un comprobante siempre trae un monto, en el correo o en un adjunto. */
export function traeMontos(comprobante: ComprobanteNormalizado): boolean {
  return [comprobante.plano, ...comprobante.adjuntos.map((adjunto) => adjunto.plano)].some((texto) =>
    ALGUN_MONTO.test(texto),
  );
}

function terminar(lectura: LecturaLeida, comprobante: ComprobanteNormalizado): LecturaLeida {
  return {
    ...lectura,
    comercio: pulirComercio(lectura.comercio) ?? lectura.comercio,
    fuente: lectura.fuente.slice(0, 80),
    ...(comprobante.reenviadoAMano ? { reenviadoAMano: true as const } : {}),
  };
}

export function crearLector({ plantillas = PLANTILLAS, leerConIA = null }: OpcionesDelLector = {}): Lector {
  return async (comprobante) => {
    const normalizado = normalizarComprobante(comprobante);
    const resultado = leerConPlantillas(normalizado, plantillas);

    if (resultado.estado === "leido") return terminar(resultado.lectura, normalizado);
    if (resultado.estado === "descartado") {
      return { ok: false, motivo: resultado.motivo, detalle: resultado.porque };
    }

    if (resultado.estado === "sin-plantilla") {
      if (pareceCartola(normalizado)) {
        return { ok: false, motivo: "es-cartola", detalle: "Trae un PDF y habla de la cartola o del estado de cuenta." };
      }
      if (!traeMontos(normalizado)) {
        return { ok: false, motivo: "no-es-comprobante", detalle: "No trae ningún monto." };
      }
    }

    if (!leerConIA) {
      return {
        ok: false,
        motivo: "no-se-pudo-leer",
        detalle:
          resultado.estado === "incompleto"
            ? `La plantilla ${resultado.plantilla} no encontró: ${resultado.faltan.join(", ")}.`
            : "Ninguna plantilla sirve y la lectura con IA no está configurada.",
      };
    }

    const lectura = await leerConIA(normalizado);
    return lectura.ok ? terminar(lectura, normalizado) : lectura;
  };
}
