/**
 * Helpers de fecha para campos @db.Date.
 *
 * El problema que resuelven: `new Date("2026-10-27")` se interpreta como
 * medianoche UTC, que en Chile (UTC-3) es el 26 de octubre a las 21:00. Si se
 * formatea con metodos locales, el dia se corre uno hacia atras. Por eso aca
 * todo se construye y se lee en UTC, sin pasar nunca por la zona local.
 */

const ISO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Convierte "2026-10-27" en un Date en medianoche UTC. */
export function fechaDesdeISO(iso: string): Date {
  const partes = ISO_FECHA.exec(iso);
  if (!partes) {
    throw new Error(`Fecha invalida: "${iso}". Se espera el formato YYYY-MM-DD.`);
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  // Date.UTC normaliza de callado: el 31 de febrero se vuelve 2 o 3 de marzo.
  // Comparar de vuelta descarta fechas que no existen.
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new Error(`Fecha inexistente: "${iso}".`);
  }
  return fecha;
}

/** Convierte un Date en "YYYY-MM-DD" leyendo siempre en UTC. */
export function isoDesdeFecha(fecha: Date): string {
  const anio = String(fecha.getUTCFullYear()).padStart(4, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Identificador de mes "YYYY-MM" a partir de un Date. */
export function mesDesdeFecha(fecha: Date): string {
  return isoDesdeFecha(fecha).slice(0, 7);
}

export type RangoMes = { desde: Date; hasta: Date };

/**
 * Rango semiabierto [desde, hasta) que cubre un mes completo.
 * Semiabierto para poder consultar con gte/lt sin preocuparse del ultimo dia.
 */
export function rangoDelMes(anio: number, mes: number): RangoMes {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Mes invalido: ${mes}. Debe estar entre 1 y 12.`);
  }
  if (!Number.isInteger(anio) || anio < 1970 || anio > 9999) {
    throw new Error(`Anio invalido: ${anio}.`);
  }
  return {
    desde: new Date(Date.UTC(anio, mes - 1, 1)),
    hasta: new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1)),
  };
}

const MES_ISO = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Parte un "YYYY-MM" en sus numeros, validando de paso. */
function partesDelMes(mesISO: string): [anio: number, mes: number] {
  const encontrado = MES_ISO.exec(mesISO);
  if (!encontrado) {
    throw new Error(`Mes invalido: "${mesISO}". Se espera el formato YYYY-MM.`);
  }
  return [Number(encontrado[1]), Number(encontrado[2])];
}

/** Cuenta de meses absolutos desde el anio 0, para poder sumar y restar. */
function indiceDeMes(mesISO: string): number {
  const [anio, mes] = partesDelMes(mesISO);
  return anio * 12 + (mes - 1);
}

function mesDesdeIndice(indice: number): string {
  const anio = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

/** Suma (o resta, con negativo) meses a un "YYYY-MM". */
export function sumarMeses(mesISO: string, cantidad: number): string {
  if (!Number.isInteger(cantidad)) {
    throw new Error(`La cantidad de meses debe ser entera: ${cantidad}.`);
  }
  return mesDesdeIndice(indiceDeMes(mesISO) + cantidad);
}

/**
 * Meses de `desde` a `hasta`. Positivo si `hasta` es posterior.
 * De "2026-08" a "2026-08" es 0; a "2026-09" es 1.
 */
export function mesesEntre(desde: string, hasta: string): number {
  return indiceDeMes(hasta) - indiceDeMes(desde);
}

/** Compara dos meses como lo haria un <, 0, >. */
export function compararMeses(a: string, b: string): number {
  return indiceDeMes(a) - indiceDeMes(b);
}

/** Cantidad de dias que tiene un mes, considerando anios bisiestos. */
export function diasEnMes(anio: number, mes: number): number {
  const { desde, hasta } = rangoDelMes(anio, mes);
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
}

/** Igual que diasEnMes pero tomando "YYYY-MM". */
export function diasEnMesISO(mesISO: string): number {
  const { desde, hasta } = rangoDelMesISO(mesISO);
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
}

/** Igual que rangoDelMes pero tomando "YYYY-MM". */
export function rangoDelMesISO(mesISO: string): RangoMes {
  const partes = /^(\d{4})-(\d{2})$/.exec(mesISO);
  if (!partes) {
    throw new Error(`Mes invalido: "${mesISO}". Se espera el formato YYYY-MM.`);
  }
  return rangoDelMes(Number(partes[1]), Number(partes[2]));
}

/**
 * Mes en curso segun la zona horaria indicada, en formato "YYYY-MM".
 * Se usa Intl para no depender de la zona del servidor, que en produccion
 * casi siempre es UTC.
 */
export function mesActual(zona = "America/Santiago", ahora = new Date()): string {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
  });
  // en-CA entrega "2026-10".
  return formato.format(ahora);
}

/** Dia de hoy en la zona indicada, en formato "YYYY-MM-DD". */
export function hoyISO(zona = "America/Santiago", ahora = new Date()): string {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formato.format(ahora);
}
