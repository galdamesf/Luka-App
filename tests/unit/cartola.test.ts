import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  BANCOS_CON_CARTOLA,
  PISTA_DE_LA_CLAVE,
  claveDeLaCartola,
  clavesDeLasFilas,
  cuadrar,
  leerCartola,
  lecturaDeLaFila,
  type CartolaLeida,
  type FilaDeCartola,
  type PaginaDeCartola,
} from "@/dominio/cartolas";
import { armarLineas, leerPesos } from "@/dominio/cartolas/lineas";
import { elegirPareja, nombresEnComun, sonLaMismaCompra, type CandidatoParaJuntar, type MovimientoParaJuntar } from "@/dominio/movimientos";
import { abrirCartola } from "@/lib/cartola-pdf";
import { cifrarClaveDeCartola, descifrarClaveDeCartola } from "@/lib/claves-de-cartola";
import * as consorcio from "../fixtures/cartolas/consorcio";
import { OCTUBRE, conSaldos, paginasDeEjemplo, pdfDeEjemplo, type CartolaDeEjemplo } from "../fixtures/cartolas/santander";

/**
 * La cartola del mes: leerla de las paginas del PDF, cuadrarla con los
 * totales del banco y convertir sus filas en lecturas. Todo con cartolas de
 * ejemplo de datos inventados (tests/fixtures/cartolas).
 */

function leidaDeLasPaginas(paginas: PaginaDeCartola[]): CartolaLeida {
  const lectura = leerCartola(paginas);
  if (!lectura.ok) throw new Error(`No se leyo: ${lectura.detalle}`);
  return lectura;
}

const leida = (c: CartolaDeEjemplo) => leidaDeLasPaginas(paginasDeEjemplo(c));
const leidaDeConsorcio = (c: consorcio.CartolaDeEjemplo) => leidaDeLasPaginas(consorcio.paginasDeEjemplo(c));

/** Una pagina con estos textos, uno debajo del otro. */
function paginaCon(...textos: string[]): PaginaDeCartola {
  return { numero: 1, ancho: 612, alto: 792, piezas: textos.map((texto, i) => ({ x: 40, y: 760 - i * 20, ancho: texto.length * 5, alto: 10, texto })) };
}

