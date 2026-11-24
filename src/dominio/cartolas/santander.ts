import { sumarDias } from "@/lib/periodo";
import type { TipoCuentaBancaria } from "@/dominio/bancos";
import { armarLineas, centro, compacto, leerPesos, type Linea, type Palabra } from "./lineas";
import type { CartolaSinLeer, FilaDeCartola, LecturaDeCartola, PaginaDeCartola, TotalesDeCartola } from "./tipos";

/**
 * La cartola de la cuenta corriente de Santander (tambien la Life y la
 * cuenta vista): la que llega cada mes desde mensajeria@santander.cl con el
 * PDF cifrado con el RUT.
 *
 * Arriba trae la cuenta ("CTA CTE LIFE", "0-000-12-34567-8") y el periodo
 * (cartola N, desde, hasta). Despues el detalle de movimientos, en columnas:
 *
 *   FECHA SUCURSAL DESCRIPCION  N° DCTO  CARGOS  ABONOS  SALDO
 *   05/10 O.Gerencia 0123456789 Transf a Ana Rojas     26.000          669
 *   23/10 Agustinas Compra Nacional MD LIDER  2951010  17.500
 *
 * Los montos van alineados a la derecha bajo su columna: un monto es cargo
 * o abono segun bajo que titulo cae, no por lo que dice la glosa. El saldo
 * va solo en la ultima fila de cada dia. Al final, el resumen: saldo inicial,
 * depositos, otros abonos, cheques, otros cargos, impuestos y saldo final.
 */

export const PLANTILLA_SANTANDER = "santander/cuenta-corriente";

const FECHA_CORTA = /^(\d{2})\/(\d{2})$/;
const PERIODO = /(\d+)\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})\/(\d{2})\/(\d{4})/;
const NUMERO_DE_CUENTA = /^\d{1,3}(?:-\d+){2,}$/;
/** Las transferencias empiezan con el RUT de la otra persona, con ceros: no se guarda. */
const RUT_AL_COMIENZO = /^\d{7,9}[\dK]\s+/i;
const DOCUMENTO = /^\d{5,10}$/;
/** Donde termina el detalle de movimientos. */
const FIN_DEL_DETALLE = /RESUMENDECOMISIONES|INFORMACIONDECUENTA|INFORMACIONDELALINEA|INFORMACIONDELINEA/;

export function esCartolaSantander(paginas: readonly PaginaDeCartola[]): boolean {
  const primera = paginas[0];
  if (!primera) return false;
  const arriba = armarLineas(primera).slice(0, 15).map((l) => compacto(l.texto));
  return arriba.some((t) => t.includes("BANCOSANTANDER")) && arriba.some((t) => t.includes("CARTOLA"));
}

function tipoDeCuenta(texto: string): TipoCuentaBancaria | null {
  const t = compacto(texto);
  if (/CTACTE|CUENTACORRIENTE/.test(t)) return "CUENTA_CORRIENTE";
  if (/CTAVISTA|CUENTAVISTA|CUENTARUT/.test(t)) return "CUENTA_VISTA";
  if (/AHORRO/.test(t)) return "CUENTA_AHORRO";
  return null;
}

function iso(dia: string, mes: string, anio: string | number): string {
  return `${anio}-${mes}-${dia}`;
}

/** "05/10" con el periodo de la cartola: el anio en que esa fecha cae dentro del periodo. */
function fechaDeLaFila(dia: string, mes: string, desde: string, hasta: string): string | null {
  const anio = Number(hasta.slice(0, 4));
  for (const candidato of [anio, anio - 1, anio + 1]) {
    const fecha = iso(dia, mes, candidato);
    if (Number.isNaN(Date.parse(fecha))) return null;
    if (fecha >= sumarDias(desde, -7) && fecha <= sumarDias(hasta, 7)) return fecha;
  }
  return null;
}

type Columnas = {
  /** Lo que queda a la izquierda de esto es la fecha y la sucursal. */
  inicioDescripcion: number;
  /** Desde aqui hacia la derecha estan los montos. */
  inicioMontos: number;
  /** Desde aqui puede ir el numero de documento. */
  inicioDocumento: number;
  cargos: number;
  abonos: number;
  saldo: number;
  /** La y de la ultima linea de titulos: las filas vienen debajo. */
  y: number;
};

