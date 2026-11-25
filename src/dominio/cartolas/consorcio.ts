import type { TipoCuentaBancaria } from "@/dominio/bancos";
import { armarLineas, centro, compacto, leerPesos, type Linea, type Palabra } from "./lineas";
import type { CartolaSinLeer, FilaDeCartola, LecturaDeCartola, PaginaDeCartola, TotalesDeCartola } from "./tipos";

/**
 * La cartola de la cuenta corriente de Consorcio: la que llega cada mes desde
 * bancoconsorcio@bancoconsorcio.cl, con el PDF cifrado con los ultimos 4
 * digitos del RUT, sin el verificador. El texto no dice "Consorcio" en
 * ninguna parte (el nombre va en el logo), asi que se reconoce por su forma.
 *
 * Cada pagina repite el encabezado y el resumen:
 *
 *   Cartola Histórica Cuenta Corriente                 N° Cartola: 102026
 *   Período      : 01/10/2026 al 31/10/2026   Resumen
 *   N° de Cuenta : 4300012345                 Saldo Inicial         $ 800.000
 *   Producto     : CUENTA CTE PERSONAS        Total Cargos          $ 174.100
 *                                             Total Abonos          $ 1.268.000
 *                                             Saldo Final Contable  $ 1.893.900
 *
 * y despues sus movimientos, cada uno con el saldo que dejo:
 *
 *   Fecha       Descripción                  Número        Cargos     Abonos    Saldos
 *   01/10/2026  COMPRAS POS LIDER EXPRESS    100000000101  $ 31.870             $ 751.040
 *   01/10/2026  TEF ANA ROJAS   BANCO DE C   100000000202  $ 12.500             $ 782.910
 *   01/10/2026  COMPRAS POS FARMACIA AHUMA   100000000303  $ 4.590              $ 795.410
 *
 * Los movimientos de un mismo dia no vienen en el orden en que pasaron (en el
 * ejemplo, al reves). Se ordenan siguiendo los saldos: cada fila deja el
 * saldo de la anterior, mas o menos su monto. Asi cuadrar revisa el saldo de
 * cada fila.
 */

export const PLANTILLA_CONSORCIO = "consorcio/cuenta-corriente";

const FECHA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const PERIODO = /(\d{2})\/(\d{2})\/(\d{4})\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/i;
const NUMERO_DE_CUENTA = /^\d{6,14}$/;
/** El numero de la operacion, en la columna «Número». */
const DOCUMENTO = /^\d{6,14}$/;
/** Donde termina el detalle de movimientos de cada pagina. */
const FIN_DEL_DETALLE = /ESTEESTADODECUENTA/;

/** El rotulo como se compara: sin tildes ni espacios, sin los dos puntos del final, y «Nº» como «N°». */
function rotulo(texto: string): string {
  return compacto(texto).replace(/º/g, "°").replace(/:+$/, "");
}

export function esCartolaConsorcio(paginas: readonly PaginaDeCartola[]): boolean {
  const primera = paginas[0];
  if (!primera) return false;
  const texto = armarLineas(primera)
    .map((l) => compacto(l.texto))
    .join(" ");
  return (
    /CARTOLA(?:HISTORICA)?CUENTA(?:CORRIENTE|VISTA)/.test(texto) &&
    texto.replace(/º/g, "°").includes("N°CARTOLA") &&
    texto.includes("TOTALCARGOS") &&
    texto.includes("SALDOFINALCONTABLE")
  );
}

function tipoDeCuenta(texto: string): TipoCuentaBancaria | null {
  const t = compacto(texto);
  if (/CUENTACTE|CTACTE|CUENTACORRIENTE/.test(t)) return "CUENTA_CORRIENTE";
  if (/VISTA/.test(t)) return "CUENTA_VISTA";
  if (/AHORRO/.test(t)) return "CUENTA_AHORRO";
  return null;
}

/** La palabra que viene despues de un rotulo ("N° de Cuenta :"), si pasa la prueba. */
function despuesDe(lineas: readonly Linea[], palabrasDelRotulo: readonly string[], prueba: (texto: string) => boolean): Palabra | null {
  const buscado = palabrasDelRotulo.map(rotulo);
  for (const linea of lineas) {
    const textos = linea.palabras.map((p) => rotulo(p.texto));
    for (let i = 0; i + buscado.length <= textos.length; i++) {
      if (!buscado.every((b, j) => textos[i + j] === b)) continue;
      const encontrada = linea.palabras.slice(i + buscado.length).find((p) => prueba(p.texto));
      if (encontrada) return encontrada;
    }
  }
  return null;
}

/** "$ 1.234.567" viene en dos palabras, "$" y el numero; a veces en una: "$1.234.567". */
function pesosDe(texto: string): number | null {
  return leerPesos(texto.replace(/^\$/, ""));
}

function montoDe(lineas: readonly Linea[], palabrasDelRotulo: readonly string[]): number | null {
  const palabra = despuesDe(lineas, palabrasDelRotulo, (t) => pesosDe(t) !== null);
  return palabra === null ? null : pesosDe(palabra.texto);
}

