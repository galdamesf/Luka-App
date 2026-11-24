import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PaginaDeCartola } from "@/dominio/cartolas";

/**
 * Cartolas de Santander de prueba, con datos inventados: la misma pagina, en
 * las mismas posiciones que la de verdad (las columnas, los titulos y el
 * resumen del final), armada a partir de unas filas.
 *
 * El PDF de Santander corta el texto de dos maneras distintas segun la
 * version: "junta" ("05/10 O.Gerencia" en un pedazo, la glosa suelta) y
 * "suelta" (la fecha y la sucursal separadas, la glosa entera en uno). Las
 * dos se arman aqui, como paginas (para las reglas) o como un PDF de verdad.
 */

export type FilaDeEjemplo = {
  /** "05/10" */
  fecha: string;
  sucursal?: string;
  /** El RUT con que empiezan las transferencias, con ceros: "0123456785". */
  codigo?: string;
  glosa: string;
  documento?: string;
  cargo?: number;
  abono?: number;
  /** El saldo del dia, en la ultima fila de cada dia. */
  saldo?: number;
};

export type Totales = {
  saldoInicial: number;
  depositos: number;
  otrosAbonos: number;
  cheques: number;
  otrosCargos: number;
  impuestos: number;
  saldoFinal: number;
};

export type CartolaDeEjemplo = {
  estilo?: "junta" | "suelta";
  producto?: string;
  /** Por omision "0-000-12-34567-8". */
  cuenta?: string | null;
  numero?: number;
  /** "30/09/2026" */
  desde: string;
  hasta: string;
  /** Sin el periodo arriba (para probar una cartola incompleta). */
  sinPeriodo?: boolean;
  saldoInicial?: number;
  filas: FilaDeEjemplo[];
  /** Las que van repetidas despues de "Resumen de Comisiones". */
  comisiones?: FilaDeEjemplo[];
  /** Por omision, los que salen de las filas. null: sin resumen. */
  totales?: Totales | null;
};

type Pieza = { texto: string; y: number; x?: number; fin?: number };

const TAMANO = 8;
const PRIMERA_FILA = 624;
const ENTRE_FILAS = 10;

/** Con un punto cada tres cifras: 1200000 -> "1.200.000". */
export function pesos(monto: number): string {
  return monto.toLocaleString("es-CL").replace(/,/g, ".");
}

/** Los totales que imprime el banco, sacados de las filas. */
export function totalesDe(c: CartolaDeEjemplo): Totales {
  const cargos = c.filas.reduce((s, f) => s + (f.cargo ?? 0), 0);
  const abonos = c.filas.reduce((s, f) => s + (f.abono ?? 0), 0);
  const saldoInicial = c.saldoInicial ?? 0;
  return { saldoInicial, depositos: 0, otrosAbonos: abonos, cheques: 0, otrosCargos: cargos, impuestos: 0, saldoFinal: saldoInicial + abonos - cargos };
}

/** Pone el saldo en la ultima fila de cada dia, como el banco. */
export function conSaldos(saldoInicial: number, filas: FilaDeEjemplo[]): FilaDeEjemplo[] {
  let saldo = saldoInicial;
  return filas.map((fila, i) => {
    saldo += (fila.abono ?? 0) - (fila.cargo ?? 0);
    const ultimaDelDia = filas[i + 1]?.fecha !== fila.fecha;
    return ultimaDelDia ? { ...fila, saldo } : { ...fila, saldo: undefined };
  });
}