describe("leer la cartola de Santander", () => {
  test("de la cuenta, el periodo y el numero", () => {
    const cartola = leida(OCTUBRE);
    expect(cartola).toMatchObject({
      plantilla: "santander/cuenta-corriente",
      banco: "Santander",
      tipoDeCuenta: "CUENTA_CORRIENTE",
      ultimos4: "5678",
      ultimos4SinVerificador: "4567",
      numero: 9,
      desde: "2026-09-30",
      hasta: "2026-10-30",
    });
  });

  test("cada fila con su fecha, su lado segun la columna, su documento y el saldo del dia", () => {
    const { filas } = leida(OCTUBRE);
    expect(filas).toHaveLength(10);
    expect(filas[0]).toEqual({ fecha: "2026-10-05", descripcion: "Transf de Ana Rojas", monto: 26_000, lado: "abono", documento: null, saldo: null });
    expect(filas[1]).toMatchObject({ descripcion: "Transf a Pedro Soto", lado: "cargo", saldo: 669 });
    expect(filas[3]).toMatchObject({ descripcion: "Transf. ANA MARIA ROJAS PEREZ", documento: "5000000", lado: "abono", monto: 140_000 });
    expect(filas[5]).toMatchObject({ fecha: "2026-10-23", descripcion: "Compra Nacional MD LIDER EXPRESS", documento: "2951010", monto: 17_500 });
  });

  test("las dos versiones del PDF (el texto cortado de dos maneras) se leen igual", () => {
    expect(leida({ ...OCTUBRE, estilo: "suelta" })).toEqual(leida({ ...OCTUBRE, estilo: "junta" }));
  });

  test("el RUT de la otra persona no queda en la glosa", () => {
    const glosas = leida(OCTUBRE).filas.map((f) => f.descripcion).join(" ");
    expect(glosas).not.toMatch(/0123456785|013468268K|\d{9}[\dK]/);
  });

  test("lo del resumen de comisiones no se cuenta dos veces", () => {
    const { filas } = leida(OCTUBRE);
    expect(filas.filter((f) => f.descripcion === "COMISION MANTENCION PLAN")).toHaveLength(1);
  });

  test("una cartola que cruza el anio pone cada fecha en su anio", () => {
    const filas = leida({
      desde: "30/12/2026",
      hasta: "30/01/2027",
      filas: [
        { fecha: "31/12", glosa: "Compra Nacional MD LIDER", cargo: 1_000 },
        { fecha: "05/01", glosa: "Compra Nacional MD LIDER", cargo: 2_000 },
      ],
      saldoInicial: 10_000,
    }).filas;
    expect(filas.map((f) => f.fecha)).toEqual(["2026-12-31", "2027-01-05"]);
  });

  test("los totales del resumen: depositos y otros abonos, cheques, otros cargos e impuestos", () => {
    expect(leida(OCTUBRE).totales).toEqual({ saldoInicial: 669, abonos: 1_366_000, cargos: 156_656, saldoFinal: 1_210_013 });
  });

  test("sin el periodo o sin el numero de cuenta, no se lee", () => {
    expect(leerCartola(paginasDeEjemplo({ ...OCTUBRE, sinPeriodo: true }))).toMatchObject({ ok: false, motivo: "incompleta", banco: "Santander" });
    expect(leerCartola(paginasDeEjemplo({ ...OCTUBRE, cuenta: null }))).toMatchObject({ ok: false, motivo: "incompleta" });
  });

  test("la cartola de un banco que Luka no sabe leer dice cual es", () => {
    expect(leerCartola([paginaCon("SCOTIABANK", "Cartola")])).toMatchObject({
      ok: false,
      motivo: "formato-desconocido",
      banco: "Scotiabank",
      detalle: "Luka todavía no sabe leer las cartolas de Scotiabank.",
    });
    expect(leerCartola([])).toMatchObject({ ok: false, motivo: "formato-desconocido", banco: null });
  });
});