/** Los titulos de las columnas de la pagina, o null si esta pagina no trae detalle. */
function columnasDe(lineas: readonly Linea[]): Columnas | null {
  const titulos = lineas.findIndex((l) => {
    const t = compacto(l.texto);
    return t.includes("FECHA") && t.includes("DESCRIPCION");
  });
  if (titulos === -1) return null;
  const y = lineas[titulos]!.y;
  // Los titulos ocupan dos o tres lineas muy juntas ("CHEQUES Y OTROS" arriba, "CARGOS" abajo).
  const cerca = lineas.filter((l) => Math.abs(l.y - y) <= 12).flatMap((l) => l.palabras);
  const buscar = (texto: string): Palabra | undefined => cerca.find((p) => compacto(p.texto) === texto);
  const sucursal = buscar("SUCURSAL");
  const cargos = buscar("CARGOS");
  const abonos = buscar("ABONOS");
  const saldo = buscar("SALDO");
  // "N° DCTO" viene en un pedazo: donde empieza el "N°" es donde empieza la columna.
  const documento = buscar("N°") ?? buscar("Nº") ?? buscar("DCTO");
  if (!sucursal || !cargos || !abonos || !saldo) return null;
  return {
    inicioDescripcion: sucursal.fin - 4,
    inicioMontos: cargos.x - 30,
    inicioDocumento: (documento?.x ?? cargos.x - 70) - 16,
    cargos: centro(cargos),
    abonos: centro(abonos),
    saldo: centro(saldo),
    y: Math.min(...lineas.filter((l) => Math.abs(l.y - y) <= 12).map((l) => l.y)),
  };
}

type FilaEnArmado = Omit<FilaDeCartola, "fecha"> & { fecha: string | null };

function leerFila(linea: Linea, columnas: Columnas): { fecha: string | null; fila: Partial<FilaEnArmado> & { descripcion: string } } {
  const palabras = [...linea.palabras];
  let fechaCorta: string | null = null;
  if (palabras[0] && FECHA_CORTA.test(palabras[0].texto) && palabras[0].x < columnas.inicioDescripcion) {
    fechaCorta = palabras.shift()!.texto;
  }

  let cargo: number | null = null;
  let abono: number | null = null;
  let saldo: number | null = null;
  let documento: string | null = null;
  const descripcion: string[] = [];

  for (const palabra of palabras) {
    const pesos = leerPesos(palabra.texto);
    if (pesos !== null && centro(palabra) >= columnas.inicioMontos) {
      const distancias = [
        ["cargo", Math.abs(centro(palabra) - columnas.cargos)],
        ["abono", Math.abs(centro(palabra) - columnas.abonos)],
        ["saldo", Math.abs(centro(palabra) - columnas.saldo)],
      ] as const;
      const [columna] = [...distancias].sort((a, b) => a[1] - b[1])[0]!;
      if (columna === "cargo") cargo = pesos;
      else if (columna === "abono") abono = pesos;
      else saldo = pesos;
      continue;
    }
    if (palabra.x < columnas.inicioDescripcion) continue; // la sucursal
    if (DOCUMENTO.test(palabra.texto) && palabra.x >= columnas.inicioDocumento) {
      documento = palabra.texto;
      continue;
    }
    descripcion.push(palabra.texto);
  }

  const fila: Partial<FilaEnArmado> & { descripcion: string } = {
    descripcion: descripcion.join(" ").replace(RUT_AL_COMIENZO, "").trim(),
    documento,
    saldo,
  };
  if (cargo !== null && abono === null) Object.assign(fila, { monto: cargo, lado: "cargo" });
  if (abono !== null && cargo === null) Object.assign(fila, { monto: abono, lado: "abono" });
  return { fecha: fechaCorta, fila };
}

