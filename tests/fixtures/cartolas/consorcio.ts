import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PaginaDeCartola } from "@/dominio/cartolas";
import { pesos } from "./santander";

/**
 * Cartolas de Consorcio de prueba, con datos inventados: las mismas paginas,
 * con el texto en las mismas posiciones que la de verdad. Cada pagina repite
 * el encabezado y el resumen, el texto no dice "Consorcio" en ninguna parte
 * (va en el logo) y los movimientos de un mismo dia vienen al reves de como
 * pasaron, como en la de verdad. Se arman como paginas (para las reglas) o
 * como un PDF de verdad.
 */

export type FilaDeEjemplo = {
  /** "01/10/2026" */
  fecha: string;
  glosa: string;
  /** El banco de la otra persona en una transferencia: va en su propio pedazo, cortado ("BANCO DE C"). */
  banco?: string;
  /** El numero de la operacion. Por omision, uno inventado. */
  numero?: string;
  cargo?: number;
  abono?: number;
  /** El saldo que deja: lo pone conSaldos. */
  saldo?: number;
};

export type CartolaDeEjemplo = {
  /** Por omision "4300012345". null: sin el numero de cuenta. */
  cuenta?: string | null;
  numero?: string;
  producto?: string;
  /** "01/10/2026" */
  desde: string;
  hasta: string;
  /** Sin el periodo (para probar una cartola incompleta). */
  sinPeriodo?: boolean;
  saldoInicial: number;
  /** En el orden en que pasaron, con su saldo. */
  filas: FilaDeEjemplo[];
  /** Cuantas filas caben en cada pagina. */
  porPagina?: number;
};

type Pieza = { texto: string; y: number; x?: number; fin?: number; ancho?: number };

const TAMANO = 8;
const PRIMERA_FILA = 453;
const ENTRE_FILAS = 10.4;

/** El saldo que deja cada fila, en el orden en que pasaron. */
export function conSaldos(saldoInicial: number, filas: FilaDeEjemplo[]): FilaDeEjemplo[] {
  let saldo = saldoInicial;
  return filas.map((fila) => {
    saldo += (fila.abono ?? 0) - (fila.cargo ?? 0);
    return { ...fila, saldo };
  });
}

/** Como las lista el banco: las de cada dia al reves de como pasaron. */
function comoLasLista(filas: readonly FilaDeEjemplo[]): FilaDeEjemplo[] {
  const fechas = [...new Set(filas.map((f) => f.fecha))];
  return fechas.flatMap((fecha) => filas.filter((f) => f.fecha === fecha).reverse());
}

function totalesDe(c: CartolaDeEjemplo): { cargos: number; abonos: number; saldoFinal: number } {
  const cargos = c.filas.reduce((s, f) => s + (f.cargo ?? 0), 0);
  const abonos = c.filas.reduce((s, f) => s + (f.abono ?? 0), 0);
  return { cargos, abonos, saldoFinal: c.saldoInicial + abonos - cargos };
}