describe("leer la cartola de Consorcio", () => {
  const texto = (paginas: PaginaDeCartola[]) => paginas.flatMap((p) => armarLineas(p).map((l) => l.texto)).join("\n");

  test("se reconoce por su forma, aunque no diga Consorcio: la cuenta, el periodo y el numero", () => {
    expect(texto(consorcio.paginasDeEjemplo(consorcio.OCTUBRE))).not.toMatch(/consorcio/i);
    expect(leidaDeConsorcio(consorcio.OCTUBRE)).toMatchObject({
      plantilla: "consorcio/cuenta-corriente",
      banco: "Consorcio",
      tipoDeCuenta: "CUENTA_CORRIENTE",
      ultimos4: "2345",
      ultimos4SinVerificador: null,
      numero: 102026,
      desde: "2026-10-01",
      hasta: "2026-10-31",
    });
  });

  test("cada fila con su fecha, su lado segun la columna, el numero de la operacion y el saldo que dejo", () => {
    const { filas } = leidaDeConsorcio(consorcio.OCTUBRE);
    expect(filas).toHaveLength(11);
    expect(filas[0]).toEqual({ fecha: "2026-10-01", descripcion: "COMPRAS POS FARMACIA AHUMA", monto: 4_590, lado: "cargo", documento: "100000000303", saldo: 795_410 });
    // El banco de la otra persona viene en su propio pedazo, y queda en la glosa.
    expect(filas[1]).toMatchObject({ descripcion: "TEF ANA ROJAS BANCO DE C", documento: "100000000202", lado: "cargo", monto: 12_500, saldo: 782_910 });
    expect(filas[5]).toMatchObject({ fecha: "2026-10-02", descripcion: "TEF PEDRO SOTO GAJARDO", lado: "abono", monto: 18_000, saldo: 751_690 });
    // "PAGO DE REMUNERACIONES -": el banco corta lo que sigue, y el guion sobra.
    expect(filas[6]).toMatchObject({ fecha: "2026-10-05", descripcion: "PAGO DE REMUNERACIONES", documento: "10000000077", lado: "abono", monto: 1_250_000, saldo: 2_001_690 });
  });

  test("las de un mismo dia quedan en el orden de sus saldos, no en el que vienen, y cuadra", () => {
    const paginas = texto(consorcio.paginasDeEjemplo(consorcio.OCTUBRE));
    expect(paginas.indexOf("LIDER EXPRESS")).toBeLessThan(paginas.indexOf("FARMACIA AHUMA"));
    const cartola = leidaDeConsorcio(consorcio.OCTUBRE);
    expect(cartola.filas.map((f) => f.descripcion)).toEqual([
      "COMPRAS POS FARMACIA AHUMA",
      "TEF ANA ROJAS BANCO DE C",
      "COMPRAS POS LIDER EXPRESS",
      "COMPRAS POS PANADERIA LA E",
      "GIRO EN CAJERO AUTOMATICO",
      "TEF PEDRO SOTO GAJARDO",
      "PAGO DE REMUNERACIONES",
      "COMPRA WEBPAY CINE PLANET",
      "TEF NOMBRE DESTINATARIO",
      "TEF CAMILA ROJAS SCOTIABANK",
      "COMISION MANTENCION",
    ]);
    expect(cuadrar(cartola)).toEqual({ cuadra: true, problemas: [], cargos: 174_100, abonos: 1_268_000 });
  });

  test("un dia en que dos filas pueden ir primero (una compra, su reversa y otra compra) tambien se ordena", () => {
    const cartola = leidaDeConsorcio({
      desde: "01/10/2026",
      hasta: "31/10/2026",
      saldoInicial: 70_000,
      filas: consorcio.conSaldos(70_000, [
        { fecha: "03/10/2026", glosa: "COMPRAS POS CAFE", cargo: 2_500 },
        { fecha: "03/10/2026", glosa: "REVERSA COMPRAS POS CAFE", abono: 2_500 },
        { fecha: "03/10/2026", glosa: "COMPRAS POS LIBRERIA", cargo: 3_700 },
      ]),
    });
    expect(cartola.filas.map((f) => f.descripcion)).toEqual(["COMPRAS POS CAFE", "REVERSA COMPRAS POS CAFE", "COMPRAS POS LIBRERIA"]);
    expect(cuadrar(cartola).cuadra).toBe(true);
  });

  test("el encabezado y el resumen van en cada pagina: nada se cuenta dos veces, y los totales salen del resumen", () => {
    expect(consorcio.paginasDeEjemplo(consorcio.OCTUBRE)).toHaveLength(3);
    const cartola = leidaDeConsorcio(consorcio.OCTUBRE);
    expect(cartola.filas).toHaveLength(11);
    expect(cartola.totales).toEqual({ saldoInicial: 800_000, cargos: 174_100, abonos: 1_268_000, saldoFinal: 1_893_900 });
  });

  test("un saldo que no calza con nada o un monto mal leido no cuadran", () => {
    // El 02/10, la compra en la panaderia con $1.000 de mas en su saldo: ese dia no se puede ordenar.
    const conUnSaldoMalo = leidaDeConsorcio({ ...consorcio.OCTUBRE, filas: consorcio.OCTUBRE.filas.map((f, i) => (i === 3 ? { ...f, saldo: f.saldo! + 1_000 } : f)) });
    expect(cuadrar(conUnSaldoMalo)).toMatchObject({ cuadra: false, problemas: ["El saldo del 02/10 da $769.040 y la cartola dice $751.690."] });

    const cartola = leidaDeConsorcio(consorcio.OCTUBRE);
    const conUnMontoMalo = { ...cartola, filas: cartola.filas.map((f, i) => (i === 0 ? { ...f, monto: 4_500 } : f)) };
    expect(cuadrar(conUnMontoMalo).problemas).toEqual([
      "Los cargos suman $174.010 y el banco dice $174.100.",
      "El saldo del 01/10 da $795.500 y la cartola dice $795.410.",
    ]);
  });

  test("sin el periodo, sin el numero de cuenta o con una fila fuera del periodo, no se lee", () => {
    const sinLeer = (c: consorcio.CartolaDeEjemplo) => leerCartola(consorcio.paginasDeEjemplo(c));
    expect(sinLeer({ ...consorcio.OCTUBRE, sinPeriodo: true })).toEqual({
      ok: false,
      motivo: "incompleta",
      banco: "Consorcio",
      detalle: "No se encontró el periodo de la cartola (desde y hasta).",
    });
    expect(sinLeer({ ...consorcio.OCTUBRE, cuenta: null })).toMatchObject({ ok: false, motivo: "incompleta", detalle: "No se encontró el número de cuenta." });
    expect(sinLeer({ ...consorcio.OCTUBRE, filas: [{ fecha: "01/11/2026", glosa: "COMPRAS POS CAFE", cargo: 2_500 }] })).toMatchObject({
      ok: false,
      motivo: "incompleta",
      detalle: "La fecha 01/11/2026 no cae en el periodo de la cartola.",
    });
  });

  test("una cartola de Consorcio en un formato que Luka no conoce lo dice asi", () => {
    expect(leerCartola([paginaCon("BANCO CONSORCIO", "Cartola")])).toMatchObject({
      ok: false,
      motivo: "formato-desconocido",
      banco: "Consorcio",
      detalle: "Esta cartola de Consorcio viene en un formato que Luka todavía no conoce.",
    });
  });

  test("Luka sabe leer las de Santander y las de Consorcio, y dice cual es la clave de cada una", () => {
    expect(BANCOS_CON_CARTOLA).toEqual(["Santander", "Consorcio"]);
    expect(PISTA_DE_LA_CLAVE.Consorcio).toBe("el RUT del titular de la cuenta, pero solo sus últimos 4 dígitos y sin el dígito verificador");
  });

  test("la clave de la cartola, y una distinta para cada fila", () => {
    const cartola = leidaDeConsorcio(consorcio.OCTUBRE);
    expect(claveDeLaCartola(cartola)).toBe("cartola|Consorcio|2345|102026|2026-10-01|2026-10-31");
    expect(new Set(clavesDeLasFilas(cartola)).size).toBe(11);
  });
});