function piezasDeLaFila(fila: FilaDeEjemplo, y: number, estilo: "junta" | "suelta"): Pieza[] {
  const sucursal = fila.sucursal ?? "Agustinas";
  const piezas: Pieza[] = [];
  if (estilo === "junta") {
    piezas.push({ texto: `${fila.fecha} ${sucursal}`, x: 32, y });
    const inicio = fila.codigo ? 165 : 112;
    if (fila.codigo) piezas.push({ texto: fila.codigo, x: 112, y });
    const palabras = fila.glosa.split(" ");
    if (fila.documento && fila.codigo && palabras.length > 1) {
      // Como en la cartola de verdad: la ultima palabra y el documento, en un solo pedazo.
      const ultima = palabras.pop()!;
      piezas.push({ texto: palabras.join(" "), x: inicio, y });
      piezas.push({ texto: `${ultima} ${fila.documento}`, x: 327 - (ultima.length + 1) * 4.4, y });
    } else {
      piezas.push({ texto: fila.glosa, x: inicio, y });
      if (fila.documento) piezas.push({ texto: fila.documento, x: 327, y });
    }
  } else {
    piezas.push({ texto: fila.fecha, x: 33, y });
    piezas.push({ texto: sucursal, x: 64, y });
    piezas.push({ texto: fila.codigo ? `${fila.codigo} ${fila.glosa}` : fila.glosa, x: 121, y });
    if (fila.documento) piezas.push({ texto: fila.documento, x: 325, y });
  }
  if (fila.cargo !== undefined) piezas.push({ texto: pesos(fila.cargo), fin: 441, y });
  if (fila.abono !== undefined) piezas.push({ texto: pesos(fila.abono), fin: 523, y });
  if (fila.saldo !== undefined) piezas.push({ texto: pesos(fila.saldo), fin: 603, y });
  return piezas;
}

function piezasDe(c: CartolaDeEjemplo): Pieza[] {
  const estilo = c.estilo ?? "junta";
  const piezas: Pieza[] = [
    { texto: "B A N C O S A N T A N D E R C H I L E", x: 32, y: 836 },
    { texto: "SU EJECUTIVO DE CUENTA ES", x: 57, y: 811 },
    { texto: "CLIENTES GESTION DIGITAL", x: 169, y: 811 },
    { texto: c.producto ?? "CTA CTE LIFE", x: 366, y: 750 },
    { texto: "NOMBRE INVENTADO DE PRUEBA", x: 57, y: 744 },
    { texto: "prueba@ejemplo.cl", x: 57, y: 716 },
    { texto: "CARTOLA", x: 366, y: 716 },
    { texto: "DESDE", x: 418, y: 716 },
    { texto: "HASTA", x: 471, y: 716 },
    { texto: "PAGINA", x: 523, y: 716 },
    { texto: "Nota: Consideramos como aprobado este estado de cuenta si dentro de 30 días no", x: 367, y: 692 },
    { texto: "DETALLE DE MOVIMIENTOS", x: 119, y: 650 },
    { texto: "SALDOS DIARIOS", x: 427, y: 650 },
    { texto: "CHEQUES Y OTROS", x: 373.4, y: 641 },
    { texto: "DEPOSITOS Y OTROS", x: 452.7, y: 641 },
    { texto: "FECHA", x: 34.3, y: 638 },
    { texto: "SUCURSAL", x: 70.2, y: 638 },
    { texto: "DESCRIPCION", x: 195.7, y: 638 },
    { texto: "N° DCTO", x: 331.8, y: 638 },
    { texto: "SALDO", x: 556.8, y: 638 },
    { texto: "CARGOS", x: 389.5, y: 634 },
    { texto: "ABONOS", x: 471.7, y: 634 },
  ];
  if (c.cuenta !== null) piezas.push({ texto: c.cuenta ?? "0-000-12-34567-8", x: 366, y: 736 }, { texto: "003 01234567", x: 437, y: 736 });
  if (!c.sinPeriodo) {
    piezas.push(
      { texto: String(c.numero ?? 9), x: 386, y: 706 },
      { texto: c.desde, x: 414, y: 706 },
      { texto: c.hasta, x: 464, y: 706 },
      { texto: "1", x: 524, y: 706 },
      { texto: "de", x: 532, y: 706 },
      { texto: "1", x: 545, y: 706 },
    );
  }

  let y = PRIMERA_FILA;
  for (const fila of c.filas) {
    piezas.push(...piezasDeLaFila(fila, y, estilo));
    y -= ENTRE_FILAS;
  }
  y -= ENTRE_FILAS;
  piezas.push({ texto: "Resumen de Comisiones", x: 112, y });
  piezas.push({ texto: "*********************", x: 112, y: y - 10 });
  y -= 20;
  for (const fila of c.comisiones ?? []) {
    piezas.push(...piezasDeLaFila(fila, y, estilo));
    y -= ENTRE_FILAS;
  }
  if (!c.comisiones?.length) piezas.push({ texto: "SIN COMISIONES EN EL PERIODO", x: 112, y });

  const totales = c.totales === undefined ? totalesDe(c) : c.totales;
  piezas.push({ texto: "INFORMACION DE CUENTA CORRIENTE", x: 39, y: 159 });
  if (totales !== null) {
    const titulos: [string, number][] = [
      ["SALDO INICIAL", 58],
      ["DEPOSITOS", 129],
      ["OTROS ABONOS", 189],
      ["CHEQUES", 262],
      ["OTROS CARGOS", 329],
      ["IMPUESTOS", 413],
      ["SALDO FINAL", 498],
    ];
    for (const [texto, x] of titulos) piezas.push({ texto, x, y: 146 });
    const valores = [
      totales.saldoInicial,
      totales.depositos,
      totales.otrosAbonos,
      totales.cheques,
      totales.otrosCargos,
      totales.impuestos,
      totales.saldoFinal,
    ];
    const posiciones = [78, 150, 201, 283, 341, 432, 512];
    valores.forEach((valor, i) => piezas.push({ texto: pesos(valor), x: posiciones[i]!, y: 132 }));
  }
  piezas.push({ texto: "INFORMACION DE LINEA DE CREDITO", x: 39, y: 108 });
  piezas.push({ texto: "CUPO APROBADO", x: 79, y: 92 });
  return piezas;
}