/** El resumen del encabezado: saldo inicial, total de cargos y de abonos, y el saldo final contable. */
function totalesDe(lineas: readonly Linea[]): TotalesDeCartola | null {
  const saldoInicial = montoDe(lineas, ["Saldo", "Inicial"]);
  const cargos = montoDe(lineas, ["Total", "Cargos"]);
  const abonos = montoDe(lineas, ["Total", "Abonos"]);
  const saldoFinal = montoDe(lineas, ["Saldo", "Final", "Contable"]);
  if (saldoInicial === null || cargos === null || abonos === null || saldoFinal === null) return null;
  return { saldoInicial, cargos, abonos, saldoFinal };
}

type Columnas = {
  /** Desde aqui empieza la descripcion: a la izquierda va la fecha. */
  inicioDescripcion: number;
  /** Desde aqui va el numero de la operacion. */
  inicioDocumento: number;
  /** Desde aqui hacia la derecha estan los montos. */
  inicioMontos: number;
  cargos: number;
  abonos: number;
  saldo: number;
  /** La y de los titulos: las filas vienen debajo. */
  y: number;
};

/** Los titulos de las columnas de la pagina, o null si esta pagina no trae movimientos. */
function columnasDe(lineas: readonly Linea[]): Columnas | null {
  const titulos = lineas.find((l) => {
    const t = compacto(l.texto);
    return t.includes("FECHA") && t.includes("DESCRIPCION") && t.includes("SALDOS");
  });
  if (!titulos) return null;
  const buscar = (texto: string): Palabra | undefined => titulos.palabras.find((p) => rotulo(p.texto) === texto);
  const descripcion = buscar("DESCRIPCION");
  const numero = buscar("NUMERO");
  const cargos = buscar("CARGOS");
  const abonos = buscar("ABONOS");
  const saldos = buscar("SALDOS");
  if (!descripcion || !numero || !cargos || !abonos || !saldos) return null;
  return {
    // La descripcion empieza un poco antes que su titulo, y el numero, justo en el suyo.
    inicioDescripcion: descripcion.x - 20,
    inicioDocumento: numero.x - 6,
    inicioMontos: cargos.x - 25,
    cargos: centro(cargos),
    abonos: centro(abonos),
    saldo: centro(saldos),
    y: titulos.y,
  };
}

type FilaLeida = {
  /** "01/10/2026", o null en una linea sin fecha. */
  fecha: string | null;
  descripcion: string;
  documento: string | null;
  cargo: number | null;
  abono: number | null;
  saldo: number | null;
};

function leerFila(linea: Linea, columnas: Columnas): FilaLeida {
  const palabras = [...linea.palabras];
  let fecha: string | null = null;
  if (palabras[0] && FECHA.test(palabras[0].texto) && palabras[0].x < columnas.inicioDescripcion) fecha = palabras.shift()!.texto;

  const fila: FilaLeida = { fecha, descripcion: "", documento: null, cargo: null, abono: null, saldo: null };
  const descripcion: string[] = [];
  for (const palabra of palabras) {
    if (palabra.texto === "$") continue;
    const pesos = pesosDe(palabra.texto);
    if (pesos !== null && centro(palabra) >= columnas.inicioMontos) {
      const distancias = [
        ["cargo", Math.abs(centro(palabra) - columnas.cargos)],
        ["abono", Math.abs(centro(palabra) - columnas.abonos)],
        ["saldo", Math.abs(centro(palabra) - columnas.saldo)],
      ] as const;
      const [columna] = [...distancias].sort((a, b) => a[1] - b[1])[0]!;
      fila[columna] = pesos;
      continue;
    }
    if (palabra.x >= columnas.inicioDocumento) {
      if (DOCUMENTO.test(palabra.texto)) fila.documento = palabra.texto;
      continue;
    }
    if (palabra.x >= columnas.inicioDescripcion) descripcion.push(palabra.texto);
  }
  // "PAGO DE REMUNERACIONES -": el banco corta lo que sigue.
  fila.descripcion = descripcion.join(" ").replace(/[\s-]+$/, "").trim();
  return fila;
}

/** Cuantas veces se prueba, a lo mas, una fila en la cadena de un dia: un dia imposible de ordenar no se queda pensando. */
const INTENTOS_POR_DIA = 10_000;

/**
 * Las filas de un dia en el orden de sus saldos, desde el saldo con que
 * empezo el dia, o null si no hay ningun orden en que todos calcen. Casi
 * siempre una sola fila puede ir primero; cuando dos pueden (una compra y su
 * reversa, y despues otra compra), se prueba una y, si no lleva a ninguna
 * parte, la otra.
 */