describe("de una fila de la cartola de Consorcio a la lectura", () => {
  const cartola = leidaDeConsorcio(consorcio.OCTUBRE);
  const lectura = (descripcion: string) => lecturaDeLaFila(cartola.filas.find((f) => f.descripcion === descripcion)!, cartola);

  test("una compra con la tarjeta de debito, en el local o por internet", () => {
    expect(lectura("COMPRAS POS FARMACIA AHUMA")).toMatchObject({
      ok: true,
      tipo: "COMPRA",
      sentido: "gasto",
      monto: 4_590,
      fecha: "2026-10-01",
      comercio: "FARMACIA AHUMA",
      medioPago: "DEBITO",
      fuente: "Cartola de Consorcio",
      via: "plantilla",
      plantilla: "consorcio/cuenta-corriente",
      ultimos4: "2345",
    });
    expect(lectura("COMPRA WEBPAY CINE PLANET")).toMatchObject({ tipo: "COMPRA", comercio: "CINE PLANET", medioPago: "DEBITO" });
  });

  test("una transferencia: la persona sin el banco del final; si el banco no supo el nombre, solo «Transferencia»", () => {
    expect(lectura("TEF ANA ROJAS BANCO DE C")).toMatchObject({ tipo: "TRANSFERENCIA", sentido: "gasto", comercio: "ANA ROJAS", contraparte: { nombre: "ANA ROJAS" }, medioPago: "TRANSFERENCIA" });
    expect(lectura("TEF CAMILA ROJAS SCOTIABANK")).toMatchObject({ tipo: "TRANSFERENCIA", comercio: "CAMILA ROJAS", contraparte: { nombre: "CAMILA ROJAS" } });
    expect(lectura("TEF PEDRO SOTO GAJARDO")).toMatchObject({ tipo: "ABONO", sentido: "ingreso", comercio: "PEDRO SOTO GAJARDO" });
    const sinNombre = lectura("TEF NOMBRE DESTINATARIO");
    expect(sinNombre).toMatchObject({ tipo: "TRANSFERENCIA", sentido: "gasto", comercio: "Transferencia", medioPago: "TRANSFERENCIA" });
    expect(sinNombre).not.toHaveProperty("contraparte");
  });

  test("el giro, el sueldo y lo que cobra el banco", () => {
    expect(lectura("GIRO EN CAJERO AUTOMATICO")).toMatchObject({ tipo: "GIRO", sentido: "gasto" });
    expect(lectura("PAGO DE REMUNERACIONES")).toMatchObject({ tipo: "ABONO", sentido: "ingreso", comercio: "PAGO DE REMUNERACIONES", monto: 1_250_000 });
    expect(lectura("COMISION MANTENCION")).toMatchObject({ tipo: "PAGO", comercio: "Consorcio · COMISION MANTENCION" });
  });
});