function encabezado(c: CartolaDeEjemplo, pagina: number, paginas: number): Pieza[] {
  const totales = totalesDe(c);
  const monto = (valor: number) => `$ ${pesos(valor)}`;
  const piezas: Pieza[] = [
    { texto: "Cartola Histórica Cuenta Corriente", x: 42, y: 710 },
    { texto: "NOMBRE INVENTADO DE PRUEBA", x: 44, y: 689 },
    { texto: "CALLE INVENTADA 123", x: 44, y: 678 },
    { texto: "SANTIAGO", x: 44, y: 667 },
    { texto: `N° Cartola: ${c.numero ?? "102026"}`, x: 492, y: 641 },
    { texto: "Resumen", x: 314, y: 620 },
    { texto: "Rut", x: 49, y: 595 },
    { texto: ":", x: 124, y: 595 },
    { texto: "11.111.111-1", x: 159, y: 595 },
    { texto: "Saldo Inicial", x: 315, y: 595 },
    { texto: ":", x: 455, y: 596 },
    { texto: monto(c.saldoInicial), fin: 564, y: 595 },
    { texto: "N° de Cuenta", x: 49, y: 583 },
    { texto: ":", x: 124, y: 583 },
    { texto: "Total Cargos", x: 315, y: 582 },
    { texto: monto(totales.cargos), fin: 564, y: 582 },
    { texto: "Moneda", x: 49, y: 570 },
    { texto: ":", x: 124, y: 570 },
    { texto: "PESOS CHILENOS", x: 159, y: 570 },
    { texto: "Total Abonos", x: 315, y: 569 },
    { texto: monto(totales.abonos), fin: 564, y: 569 },
    { texto: "Producto", x: 49, y: 557 },
    { texto: ":", x: 124, y: 557 },
    { texto: c.producto ?? "CUENTA CTE PERSONAS", x: 159, y: 557 },
    { texto: "Retenciones", x: 315, y: 556 },
    { texto: "$ 0", fin: 564, y: 556 },
    { texto: "Fecha Consulta", x: 49, y: 544 },
    { texto: "Saldo Final Disponible", x: 315, y: 544 },
    { texto: monto(totales.saldoFinal), fin: 564, y: 544 },
    { texto: "Página", x: 49, y: 532 },
    { texto: `${pagina} de ${paginas}`, x: 158, y: 532 },
    { texto: "Saldo Final Contable", x: 315, y: 531 },
    { texto: monto(totales.saldoFinal), fin: 564, y: 531 },
    { texto: "Movimientos", x: 49, y: 486 },
    { texto: "Fecha", x: 49.4, y: 468, ancho: 25 },
    { texto: "Descripción", x: 118.2, y: 468, ancho: 47 },
    { texto: "Número", x: 280.2, y: 468, ancho: 32 },
    { texto: "Cargos", x: 358.5, y: 468, ancho: 29 },
    { texto: "Abonos", x: 434.8, y: 468, ancho: 30.5 },
    { texto: "Saldos", x: 529.2, y: 468, ancho: 27.5 },
    { texto: "Este estado de cuenta se considerará aprobado, si dentro de 30 días no hemos recibido aviso de lo contrario.", x: 112, y: 180 },
    { texto: `${pagina} de ${paginas}`, x: 540, y: 136 },
    { texto: "Infórmese sobre la garantía estatal de los depósitos en su Banco o en www.cmfchile.cl.", x: 136, y: 34 },
  ];
  if (c.cuenta !== null) piezas.push({ texto: c.cuenta ?? "4300012345", x: 159, y: 583 });
  if (!c.sinPeriodo) {
    piezas.push({ texto: "Período", x: 50, y: 620 }, { texto: ":", x: 124, y: 620 }, { texto: `${c.desde} al ${c.hasta}`, x: 159, y: 620 });
  }
  return piezas;
}

function piezasDeLaFila(fila: FilaDeEjemplo, y: number, i: number): Pieza[] {
  const piezas: Pieza[] = [
    { texto: fila.fecha, x: 51.8, y, ancho: 40 },
    { texto: fila.glosa, x: 104.1, y },
    { texto: fila.numero ?? String(100_000_000_000 + (i + 1) * 101), x: 278.8, y, ancho: 53.4 },
  ];
  if (fila.banco) piezas.push({ texto: fila.banco, x: 195.2, y });
  if (fila.cargo !== undefined) piezas.push({ texto: `$ ${pesos(fila.cargo)}`, fin: 404.5, y });
  if (fila.abono !== undefined) piezas.push({ texto: `$ ${pesos(fila.abono)}`, fin: 483, y });
  if (fila.saldo !== undefined) piezas.push({ texto: `$ ${pesos(fila.saldo)}`, fin: 564, y });
  return piezas;
}

