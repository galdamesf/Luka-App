import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import type { LecturaLeida } from "@/dominio/comprobantes/tipos";
import { crearLector } from "@/dominio/comprobantes/lector";
import {
  ErrorDeCartola,
  bancosConClave,
  guardarClaveDeCartola,
  leerCartolaEnPdf,
  leerCartolasDelHogar,
  quitarClaveDeCartola,
} from "@/datos/cartolas";
import { leerBandeja, registrarMovimiento } from "@/datos/movimientos";
import { leerMiBuzon, procesarCorreo, revisarBuzon, type OpcionesDelBuzon } from "@/datos/buzon";
import * as consorcio from "../fixtures/cartolas/consorcio";
import { OCTUBRE, conSaldos, pdfDeEjemplo, type CartolaDeEjemplo } from "../fixtures/cartolas/santander";
import { armarCorreo, reenvioDeGmail } from "../fixtures/correos/armar";
import { buzonEnMemoria } from "../fixtures/correos/buzon-en-memoria";

/*
  La cartola contra la base. Lo que tiene que cumplirse siempre:

    - Una cartola trae todos sus movimientos, y lo que ya estaba anotado
      (porque llego por correo, o porque la cartola ya se leyo) se reconoce
      y no se duplica.
    - Si lo que se leyo no cuadra con los totales del banco, no se anota nada.
    - La clave del PDF se guarda cifrada y nunca sale.

  Las cartolas son de ejemplo, con datos inventados (tests/fixtures/cartolas).
*/

let prisma: PrismaClient;
const MAESTRA = Buffer.alloc(32, 9);
const opciones = () => ({ db: prisma, maestra: MAESTRA });
const CON_CLAVE = new Uint8Array(readFileSync(join(__dirname, "../fixtures/cartolas/santander-con-clave.pdf")));
const CLAVE = "12345678";

let yo: string;
let pareja: string;
let cuenta: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  yo = await miembroDePrueba(prisma, { correo: "camila@ejemplo.cl", nombre: "Camila Rojas" });
  pareja = await miembroDePrueba(prisma, { correo: "pedro@ejemplo.cl", nombre: "Pedro", rol: "MIEMBRO" });
  cuenta = (
    await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" },
    })
  ).id;
});

let huellas = 0;
/** Un movimiento que llego por correo, como lo deja el buzon. */
async function porCorreo(lectura: Partial<LecturaLeida> & Pick<LecturaLeida, "tipo" | "monto" | "fecha" | "comercio">) {
  huellas += 1;
  return registrarMovimiento(
    HOGAR_INICIAL,
    {
      huella: huellas.toString(16).padStart(64, "0"),
      lectura: { ok: true, sentido: "gasto", moneda: "CLP", fuente: "Comprobante de Santander", via: "plantilla", plantilla: "santander/transferencia-enviada", ...lectura },
      recibidoEn: new Date("2026-10-30T12:00:00Z"),
      miembroId: yo,
    },
    prisma,
  );
}

/** La transferencia a Pedro y la boleta de Lider, que llegaron por correo antes que la cartola. */
async function loQueLlegoPorCorreo() {
  const transferencia = await porCorreo({
    tipo: "TRANSFERENCIA",
    monto: 26_000,
    fecha: "2026-10-05",
    comercio: "PEDRO ANTONIO SOTO DIAZ",
    ultimos4: "5678",
    contraparte: { nombre: "PEDRO ANTONIO SOTO DIAZ", banco: "BCI", ultimos4: "1111" },
  });
  const boleta = await porCorreo({
    tipo: "BOLETA",
    monto: 17_500,
    fecha: "2026-10-22",
    comercio: "Líder",
    fuente: "Boleta de Líder",
    plantilla: "lider/boleta",
    medioPago: "DEBITO",
    ultimos4: "9999",
  });
  return { transferencia, boleta };
}

async function leer(c: CartolaDeEjemplo = OCTUBRE, extra: Partial<Parameters<typeof leerCartolaEnPdf>[1]> = {}) {
  return leerCartolaEnPdf(HOGAR_INICIAL, { pdf: await pdfDeEjemplo(c), miembroId: yo, ...extra }, opciones());
}