describe("cuadrar", () => {
  test("lo leido suma lo que dice el banco, y cada saldo diario calza", () => {
    expect(cuadrar(leida(OCTUBRE))).toEqual({ cuadra: true, problemas: [], cargos: 156_656, abonos: 1_366_000 });
  });

  test("si falta una fila, no cuadra", () => {
    const cartola = leida(OCTUBRE);
    const sinUna = { ...cartola, filas: cartola.filas.filter((_, i) => i !== 6) };
    const cuadre = cuadrar(sinUna);
    expect(cuadre.cuadra).toBe(false);
    expect(cuadre.problemas[0]).toBe("Los cargos suman $148.666 y el banco dice $156.656.");
  });

  test("un cargo leido como abono descuadra el saldo del dia aunque los totales calcen", () => {
    const cartola = leida(OCTUBRE);
    // Dos movimientos del 05/10 por lo mismo: si se invierten, las sumas calzan pero el saldo no.
    const filas: FilaDeCartola[] = cartola.filas.map((f, i) => (i < 2 ? { ...f, lado: f.lado === "cargo" ? "abono" : "cargo" } : f));
    filas[0] = { ...filas[0]!, saldo: 669 };
    filas[1] = { ...filas[1]!, saldo: null };
    const cuadre = cuadrar({ ...cartola, filas });
    expect(cuadre.cuadra).toBe(false);
    expect(cuadre.problemas).toEqual(["El saldo del 05/10 da $-25.331 y la cartola dice $669."]);
  });

  test("con el resumen equivocado, no cuadra", () => {
    const cartola = leida({ ...OCTUBRE, totales: { saldoInicial: 669, depositos: 0, otrosAbonos: 1_366_000, cheques: 0, otrosCargos: 150_000, impuestos: 0, saldoFinal: 1_216_669 } });
    expect(cuadrar(cartola)).toMatchObject({ cuadra: false, problemas: ["Los cargos suman $156.656 y el banco dice $150.000."] });
  });

  test("sin el resumen no se puede cuadrar", () => {
    const cartola = leida({ ...OCTUBRE, totales: null });
    expect(cartola.totales).toBeNull();
    expect(cuadrar(cartola)).toMatchObject({ cuadra: false, problemas: ["La cartola no trae el resumen con sus totales, y sin él no se puede cuadrar."] });
  });
});