/** El ancho que mide el lector de PDF, mas o menos, en esta letra. */
function anchoAproximado(texto: string): number {
  return texto.length * 4.4;
}

/** La cartola como la entrega src/lib/cartola-pdf.ts, sin pasar por un PDF. */
export function paginasDeEjemplo(c: CartolaDeEjemplo): PaginaDeCartola[] {
  const piezas = piezasDe(c).map((p) => {
    const ancho = anchoAproximado(p.texto);
    const x = p.x ?? p.fin! - ancho;
    return { x, y: p.y, ancho, alto: TAMANO, texto: p.texto };
  });
  return [{ numero: 1, ancho: 612, alto: 905, piezas }];
}

/** La misma cartola, como un PDF de verdad (sin clave). */
export async function pdfDeEjemplo(c: CartolaDeEjemplo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const pagina = pdf.addPage([612, 905]);
  for (const p of piezasDe(c)) {
    const x = p.x ?? p.fin! - fuente.widthOfTextAtSize(p.texto, TAMANO);
    pagina.drawText(p.texto, { x, y: p.y, size: TAMANO, font: fuente });
  }
  return new Uint8Array(await pdf.save());
}

/** Un mes tipico: transferencias, compras con debito, un pago recurrente, un giro y una comision. */
export const OCTUBRE: CartolaDeEjemplo = {
  numero: 9,
  desde: "30/09/2026",
  hasta: "30/10/2026",
  saldoInicial: 669,
  filas: conSaldos(669, [
    { fecha: "05/10", sucursal: "O.Gerencia", codigo: "0123456785", glosa: "Transf de Ana Rojas", abono: 26_000 },
    { fecha: "05/10", sucursal: "O.Gerencia", codigo: "0987654321", glosa: "Transf a Pedro Soto", cargo: 26_000 },
    { fecha: "19/10", codigo: "0766741657", glosa: "Transf de CONSTRUCTORA EJEMPLO", abono: 1_200_000 },
    { fecha: "22/10", codigo: "013468268K", glosa: "Transf. ANA MARIA ROJAS PEREZ", documento: "5000000", abono: 140_000 },
    { fecha: "22/10", sucursal: "O.Gerencia", codigo: "0189058853", glosa: "Transf a Luis Muñoz", cargo: 67_000 },
    { fecha: "23/10", glosa: "Compra Nacional MD LIDER EXPRESS", documento: "2951010", cargo: 17_500 },
    { fecha: "23/10", glosa: "Pagos Rec. Internacional MD NETFLIX.COM", documento: "2961010", cargo: 7_990 },
    { fecha: "26/10", glosa: "Compra Nacional MD PELUQUERIA EL CORTE", documento: "2961010", cargo: 14_900 },
    { fecha: "27/10", glosa: "Giro Cajero Automatico", documento: "3001010", cargo: 20_000 },
    { fecha: "27/10", glosa: "COMISION MANTENCION PLAN", cargo: 3_266 },
  ]),
  comisiones: [{ fecha: "27/10", glosa: "COMISION MANTENCION PLAN", cargo: 3_266 }],
};
