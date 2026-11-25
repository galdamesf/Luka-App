import type { TipoCuentaBancaria } from "@/dominio/bancos";

/**
 * La cartola del mes: dominio puro, sin Prisma ni PDF.
 *
 * El PDF lo abre src/lib/cartola-pdf.ts y entrega el texto de cada pagina con
 * su posicion. Una plantilla por banco lo convierte en una CartolaLeida: de
 * que cuenta es, que periodo cubre, sus filas y los totales que el banco
 * imprime al final. Con esos totales Luka cuadra la cartola antes de anotar
 * nada: si lo que leyo no suma lo mismo que el banco, no anota.
 */

/** Un pedazo de texto del PDF: x e y en puntos, desde la esquina de abajo a la izquierda. */
export type PiezaDeTexto = { x: number; y: number; ancho: number; alto: number; texto: string };

export type PaginaDeCartola = { numero: number; ancho: number; alto: number; piezas: PiezaDeTexto[] };

/** Un cargo saca plata de la cuenta; un abono la mete. */
export type LadoDeLaFila = "cargo" | "abono";

export type FilaDeCartola = {
  /** AAAA-MM-DD */
  fecha: string;
  /** Como la escribe el banco, sin el RUT con que empiezan las transferencias. */
  descripcion: string;
  /** En pesos, siempre positivo: el lado dice si salio o entro. */
  monto: number;
  lado: LadoDeLaFila;
  /** El numero de documento, si la fila lo trae. */
  documento: string | null;
  /**
   * El saldo despues de esta fila, si el banco lo imprime: Santander, solo
   * en la ultima fila de cada dia; Consorcio, en cada una.
   */
  saldo: number | null;
};

export type TotalesDeCartola = {
  saldoInicial: number;
  /** Depositos y otros abonos. */
  abonos: number;
  /** Cheques, otros cargos e impuestos. */
  cargos: number;
  saldoFinal: number;
};

export type CartolaLeida = {
  /** "santander/cuenta-corriente": que plantilla la leyo. */
  plantilla: string;
  /** Como se llama el banco en el catalogo: "Santander". */
  banco: string;
  tipoDeCuenta: TipoCuentaBancaria;
  /** Los ultimos 4 digitos del numero de cuenta, contando el digito verificador si tiene. */
  ultimos4: string;
  /**
   * Los 4 de antes del digito verificador ("0-000-12-34567-8" -> "4567"), o
   * null si el numero no tiene. Hay quien anota esos en Luka.
   */
  ultimos4SinVerificador: string | null;
  /** El numero de la cartola, si el banco lo imprime. */
  numero: number | null;
  /** AAAA-MM-DD */
  desde: string;
  /** AAAA-MM-DD */
  hasta: string;
  filas: FilaDeCartola[];
  /** Los totales del resumen del banco. Sin ellos no se puede cuadrar. */
  totales: TotalesDeCartola | null;
};

export type MotivoSinCartola =
  /** No es la cartola de ningun banco que Luka sepa leer. */
  | "formato-desconocido"
  /** Es de un banco que Luka conoce, pero falta algo que siempre trae. */
  | "incompleta";

export type CartolaSinLeer = { ok: false; motivo: MotivoSinCartola; banco: string | null; detalle: string };

export type LecturaDeCartola = ({ ok: true } & CartolaLeida) | CartolaSinLeer;