describe("de la fila a la lectura", () => {
  const cartola = leida(OCTUBRE);
  const lectura = (i: number) => lecturaDeLaFila(cartola.filas[i]!, cartola);

  test("una compra con debito: el comercio sin la glosa del banco", () => {
    expect(lectura(5)).toMatchObject({
      ok: true,
      tipo: "COMPRA",
      sentido: "gasto",
      monto: 17_500,
      moneda: "CLP",
      fecha: "2026-10-23",
      comercio: "LIDER EXPRESS",
      medioPago: "DEBITO",
      fuente: "Cartola de Santander",
      via: "plantilla",
      plantilla: "santander/cuenta-corriente",
      ultimos4: "5678",
    });
    expect(lectura(6)).toMatchObject({ tipo: "COMPRA", comercio: "NETFLIX.COM", medioPago: "DEBITO" });
  });

  test("una transferencia que sale es un gasto con la persona; una que entra, un abono", () => {
    expect(lectura(1)).toMatchObject({ tipo: "TRANSFERENCIA", sentido: "gasto", comercio: "Pedro Soto", contraparte: { nombre: "Pedro Soto" }, medioPago: "TRANSFERENCIA" });
    expect(lectura(0)).toMatchObject({ tipo: "ABONO", sentido: "ingreso", comercio: "Ana Rojas" });
    expect(lectura(3)).toMatchObject({ tipo: "ABONO", sentido: "ingreso", comercio: "ANA MARIA ROJAS PEREZ" });
  });

  test("el giro y lo que cobra el banco", () => {
    expect(lectura(8)).toMatchObject({ tipo: "GIRO", sentido: "gasto" });
    expect(lectura(9)).toMatchObject({ tipo: "PAGO", comercio: "Santander · COMISION MANTENCION PLAN" });
  });

  test("el pago de la tarjeta y un cargo que no se sabe que es", () => {
    const fila = (descripcion: string): FilaDeCartola => ({ fecha: "2026-10-10", descripcion, monto: 50_000, lado: "cargo", documento: null, saldo: null });
    expect(lecturaDeLaFila(fila("Pago Tarjeta de Credito"), cartola)).toMatchObject({ tipo: "PAGO_TARJETA" });
    expect(lecturaDeLaFila(fila("CARGO VARIOS"), cartola)).toMatchObject({ tipo: "CARGO", comercio: "CARGO VARIOS" });
  });
});

describe("las claves de las filas y de la cartola", () => {
  test("no cambian entre las dos versiones del PDF, y dos filas iguales el mismo dia se distinguen", () => {
    const junta = leida(OCTUBRE);
    expect(clavesDeLasFilas(leida({ ...OCTUBRE, estilo: "suelta" }))).toEqual(clavesDeLasFilas(junta));
    expect(claveDeLaCartola(junta)).toBe("cartola|Santander|5678|9|2026-09-30|2026-10-30");

    const dosCafes = leida({
      desde: "30/09/2026",
      hasta: "30/10/2026",
      saldoInicial: 10_000,
      filas: conSaldos(10_000, [
        { fecha: "05/10", glosa: "Compra Nacional MD CAFE", documento: "1111111", cargo: 1_000 },
        { fecha: "05/10", glosa: "Compra Nacional MD CAFE", documento: "1111111", cargo: 1_000 },
      ]),
    });
    const [a, b] = clavesDeLasFilas(dosCafes);
    expect(a).not.toBe(b);
  });
});

describe("las palabras de la pagina", () => {
  test("cada palabra de un pedazo con su posicion, y las lineas de arriba hacia abajo", () => {
    const lineas = armarLineas({
      numero: 1,
      ancho: 600,
      alto: 800,
      piezas: [
        { x: 100, y: 500, ancho: 50, alto: 8, texto: "abajo" },
        { x: 32, y: 600, ancho: 80, alto: 8, texto: "05/10 O.Gerencia" },
        { x: 200, y: 600.8, ancho: 20, alto: 8, texto: "1.000" },
      ],
    });
    expect(lineas.map((l) => l.texto)).toEqual(["05/10 O.Gerencia 1.000", "abajo"]);
    expect(lineas[0]!.palabras[1]).toEqual({ x: 62, fin: 112, texto: "O.Gerencia" });
  });

  test("los montos en pesos", () => {
    expect(leerPesos("1.200.000")).toBe(1_200_000);
    expect(leerPesos("669")).toBe(669);
    expect(leerPesos("-1.500")).toBe(-1_500);
    expect(leerPesos("2951010")).toBeNull();
    expect(leerPesos("2026-07-29")).toBeNull();
  });
});