function enCadena(pendientes: readonly FilaDeCartola[], saldo: number, intentos: { quedan: number }): FilaDeCartola[] | null {
  if (pendientes.length === 0) return [];
  for (let i = 0; i < pendientes.length; i++) {
    const fila = pendientes[i]!;
    if (fila.saldo === null || fila.saldo !== saldo + (fila.lado === "abono" ? fila.monto : -fila.monto)) continue;
    intentos.quedan -= 1;
    if (intentos.quedan < 0) return null;
    const resto = enCadena([...pendientes.slice(0, i), ...pendientes.slice(i + 1)], fila.saldo, intentos);
    if (resto) return [fila, ...resto];
  }
  return null;
}

/**
 * Los movimientos de cada dia en el orden en que pasaron: el primero es el
 * que deja el saldo del dia anterior mas o menos su monto, y asi. Si un dia
 * no se puede ordenar asi (un saldo que no calza con nada), queda como vino y
 * cuadrar lo va a notar.
 */
export function enElOrdenDeLosSaldos(filas: readonly FilaDeCartola[], saldoInicial: number): FilaDeCartola[] {
  const porFecha = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ordenadas: FilaDeCartola[] = [];
  let saldo = saldoInicial;
  let i = 0;
  while (i < porFecha.length) {
    const fecha = porFecha[i]!.fecha;
    const delDia: FilaDeCartola[] = [];
    while (i < porFecha.length && porFecha[i]!.fecha === fecha) delDia.push(porFecha[i++]!);
    ordenadas.push(...(enCadena(delDia, saldo, { quedan: INTENTOS_POR_DIA }) ?? delDia));
    // Como sea que haya quedado el dia, termina en el mismo saldo.
    saldo += delDia.reduce((suma, f) => suma + (f.lado === "abono" ? f.monto : -f.monto), 0);
  }
  return ordenadas;
}

function incompleta(detalle: string): CartolaSinLeer {
  return { ok: false, motivo: "incompleta", banco: "Consorcio", detalle };
}

function iso(fecha: string): string {
  const [, dia, mes, anio] = FECHA.exec(fecha)!;
  return `${anio}-${mes}-${dia}`;
}

export function leerCartolaConsorcio(paginas: readonly PaginaDeCartola[]): LecturaDeCartola {
  const lineasPorPagina = paginas.map(armarLineas);
  const encabezado = lineasPorPagina[0] ?? [];

  const periodo = encabezado.map((l) => PERIODO.exec(l.texto)).find((m) => m !== null);
  const cuenta = despuesDe(encabezado, ["N°", "de", "Cuenta"], (t) => NUMERO_DE_CUENTA.test(t));
  if (!periodo) return incompleta("No se encontró el periodo de la cartola (desde y hasta).");
  if (!cuenta) return incompleta("No se encontró el número de cuenta.");
  const desde = `${periodo[3]}-${periodo[2]}-${periodo[1]}`;
  const hasta = `${periodo[6]}-${periodo[5]}-${periodo[4]}`;
  const numero = despuesDe(encabezado, ["N°", "Cartola"], (t) => /^\d+$/.test(t));
  const producto = encabezado.map((l) => (compacto(l.texto).startsWith("PRODUCTO") ? tipoDeCuenta(l.texto) : null)).find((t) => t !== null);
  const titulo = encabezado.map((l) => (compacto(l.texto).startsWith("CARTOLA") ? tipoDeCuenta(l.texto) : null)).find((t) => t !== null);

  const filas: FilaDeCartola[] = [];
  for (const lineas of lineasPorPagina) {
    const columnas = columnasDe(lineas);
    if (!columnas) continue;
    for (const linea of lineas) {
      if (linea.y >= columnas.y) continue;
      if (FIN_DEL_DETALLE.test(compacto(linea.texto))) break;
      const fila = leerFila(linea, columnas);
      if (fila.fecha === null) {
        // Una linea sin fecha no es un movimiento, salvo que traiga un monto: eso no se adivina.
        if (fila.cargo !== null || fila.abono !== null) return incompleta("Hay un movimiento sin fecha.");
        continue;
      }
      const lado = fila.cargo !== null && fila.abono === null ? "cargo" : fila.abono !== null && fila.cargo === null ? "abono" : null;
      if (lado === null) return incompleta(`La fila del ${fila.fecha} no trae un monto claro.`);
      const fecha = iso(fila.fecha);
      if (fecha < desde || fecha > hasta) return incompleta(`La fecha ${fila.fecha} no cae en el periodo de la cartola.`);
      filas.push({
        fecha,
        descripcion: fila.descripcion,
        monto: lado === "cargo" ? fila.cargo! : fila.abono!,
        lado,
        documento: fila.documento,
        saldo: fila.saldo,
      });
    }
  }

  const totales = totalesDe(encabezado);
  return {
    ok: true,
    plantilla: PLANTILLA_CONSORCIO,
    banco: "Consorcio",
    tipoDeCuenta: producto ?? titulo ?? "CUENTA_CORRIENTE",
    ultimos4: cuenta.texto.slice(-4),
    ultimos4SinVerificador: null,
    numero: numero === null ? null : Number(numero.texto),
    desde,
    hasta,
    filas: totales === null ? filas : enElOrdenDeLosSaldos(filas, totales.saldoInicial),
    totales,
  };
}
