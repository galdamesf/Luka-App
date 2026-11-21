import { CUOTAS_MAXIMAS, type MedioPago } from "@/dominio/esquemas";
import type { ComprobanteNormalizado } from "@/dominio/comprobantes/normalizar";
import type { Contraparte, LecturaLeida, Sentido, TipoMovimiento } from "@/dominio/comprobantes/tipos";
import {
  fechaEnChile,
  leerFecha,
  leerMedioPago,
  leerMonto,
  pulirComercio,
  ultimosCuatro,
} from "@/dominio/comprobantes/valores";

/**
 * Una plantilla dice como leer un tipo de correo de un remitente, sin IA:
 * rapido, gratis y siempre igual. Las primeras las escribimos a mano; mas
 * adelante Luka aprende las suyas y las guarda con esta misma forma (en la
 * base, los patrones van como texto).
 *
 * Los patrones buscan sobre el texto aplanado, en una sola linea: da lo mismo
 * si el banco armo la tabla con celdas o con saltos de linea. El grupo 1 de
 * cada patron es el valor. Sin la bandera "g": un patron con "g" recuerda
 * donde quedo y la segunda vez falla.
 */

export type DondeBuscar = "texto" | "asunto" | "adjuntos";

export type Campo = {
  patron: RegExp;
  /** Por omision, en el texto del correo. */
  en?: DondeBuscar;
  /** La ultima coincidencia y no la primera: el TOTAL de una boleta va al final. */
  ultima?: boolean;
};

type Condiciones = {
  /** "banco/tipo-de-correo". */
  id: string;
  /** Direcciones exactas, o "@dominio.cl" para el dominio y sus subdominios. */
  remitentes: readonly string[];
  /** Si esta, el asunto tiene que calzar. */
  asunto?: RegExp;
  /** Si esta, el texto del correo o el de algun adjunto tiene que calzar. */
  contiene?: RegExp;
};

export type PlantillaDeLectura = Condiciones & {
  fuente: string;
  tipo: TipoMovimiento;
  sentido: Sentido;
  /** El aviso no dice con quien fue (ver LecturaLeida.sinDetalle). */
  sinDetalle?: true;
  campos: {
    monto: Campo;
    /** Sin este campo vale el dia en que llego el correo. Con el, es obligatorio. */
    fecha?: Campo;
    comercio: Campo | { fijo: string };
    medioPago?: Campo | { fijo: MedioPago };
    ultimos4?: Campo;
    cuotas?: Campo;
    contraparte?: { nombre?: Campo; banco?: Campo; ultimos4?: Campo };
  };
};

/** Correos conocidos que no son comprobantes: se descartan sin gastar IA. */
export type PlantillaDeDescarte = Condiciones & {
  descartar: "no-es-comprobante" | "es-cartola";
  /** Por que, para el registro del buzon. */
  porque: string;
};

export type Plantilla = PlantillaDeLectura | PlantillaDeDescarte;

export type ResultadoDePlantillas =
  | { estado: "leido"; lectura: LecturaLeida }
  | { estado: "descartado"; plantilla: string; motivo: PlantillaDeDescarte["descartar"]; porque: string }
  /** La plantilla calzo pero el correo no trae lo que esperaba: el banco cambio el formato. */
  | { estado: "incompleto"; plantilla: string; faltan: string[] }
  | { estado: "sin-plantilla" };

/** ¿La direccion es de alguno de estos remitentes? "@lider.cl" incluye "info.lider.cl". */
export function calzaRemitente(direccion: string, remitentes: readonly string[]): boolean {
  const correo = direccion.trim().toLowerCase();
  const arroba = correo.lastIndexOf("@");
  if (arroba <= 0) return false;
  const dominio = correo.slice(arroba + 1);

  return remitentes.some((remitente) => {
    const esperado = remitente.trim().toLowerCase();
    if (esperado.startsWith("@")) {
      const base = esperado.slice(1);
      return dominio === base || dominio.endsWith(`.${base}`);
    }
    return correo === esperado;
  });
}

function textos(comprobante: ComprobanteNormalizado, donde: DondeBuscar): string[] {
  if (donde === "asunto") return [comprobante.asunto];
  if (donde === "adjuntos") return comprobante.adjuntos.map((adjunto) => adjunto.plano).filter(Boolean);
  return [comprobante.plano];
}