describe("abrir el PDF", () => {
  const conClave = new Uint8Array(readFileSync(join(__dirname, "../fixtures/cartolas/santander-con-clave.pdf")));

  test("un PDF de verdad, con el texto en sus posiciones, se lee igual que las paginas", async () => {
    const pdf = await abrirCartola(await pdfDeEjemplo(OCTUBRE));
    expect(pdf.ok).toBe(true);
    if (!pdf.ok) return;
    const lectura = leerCartola(pdf.paginas);
    expect(lectura.ok && lectura.filas).toEqual(leida(OCTUBRE).filas);
  });

  test("un PDF de Consorcio de varias hojas se lee igual que sus paginas", async () => {
    const pdf = await abrirCartola(await consorcio.pdfDeEjemplo(consorcio.OCTUBRE));
    expect(pdf.ok && pdf.paginas).toHaveLength(3);
    if (!pdf.ok) return;
    expect(leerCartola(pdf.paginas)).toEqual({ ok: true, ...leidaDeConsorcio(consorcio.OCTUBRE) });
  });

  test("con clave: sin ella falta, con otra no abre, con la del banco si", async () => {
    expect(await abrirCartola(conClave)).toEqual({ ok: false, motivo: "falta-la-clave" });
    expect(await abrirCartola(conClave, "00000000")).toEqual({ ok: false, motivo: "clave-incorrecta" });
    const abierto = await abrirCartola(conClave, "12345678");
    expect(abierto.ok).toBe(true);
    if (abierto.ok) expect(cuadrar(leida(OCTUBRE)).cuadra && leerCartola(abierto.paginas).ok).toBe(true);
  });

  test("lo que no es un PDF, o uno demasiado grande, no se abre", async () => {
    expect(await abrirCartola(new TextEncoder().encode("hola"))).toEqual({ ok: false, motivo: "no-se-pudo-abrir" });
    expect(await abrirCartola(new Uint8Array(9 * 1024 * 1024))).toEqual({ ok: false, motivo: "muy-grande" });
  });
});

describe("la clave del PDF, cifrada", () => {
  const maestra = Buffer.alloc(32, 7);

  test("se cifra distinto cada vez, no se ve, y vuelve igual", () => {
    const a = cifrarClaveDeCartola("12345678", "m-1", "Santander", maestra);
    const b = cifrarClaveDeCartola("12345678", "m-1", "Santander", maestra);
    expect(a).not.toBe(b);
    expect(a).not.toContain("12345678");
    expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(descifrarClaveDeCartola(a, "m-1", "Santander", maestra)).toBe("12345678");
  });

  test("no abre como la de otra persona, de otro banco ni con otra maestra", () => {
    const cifrada = cifrarClaveDeCartola("12345678", "m-1", "Santander", maestra);
    expect(() => descifrarClaveDeCartola(cifrada, "m-2", "Santander", maestra)).toThrow();
    expect(() => descifrarClaveDeCartola(cifrada, "m-1", "BCI", maestra)).toThrow();
    expect(() => descifrarClaveDeCartola(cifrada, "m-1", "Santander", Buffer.alloc(32, 8))).toThrow();
  });
});