/** Los siete numeros del resumen, en el orden en que los imprime Santander. */
function totalesDe(lineas: readonly Linea[]): TotalesDeCartola | null {
  const titulos = lineas.findIndex((l) => {
    const t = compacto(l.texto);
    return t.includes("SALDOINICIAL") && t.includes("SALDOFINAL");
  });
  if (titulos === -1) return null;
  const valores = lineas[titulos + 1]?.palabras.map((p) => leerPesos(p.texto)) ?? [];
  if (valores.length !== 7 || valores.some((v) => v === null)) return null;
  const [saldoInicial, depositos, otrosAbonos, cheques, otrosCargos, impuestos, saldoFinal] = valores as number[];
  return {
    saldoInicial: saldoInicial!,
    abonos: depositos! + otrosAbonos!,
    cargos: cheques! + otrosCargos! + impuestos!,
    saldoFinal: saldoFinal!,
  };
}

function incompleta(detalle: string): CartolaSinLeer {
  return { ok: false, motivo: "incompleta", banco: "Santander", detalle };
}

export function leerCartolaSantander(paginas: readonly PaginaDeCartola[]): LecturaDeCartola {
  const lineasPorPagina = paginas.map(armarLineas);
  const todas = lineasPorPagina.flat();

  // La cuenta y el periodo, en el encabezado de la primera pagina.
  const encabezado = lineasPorPagina[0] ?? [];
  const periodo = encabezado.map((l) => PERIODO.exec(l.texto)).find((m) => m !== null);
  const numeroDeCuenta = encabezado.flatMap((l) => l.palabras).find((p) => NUMERO_DE_CUENTA.test(p.texto));
  const producto = encabezado.map((l) => tipoDeCuenta(l.texto)).find((t) => t !== null);
  if (!periodo) return incompleta("No se encontró el periodo de la cartola (desde y hasta).");
  if (!numeroDeCuenta) return incompleta("No se encontró el número de cuenta.");

  const desde = iso(periodo[2]!, periodo[3]!, periodo[4]!);
  const hasta = iso(periodo[5]!, periodo[6]!, periodo[7]!);
  const digitos = numeroDeCuenta.texto.replace(/\D/g, "");
  const sinVerificador = numeroDeCuenta.texto.includes("-") ? numeroDeCuenta.texto.replace(/-[\dK]$/i, "").replace(/\D/g, "") : null;

  const filas: FilaDeCartola[] = [];
  let ultimaFecha: string | null = null;
  for (const lineas of lineasPorPagina) {
    const columnas = columnasDe(lineas);
    if (!columnas) continue;
    for (const linea of lineas) {
      if (linea.y >= columnas.y) continue;
      if (FIN_DEL_DETALLE.test(compacto(linea.texto))) break;
      const { fecha: fechaCorta, fila } = leerFila(linea, columnas);
      if (fechaCorta !== null) {
        const [, dia, mes] = FECHA_CORTA.exec(fechaCorta)!;
        ultimaFecha = fechaDeLaFila(dia!, mes!, desde, hasta);
        if (ultimaFecha === null) return incompleta(`La fecha ${fechaCorta} no cae en el periodo de la cartola.`);
      }
      if (fila.monto === undefined || fila.lado === undefined) {
        // Una glosa larga que sigue en la linea de abajo, sin fecha ni monto.
        if (fechaCorta === null && fila.saldo === null && fila.descripcion && filas.length > 0) {
          const anterior = filas.at(-1)!;
          anterior.descripcion = `${anterior.descripcion} ${fila.descripcion}`.trim();
          continue;
        }
        if (fechaCorta !== null) return incompleta(`La fila del ${fechaCorta} no trae un monto claro.`);
        continue;
      }
      if (ultimaFecha === null) return incompleta("Hay un movimiento sin fecha.");
      filas.push({
        fecha: ultimaFecha,
        descripcion: fila.descripcion,
        monto: fila.monto,
        lado: fila.lado,
        documento: fila.documento ?? null,
        saldo: fila.saldo ?? null,
      });
    }
  }

  return {
    ok: true,
    plantilla: PLANTILLA_SANTANDER,
    banco: "Santander",
    tipoDeCuenta: producto ?? "CUENTA_CORRIENTE",
    ultimos4: digitos.slice(-4),
    ultimos4SinVerificador: sinVerificador && sinVerificador.length >= 4 ? sinVerificador.slice(-4) : null,
    numero: Number(periodo[1]),
    desde,
    hasta,
    filas,
    totales: totalesDe(todas),
  };
}