function calza(plantilla: Plantilla, comprobante: ComprobanteNormalizado): boolean {
  if (!calzaRemitente(comprobante.remitente, plantilla.remitentes)) return false;
  if (plantilla.asunto && !plantilla.asunto.test(comprobante.asunto)) return false;
  if (plantilla.contiene) {
    const donde = [...textos(comprobante, "texto"), ...textos(comprobante, "adjuntos")];
    if (!donde.some((texto) => plantilla.contiene!.test(texto))) return false;
  }
  return true;
}

/** El valor de un campo (el grupo 1), o undefined si no aparece. */
export function sacarCampo(campo: Campo | undefined, comprobante: ComprobanteNormalizado): string | undefined {
  if (!campo) return undefined;
  for (const texto of textos(comprobante, campo.en ?? "texto")) {
    const valor = campo.ultima
      ? [...texto.matchAll(new RegExp(campo.patron.source, `${campo.patron.flags.replace(/[gy]/g, "")}g`))].at(-1)?.[1]
      : campo.patron.exec(texto)?.[1];
    if (valor?.trim()) return valor.trim();
  }
  return undefined;
}

function leer(plantilla: PlantillaDeLectura, comprobante: ComprobanteNormalizado): ResultadoDePlantillas {
  const { campos } = plantilla;
  const faltan: string[] = [];

  const montoTexto = sacarCampo(campos.monto, comprobante);
  const monto = montoTexto === undefined ? null : leerMonto(montoTexto);
  if (!monto) faltan.push("monto");

  let fecha: string | null = comprobante.fechaOriginal ?? fechaEnChile(comprobante.recibido);
  if (campos.fecha) {
    const fechaTexto = sacarCampo(campos.fecha, comprobante);
    fecha = fechaTexto === undefined ? null : leerFecha(fechaTexto);
    if (!fecha) faltan.push("fecha");
  }

  const comercio = pulirComercio("fijo" in campos.comercio ? campos.comercio.fijo : sacarCampo(campos.comercio, comprobante));
  if (!comercio) faltan.push("comercio");

  if (!monto || !fecha || !comercio) return { estado: "incompleto", plantilla: plantilla.id, faltan };

  const lectura: LecturaLeida = {
    ok: true,
    tipo: plantilla.tipo,
    sentido: plantilla.sentido,
    monto: monto.monto,
    moneda: monto.moneda,
    fecha,
    comercio,
    fuente: plantilla.fuente,
    via: "plantilla",
    plantilla: plantilla.id,
  };

  const medioPago = campos.medioPago
    ? "fijo" in campos.medioPago
      ? campos.medioPago.fijo
      : leerMedioPago(sacarCampo(campos.medioPago, comprobante))
    : undefined;
  if (medioPago) lectura.medioPago = medioPago;

  const ultimos4 = ultimosCuatro(sacarCampo(campos.ultimos4, comprobante));
  if (ultimos4) lectura.ultimos4 = ultimos4;

  const cuotas = Number(sacarCampo(campos.cuotas, comprobante));
  if (Number.isInteger(cuotas) && cuotas >= 2 && cuotas <= CUOTAS_MAXIMAS) lectura.cuotas = cuotas;

  const contraparte: Contraparte = {};
  const nombre = pulirComercio(sacarCampo(campos.contraparte?.nombre, comprobante));
  const banco = pulirComercio(sacarCampo(campos.contraparte?.banco, comprobante), 60);
  const suCuenta = ultimosCuatro(sacarCampo(campos.contraparte?.ultimos4, comprobante));
  if (nombre) contraparte.nombre = nombre;
  if (banco) contraparte.banco = banco;
  if (suCuenta) contraparte.ultimos4 = suCuenta;
  if (Object.keys(contraparte).length > 0) lectura.contraparte = contraparte;
  if (plantilla.sinDetalle) lectura.sinDetalle = true;

  return { estado: "leido", lectura };
}

/** La primera plantilla que calza decide: lee, descarta o avisa que le falto algo. */
export function leerConPlantillas(
  comprobante: ComprobanteNormalizado,
  plantillas: readonly Plantilla[],
): ResultadoDePlantillas {
  for (const plantilla of plantillas) {
    if (!calza(plantilla, comprobante)) continue;
    if ("descartar" in plantilla) {
      return { estado: "descartado", plantilla: plantilla.id, motivo: plantilla.descartar, porque: plantilla.porque };
    }
    return leer(plantilla, comprobante);
  }
  return { estado: "sin-plantilla" };
}