describe("juntar una fila de la cartola con lo que ya estaba", () => {
  const base: MovimientoParaJuntar = {
    estado: "POR_REVISAR",
    tipo: "TRANSFERENCIA",
    sentido: "GASTO",
    monto: 26_000,
    moneda: "CLP",
    fecha: "2026-10-05",
    ultimos4: "5678",
    sinDetalle: false,
    cartolaId: null,
    cuentaBancariaId: "cuenta-1",
    comercio: "Pedro Soto Díaz",
  };
  const fila: MovimientoParaJuntar = { ...base, cartolaId: "cartola-1", comercio: "Pedro Soto" };
  const candidato = (cambios: Partial<CandidatoParaJuntar> = {}): CandidatoParaJuntar => ({ ...base, id: "m-1", tieneJuntado: false, ...cambios });

  test("la misma transferencia: mismo monto y lado, hasta tres dias, misma cuenta y el mismo nombre", () => {
    expect(sonLaMismaCompra(fila, base)).toBe(true);
    expect(sonLaMismaCompra(base, fila)).toBe(true);
    expect(sonLaMismaCompra(fila, { ...base, fecha: "2026-10-08" })).toBe(true);
    expect(sonLaMismaCompra(fila, { ...base, fecha: "2026-10-09" })).toBe(false);
    expect(sonLaMismaCompra(fila, { ...base, monto: 26_001 })).toBe(false);
    expect(sonLaMismaCompra(fila, { ...base, cuentaBancariaId: "cuenta-2" })).toBe(false);
    expect(sonLaMismaCompra(fila, { ...base, cuentaBancariaId: null })).toBe(true);
  });

  test("dos transferencias iguales a dos personas no se confunden", () => {
    expect(sonLaMismaCompra(fila, { ...base, comercio: "Ana Rojas" })).toBe(false);
    expect(nombresEnComun("Transf a Pedro Soto", "PEDRO ANTONIO SOTO DIAZ")).toBe(2);
  });

  test("una compra de la cartola calza con la boleta de la tienda y con el aviso sin detalle", () => {
    const compra: MovimientoParaJuntar = { ...fila, tipo: "COMPRA", comercio: "LIDER EXPRESS", monto: 17_500, fecha: "2026-10-23" };
    expect(sonLaMismaCompra(compra, { ...base, tipo: "BOLETA", comercio: "Líder", monto: 17_500, fecha: "2026-10-22", cuentaBancariaId: null })).toBe(true);
    expect(sonLaMismaCompra(compra, { ...base, tipo: "CARGO", sinDetalle: true, comercio: "Cargo en cuenta", monto: 17_500, fecha: "2026-10-23" })).toBe(true);
    expect(sonLaMismaCompra(compra, { ...base, tipo: "ABONO", sentido: "INGRESO", monto: 17_500, fecha: "2026-10-23" })).toBe(false);
  });

  test("dos filas de cartola solo se juntan si son de dos cartolas de la misma cuenta, el mismo dia", () => {
    expect(sonLaMismaCompra(fila, { ...fila })).toBe(false);
    expect(sonLaMismaCompra(fila, { ...fila, cartolaId: "cartola-2" })).toBe(true);
    expect(sonLaMismaCompra(fila, { ...fila, cartolaId: "cartola-2", fecha: "2026-10-06" })).toBe(false);
    expect(sonLaMismaCompra(fila, { ...fila, cartolaId: "cartola-2", cuentaBancariaId: null })).toBe(false);
  });

  test("lo que llego por correo dice mas: queda a la vista, salvo un aviso sin detalle", () => {
    expect(elegirPareja(fila, [candidato()])?.principal).toBe("candidato");
    expect(elegirPareja(base, [{ ...fila, id: "f-1", tieneJuntado: false }])?.principal).toBe("nuevo");
    const avisoSinDetalle = candidato({ tipo: "CARGO", sinDetalle: true, comercio: "Cargo en cuenta" });
    expect(elegirPareja(fila, [avisoSinDetalle])?.principal).toBe("nuevo");
  });

  test("con una fila de la cartola cuenta tambien lo descartado, y manda lo que alguien decidio", () => {
    expect(elegirPareja(fila, [candidato({ estado: "DESCARTADO" })])).toMatchObject({ principal: "candidato" });
    expect(elegirPareja(fila, [candidato({ estado: "DESCARTADO", tipo: "CARGO", sinDetalle: true })])).toMatchObject({ principal: "candidato" });
    expect(elegirPareja(base, [{ ...fila, id: "f-1", tieneJuntado: false, estado: "DESCARTADO" }])).toBeNull();
  });

  test("cada movimiento se junta con una sola fila de cartola, aunque ya tenga su otra mitad", () => {
    expect(elegirPareja(fila, [candidato({ tieneJuntado: true })])).not.toBeNull();
    expect(elegirPareja(fila, [candidato({ tieneJuntadoDeCartola: true })])).toBeNull();
  });

  test("de varios posibles, el del mismo nombre antes que el mas cercano", () => {
    const pareja = elegirPareja(fila, [
      candidato({ id: "ana", comercio: "Pedro Rojas", fecha: "2026-10-05" }),
      candidato({ id: "pedro", comercio: "PEDRO SOTO", fecha: "2026-10-06" }),
    ]);
    expect(pareja?.candidato.id).toBe("pedro");
  });
});