/** Las piezas de cada pagina, con el encabezado repetido y sus filas. */
function piezasPorPagina(c: CartolaDeEjemplo): Pieza[][] {
  const listadas = comoLasLista(c.filas);
  const porPagina = c.porPagina ?? 25;
  const cuantas = Math.max(1, Math.ceil(listadas.length / porPagina));
  return Array.from({ length: cuantas }, (_, n) => {
    const piezas = encabezado(c, n + 1, cuantas);
    listadas.slice(n * porPagina, (n + 1) * porPagina).forEach((fila, i) => {
      piezas.push(...piezasDeLaFila(fila, PRIMERA_FILA - i * ENTRE_FILAS, n * porPagina + i));
    });
    return piezas;
  });
}

/** El ancho que mide el lector de PDF, mas o menos, en esta letra. */
function anchoAproximado(texto: string): number {
  return texto.length * 4.4;
}

/** La cartola como la entrega src/lib/cartola-pdf.ts, sin pasar por un PDF. */
export function paginasDeEjemplo(c: CartolaDeEjemplo): PaginaDeCartola[] {
  return piezasPorPagina(c).map((piezas, n) => ({
    numero: n + 1,
    ancho: 612,
    alto: 792,
    piezas: piezas.map((p) => {
      const ancho = p.ancho ?? anchoAproximado(p.texto);
      return { x: p.x ?? p.fin! - ancho, y: p.y, ancho, alto: TAMANO, texto: p.texto };
    }),
  }));
}

/** La misma cartola, como un PDF de verdad (sin clave), una hoja por pagina. */
export async function pdfDeEjemplo(c: CartolaDeEjemplo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  for (const piezas of piezasPorPagina(c)) {
    const pagina = pdf.addPage([612, 792]);
    for (const p of piezas) {
      const x = p.x ?? p.fin! - fuente.widthOfTextAtSize(p.texto, TAMANO);
      pagina.drawText(p.texto, { x, y: p.y, size: TAMANO, font: fuente });
    }
  }
  return new Uint8Array(await pdf.save());
}

/**
 * Un mes tipico de la cuenta: compras con la tarjeta de debito, una por
 * internet, transferencias que salen y que entran (con y sin el banco al
 * final, y una sin nombre), un giro, el sueldo y una comision. En el orden en
 * que pasaron; cinco por pagina, asi el 02/10 queda partido en dos paginas.
 */
export const OCTUBRE: CartolaDeEjemplo = {
  desde: "01/10/2026",
  hasta: "31/10/2026",
  saldoInicial: 800_000,
  porPagina: 5,
  filas: conSaldos(800_000, [
    { fecha: "01/10/2026", glosa: "COMPRAS POS FARMACIA AHUMA", cargo: 4_590 },
    { fecha: "01/10/2026", glosa: "TEF ANA ROJAS", banco: "BANCO DE C", cargo: 12_500 },
    { fecha: "01/10/2026", glosa: "COMPRAS POS LIDER EXPRESS", cargo: 31_870 },
    { fecha: "02/10/2026", glosa: "COMPRAS POS PANADERIA LA E", cargo: 2_350 },
    { fecha: "02/10/2026", glosa: "GIRO EN CAJERO AUTOMATICO", cargo: 15_000 },
    { fecha: "02/10/2026", glosa: "TEF PEDRO SOTO GAJARDO", abono: 18_000 },
    { fecha: "05/10/2026", glosa: "PAGO DE REMUNERACIONES -", numero: "10000000077", abono: 1_250_000 },
    { fecha: "05/10/2026", glosa: "COMPRA WEBPAY CINE PLANET", cargo: 9_800 },
    { fecha: "05/10/2026", glosa: "TEF NOMBRE DESTINATARIO", cargo: 35_000 },
    { fecha: "07/10/2026", glosa: "TEF CAMILA ROJAS", banco: "SCOTIABANK", cargo: 60_000 },
    { fecha: "31/10/2026", glosa: "COMISION MANTENCION", cargo: 2_990 },
  ]),
};