describe("leer la cartola", () => {
  test("trae lo que no tuvo aviso y reconoce lo que ya estaba: nada se duplica", async () => {
    const { transferencia, boleta } = await loQueLlegoPorCorreo();

    const leida = await leer();
    expect(leida).toMatchObject({
      ok: true,
      yaLeida: false,
      cartola: {
        banco: "Santander",
        ultimos4: "5678",
        cuenta: "Cuenta corriente •••• 5678",
        desde: "2026-09-30",
        hasta: "2026-10-30",
        filas: 10,
        nuevas: 4,
        yaEstaban: 2,
        fuera: 4,
        cargos: 156_656,
        abonos: 1_366_000,
      },
    });

    // En la bandeja: lo que llego por correo, una sola vez, y lo nuevo de la cartola.
    const bandeja = await leerBandeja(HOGAR_INICIAL, { hoy: "2026-11-01" }, prisma);
    expect(bandeja.porRevisar.map((m) => m.comercio).sort()).toEqual(
      ["Líder", "Luis Muñoz", "NETFLIX.COM", "PEDRO ANTONIO SOTO DIAZ", "PELUQUERIA EL CORTE", "Santander · COMISION MANTENCION PLAN"].sort(),
    );
    const delCorreo = await prisma.movimiento.findMany({
      where: { id: { in: [transferencia.id, boleta.id] } },
      select: { estado: true, juntados: { select: { fuente: true, cartolaId: true } } },
    });
    for (const movimiento of delCorreo) {
      expect(movimiento.estado).toBe("POR_REVISAR");
      expect(movimiento.juntados).toEqual([{ fuente: "Cartola de Santander", cartolaId: leida.ok ? leida.cartola.id : "" }]);
    }

    // Cada fila de la cartola, en su cuenta; los ingresos y el giro, fuera.
    const filas = await prisma.movimiento.findMany({ where: { cartolaId: { not: null } }, select: { estado: true, cuentaBancariaId: true, tipo: true } });
    expect(filas).toHaveLength(10);
    expect(new Set(filas.map((f) => f.cuentaBancariaId))).toEqual(new Set([cuenta]));
    expect(filas.filter((f) => f.estado === "IGNORADO").map((f) => f.tipo).sort()).toEqual(["ABONO", "ABONO", "ABONO", "GIRO"]);
    expect(filas.filter((f) => f.estado === "JUNTADO")).toHaveLength(2);
  });

  test("la misma cartola otra vez, o en la otra version del PDF, no anota nada", async () => {
    const primera = await leer();
    const antes = await prisma.movimiento.count();
    expect(await leer()).toMatchObject({ ok: true, yaLeida: true, cartola: { nuevas: 6, filas: 10 } });
    expect(await leer({ ...OCTUBRE, estilo: "suelta" })).toMatchObject({ ok: true, yaLeida: true });
    expect(await prisma.movimiento.count()).toBe(antes);
    expect(await prisma.cartola.count()).toBe(1);
    expect(primera.ok && (await leerCartolasDelHogar(HOGAR_INICIAL, { db: prisma }))[0]?.id).toBe(primera.ok ? primera.cartola.id : "");
  });

  test("si no cuadra con los totales del banco, no anota nada", async () => {
    const leida = await leer({ ...OCTUBRE, totales: { saldoInicial: 669, depositos: 0, otrosAbonos: 1_366_000, cheques: 0, otrosCargos: 150_000, impuestos: 0, saldoFinal: 1_216_669 } });
    expect(leida).toEqual({
      ok: false,
      motivo: "no-cuadra",
      banco: "Santander",
      mensaje: "Lo que Luka leyó no suma lo que dice el banco, así que no anotó nada. Los cargos suman $156.656 y el banco dice $150.000.",
    });
    expect(await prisma.movimiento.count()).toBe(0);
    expect(await prisma.cartola.count()).toBe(0);
  });

  test("un comprobante que llega despues se junta con su fila, y queda a la vista el del correo", async () => {
    await leer();
    const netflix = await porCorreo({ tipo: "COMPRA", monto: 7_990, fecha: "2026-10-22", comercio: "Netflix", fuente: "Recibo de Netflix", plantilla: "netflix/recibo" });
    expect(netflix).toMatchObject({ nuevo: true, juntado: true, estado: "POR_REVISAR" });
    const fila = await prisma.movimiento.findFirstOrThrow({ where: { comercio: "NETFLIX.COM" }, select: { estado: true, juntadoConId: true } });
    expect(fila).toEqual({ estado: "JUNTADO", juntadoConId: netflix.id });
    const bandeja = await leerBandeja(HOGAR_INICIAL, { hoy: "2026-11-01" }, prisma);
    expect(bandeja.porRevisar.filter((m) => m.monto === 7_990).map((m) => m.comercio)).toEqual(["Netflix"]);
  });

  test("si despues llega la boleta, todo el grupo queda bajo ella: el aviso del banco y la fila de la cartola", async () => {
    const aviso = await porCorreo({ tipo: "COMPRA", monto: 17_500, fecha: "2026-10-23", comercio: "Compra en LIDER", fuente: "Aviso de compra", plantilla: "banco/compra", ultimos4: "9999" });
    await leer();
    const fila = await prisma.movimiento.findFirstOrThrow({ where: { comercio: "LIDER EXPRESS" }, select: { id: true, juntadoConId: true } });
    expect(fila.juntadoConId).toBe(aviso.id);

    const boleta = await porCorreo({ tipo: "BOLETA", monto: 17_500, fecha: "2026-10-23", comercio: "Líder", fuente: "Boleta de Líder", plantilla: "lider/boleta", ultimos4: "9999" });
    expect(boleta).toMatchObject({ nuevo: true, juntado: true, estado: "POR_REVISAR" });
    const grupo = await prisma.movimiento.findMany({ where: { juntadoConId: boleta.id }, select: { id: true }, orderBy: { id: "asc" } });
    expect(grupo.map((m) => m.id).sort()).toEqual([aviso.id, fila.id].sort());
    const bandeja = await leerBandeja(HOGAR_INICIAL, { hoy: "2026-11-01" }, prisma);
    expect(bandeja.porRevisar.filter((m) => m.monto === 17_500).map((m) => m.comercio)).toEqual(["Líder"]);
  });

  test("lo que alguien ya confirmo o descarto no vuelve a la bandeja", async () => {
    const { transferencia, boleta } = await loQueLlegoPorCorreo();
    await prisma.movimiento.update({ where: { id: transferencia.id }, data: { estado: "CONFIRMADO", destino: "GASTO_NUEVO" } });
    await prisma.movimiento.update({ where: { id: boleta.id }, data: { estado: "DESCARTADO" } });

    expect(await leer()).toMatchObject({ ok: true, cartola: { nuevas: 4, yaEstaban: 2 } });
    expect(await prisma.movimiento.findUniqueOrThrow({ where: { id: transferencia.id }, select: { estado: true } })).toEqual({ estado: "CONFIRMADO" });
    expect(await prisma.movimiento.findUniqueOrThrow({ where: { id: boleta.id }, select: { estado: true } })).toEqual({ estado: "DESCARTADO" });
    const bandeja = await leerBandeja(HOGAR_INICIAL, { hoy: "2026-11-01" }, prisma);
    expect(bandeja.porRevisar.map((m) => m.monto)).not.toContain(26_000);
    expect(bandeja.porRevisar.map((m) => m.monto)).not.toContain(17_500);
  });

  test("dos transferencias iguales el mismo dia a dos personas: solo se junta la de la misma persona", async () => {
    const { transferencia } = await loQueLlegoPorCorreo();
    const leida = await leer({
      desde: "30/09/2026",
      hasta: "30/10/2026",
      saldoInicial: 100_000,
      filas: conSaldos(100_000, [
        { fecha: "05/10", codigo: "0123456785", glosa: "Transf a Ana Rojas", cargo: 26_000 },
        { fecha: "05/10", codigo: "0987654321", glosa: "Transf a Pedro Soto", cargo: 26_000 },
      ]),
    });
    expect(leida).toMatchObject({ ok: true, cartola: { nuevas: 1, yaEstaban: 1, fuera: 0 } });
    const deLaCartola = await prisma.movimiento.findMany({ where: { cartolaId: { not: null } }, select: { comercio: true, estado: true, juntadoConId: true } });
    expect(deLaCartola).toEqual(
      expect.arrayContaining([
        { comercio: "Ana Rojas", estado: "POR_REVISAR", juntadoConId: null },
        { comercio: "Pedro Soto", estado: "JUNTADO", juntadoConId: transferencia.id },
      ]),
    );
  });

  test("la cuenta se reconoce tambien por los 4 digitos de antes del verificador", async () => {
    await prisma.cuentaBancaria.update({ where: { id: cuenta }, data: { ultimos4: "4567", apodo: "La del sueldo" } });
    expect(await leer()).toMatchObject({ ok: true, cartola: { cuenta: "La del sueldo · •••• 4567", ultimos4: "5678" } });
    const filas = await prisma.movimiento.findMany({ where: { cartolaId: { not: null } }, select: { cuentaBancariaId: true, ultimos4: true } });
    expect(filas.every((f) => f.cuentaBancariaId === cuenta && f.ultimos4 === "4567")).toBe(true);
  });

  test("de una cuenta que no estaba en «Tus bancos», la cartola la deja, con su tipo", async () => {
    await prisma.cuentaBancaria.delete({ where: { id: cuenta } });
    expect(await leer()).toMatchObject({ ok: true, cartola: { cuenta: "Cuenta corriente •••• 5678", nuevas: 6 } });
    expect(await prisma.cuentaBancaria.findMany({ select: { banco: true, tipo: true, ultimos4: true, miembroId: true } })).toEqual([
      { banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678", miembroId: yo },
    ]);
  });

  test("a una cuenta que Luka reconocio con un aviso, sin tipo, la cartola le pone el suyo", async () => {
    await prisma.cuentaBancaria.update({ where: { id: cuenta }, data: { tipo: "CUENTA", apodo: null } });
    expect(await leer()).toMatchObject({ ok: true, cartola: { cuenta: "Cuenta corriente •••• 5678" } });
    expect(await prisma.cuentaBancaria.findUniqueOrThrow({ where: { id: cuenta }, select: { tipo: true } })).toEqual({ tipo: "CUENTA_CORRIENTE" });
  });

  test("la de Consorcio, de varias hojas: a su cuenta por los 4 digitos, con los ingresos y el giro fuera", async () => {
    const sueldo = (
      await prisma.cuentaBancaria.create({
        data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Consorcio", tipo: "CUENTA_CORRIENTE", ultimos4: "2345", apodo: "Sueldo" },
      })
    ).id;
    const leida = await leerCartolaEnPdf(HOGAR_INICIAL, { pdf: await consorcio.pdfDeEjemplo(consorcio.OCTUBRE), miembroId: yo }, opciones());
    expect(leida).toMatchObject({
      ok: true,
      yaLeida: false,
      cartola: { banco: "Consorcio", ultimos4: "2345", cuenta: "Sueldo · •••• 2345", desde: "2026-10-01", hasta: "2026-10-31", filas: 11, yaEstaban: 0, cargos: 174_100, abonos: 1_268_000 },
    });
    const filas = await prisma.movimiento.findMany({ where: { cartolaId: { not: null } }, select: { estado: true, cuentaBancariaId: true, tipo: true, fuente: true } });
    expect(filas).toHaveLength(11);
    expect(filas.every((f) => f.cuentaBancariaId === sueldo && f.fuente === "Cartola de Consorcio")).toBe(true);
    expect(filas.filter((f) => f.estado === "IGNORADO").map((f) => f.tipo).sort()).toEqual(["ABONO", "ABONO", "GIRO"]);
  });

  test("un archivo que no es una cartola que Luka sepa leer", async () => {
    expect(await leerCartolaEnPdf(HOGAR_INICIAL, { pdf: new TextEncoder().encode("hola"), miembroId: yo }, opciones())).toMatchObject({
      ok: false,
      motivo: "no-se-pudo-abrir",
      mensaje: "No se pudo abrir el archivo: ¿es el PDF de la cartola?",
    });
    expect(await leer({ ...OCTUBRE, sinPeriodo: true })).toMatchObject({
      ok: false,
      motivo: "incompleta",
      mensaje: "Luka no pudo leer toda la cartola: No se encontró el periodo de la cartola (desde y hasta).",
    });
  });
});

describe("la clave del PDF", () => {
  test("se guarda cifrada, por persona y banco, y nunca sale", async () => {
    expect(await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Banco Santander", CLAVE, opciones())).toEqual({ banco: "Santander" });
    const guardada = await prisma.claveDeCartola.findFirstOrThrow({ where: { miembroId: yo } });
    expect(guardada.banco).toBe("Santander");
    expect(guardada.cifrada).not.toContain(CLAVE);
    expect(await bancosConClave(yo, { db: prisma })).toEqual(["Santander"]);
    expect(await bancosConClave(pareja, { db: prisma })).toEqual([]);

    // Guardarla de nuevo la cambia, sin duplicarla.
    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", "87654321", opciones());
    expect(await prisma.claveDeCartola.count()).toBe(1);
    await quitarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", { db: prisma });
    expect(await prisma.claveDeCartola.count()).toBe(0);
  });

  test("solo de los bancos cuyas cartolas Luka sabe leer, y de alguien del hogar", async () => {
    await expect(guardarClaveDeCartola(HOGAR_INICIAL, yo, "Scotiabank", CLAVE, opciones())).rejects.toThrow(
      new ErrorDeCartola("Luka todavía no sabe leer las cartolas de Scotiabank."),
    );
    expect(await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Banco Consorcio", "1234", opciones())).toEqual({ banco: "Consorcio" });
    await expect(guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", "  ", opciones())).rejects.toThrow("Escribe la clave del PDF.");
    await prisma.hogar.create({ data: { id: "otro", nombre: "Otro" } });
    const ajeno = await miembroDePrueba(prisma, { hogarId: "otro", correo: "ajeno@ejemplo.cl" });
    await expect(guardarClaveDeCartola(HOGAR_INICIAL, ajeno, "Santander", CLAVE, opciones())).rejects.toThrow("Esa persona no es de este hogar.");
  });

  test("con clave: sin ella se pide, la escrita abre y se recuerda, y despues abre sola", async () => {
    const subir = (extra: Partial<Parameters<typeof leerCartolaEnPdf>[1]> = {}) =>
      leerCartolaEnPdf(HOGAR_INICIAL, { pdf: CON_CLAVE, miembroId: yo, ...extra }, opciones());

    expect(await subir()).toMatchObject({ ok: false, motivo: "falta-la-clave", mensaje: "El PDF tiene clave. Escríbela: el correo del banco dice cuál es." });
    expect(await subir({ clave: "00000000" })).toMatchObject({ ok: false, motivo: "clave-incorrecta" });
    expect(await subir({ clave: CLAVE, recordarClave: true })).toMatchObject({ ok: true, yaLeida: false, cartola: { filas: 10 } });
    expect(await bancosConClave(yo, { db: prisma })).toEqual(["Santander"]);
    expect(await subir()).toMatchObject({ ok: true, yaLeida: true });
  });

  test("la clave guardada de otra persona del hogar tambien sirve; una equivocada se avisa", async () => {
    await guardarClaveDeCartola(HOGAR_INICIAL, pareja, "Santander", CLAVE, opciones());
    expect(await leerCartolaEnPdf(HOGAR_INICIAL, { pdf: CON_CLAVE, miembroId: yo }, opciones())).toMatchObject({ ok: true });

    await limpiar(prisma);
    yo = await miembroDePrueba(prisma, { correo: "camila@ejemplo.cl" });
    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", "11111111", opciones());
    expect(await leerCartolaEnPdf(HOGAR_INICIAL, { pdf: CON_CLAVE, miembroId: yo }, opciones())).toEqual({
      ok: false,
      motivo: "clave-incorrecta",
      banco: null,
      mensaje: "La clave guardada no abre este PDF. Escríbela de nuevo: el correo del banco dice cuál es.",
    });
  });
});

describe("la cartola que llega al buzon", () => {
  const BASE = "luka.prueba@gmail.com";
  let miDireccion: string;

  beforeEach(async () => {
    miDireccion = (await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma })).direccion;
  });

  const opcionesDelBuzon = (): OpcionesDelBuzon => ({
    db: prisma,
    base: BASE,
    lectorPara: () => crearLector(),
    ahora: new Date("2026-11-01T12:00:00Z"),
    maestra: MAESTRA,
  });

  /** El correo de Santander con la cartola, reenviado solo por el filtro de Gmail. */
  const correoDeLaCartola = () =>
    armarCorreo({
      de: "mensajeria@santander.cl",
      para: "camila@ejemplo.cl",
      asunto: "Cuenta Corriente Persona",
      idDelMensaje: "<cartola-0001@santander.cl>",
      html: "<p>Estimado(a) CLIENTE DE PRUEBA: Ya puedes revisar tu cartola de este mes. Por tu seguridad, el archivo PDF adjunto está encriptado.</p>",
      adjuntos: [{ nombre: "LCA_CTA_CTE_CRONO-0000_0000000.pdf", tipo: "application/octet-stream", contenido: CON_CLAVE }],
      arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, "santander.cl"),
    });

  test("sin la clave se queda en el buzon, y se anota una sola vez", async () => {
    const correo = await correoDeLaCartola();
    expect(await procesarCorreo(correo, opcionesDelBuzon())).toEqual({
      tipo: "reintentar",
      motivo: "Falta la clave del PDF de la cartola.",
      porLaClave: true,
    });
    expect(await procesarCorreo(correo, opcionesDelBuzon())).toMatchObject({ tipo: "reintentar" });
    const llegadas = await prisma.llegadaAlBuzon.findMany({ where: { miembroId: yo }, select: { resultado: true, remitente: true } });
    expect(llegadas).toEqual([{ resultado: "CARTOLA_SIN_CLAVE", remitente: "mensajeria@santander.cl" }]);
    expect(await prisma.movimiento.count()).toBe(0);
  });

  test("con la clave guardada se lee sola, y lo que dice queda anotado", async () => {
    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", CLAVE, opciones());
    expect(await procesarCorreo(await correoDeLaCartola(), opcionesDelBuzon())).toEqual({ tipo: "leido", resultado: "CARTOLA_LEIDA" });
    const llegada = await prisma.llegadaAlBuzon.findFirstOrThrow({ where: { miembroId: yo }, select: { resultado: true, detalle: true } });
    expect(llegada).toEqual({ resultado: "CARTOLA_LEIDA", detalle: "Cartola de Santander del 30 sep al 30 oct: 6 por revisar, 0 ya estaban, 4 fuera." });
    const filas = await prisma.movimiento.findMany({ where: { cartolaId: { not: null } }, select: { miembroId: true, remitente: true } });
    expect(filas).toHaveLength(10);
    expect(filas.every((f) => f.miembroId === yo && f.remitente === "mensajeria@santander.cl")).toBe(true);

    // La misma cartola reenviada otra vez: ya estaba.
    expect(await procesarCorreo(await correoDeLaCartola(), opcionesDelBuzon())).toEqual({ tipo: "leido", resultado: "CARTOLA_LEIDA" });
    expect(await prisma.movimiento.count({ where: { cartolaId: { not: null } } })).toBe(10);
  });

  test("la revision la cuenta aparte: primero espera la clave y, con la clave, se lee y sale del buzon", async () => {
    const buzon = buzonEnMemoria([await correoDeLaCartola()]);
    expect(await revisarBuzon(buzon, opcionesDelBuzon())).toMatchObject({ revisados: 1, esperanClave: 1, pendientes: 0, cartolas: 0 });
    expect(buzon.quedan()).toBe(1);

    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", CLAVE, opciones());
    expect(await revisarBuzon(buzon, opcionesDelBuzon())).toMatchObject({ revisados: 1, esperanClave: 0, cartolas: 1, nuevos: 0 });
    expect(buzon.quedan()).toBe(0);
    expect(await prisma.movimiento.count({ where: { cartolaId: { not: null } } })).toBe(10);
  });
});
