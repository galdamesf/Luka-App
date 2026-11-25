import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import { crearLector } from "@/dominio/comprobantes/lector";
import type { Lector } from "@/dominio/comprobantes/tipos";
import {
  cambiarMiDireccion,
  leerMiBuzon,
  olvidarCodigoDeGmail,
  procesarCorreo,
  revisarBuzon,
  type OpcionesDelBuzon,
} from "@/datos/buzon";
import { leerBandeja } from "@/datos/movimientos";
import { armarCorreo, correoDelEjemplo, firmaDe, reenvioDeGmail, sinFirmaDe } from "../fixtures/correos/armar";
import { buzonEnMemoria } from "../fixtures/correos/buzon-en-memoria";

/*
  El buzon contra la base, con correos armados como llegan de verdad. Lo que
  tiene que cumplirse siempre:

    - Cada comprobante queda en la cuenta o tarjeta correcta.
    - Un correo reenviado desde una direccion no confirmada no crea nada.
    - El mismo correo dos veces crea un solo movimiento.

  El lector es el de verdad, con las plantillas y sin IA.
*/

let prisma: PrismaClient;
const BASE = "luka.prueba@gmail.com";
const OTRO = "hogar-de-ana";
const AHORA = new Date("2026-11-20T15:00:00Z");
const lector = crearLector();

let yo: string;
let ana: string;
let miDireccion: string;
let direccionDeAna: string;

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
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  ana = await miembroDePrueba(prisma, { hogarId: OTRO, correo: "ana@ejemplo.cl", nombre: "Ana" });
  miDireccion = (await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma })).direccion;
  direccionDeAna = (await leerMiBuzon(OTRO, ana, { base: BASE, db: prisma })).direccion;
});

const opciones = (extra: Partial<OpcionesDelBuzon> = {}): OpcionesDelBuzon => ({
  db: prisma,
  base: BASE,
  lectorPara: () => lector,
  ahora: AHORA,
  // Sin red: Gmail no contesta, salvo en las pruebas del permiso.
  darPermiso: async () => false,
  ...extra,
});

/** La transferencia de Santander, reenviada sola por el filtro del Gmail de quien la recibio. */
function transferencia(desde = "camila@ejemplo.cl", hacia = miDireccion, extra: Parameters<typeof correoDelEjemplo>[1] = {}) {
  return correoDelEjemplo("santander/transferencia-enviada.txt", {
    para: desde,
    idDelMensaje: "<comprobante-0001@santander.cl>",
    arriba: reenvioDeGmail(desde, hacia, "santander.cl"),
    ...extra,
  });
}

async function cuentaSantander(hogarId = HOGAR_INICIAL, miembroId: string | null = yo) {
  return prisma.cuentaBancaria.create({
    data: { hogarId, miembroId, banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678", apodo: "Cuenta sueldo" },
  });
}

const llegadas = (miembroId = yo) =>
  prisma.llegadaAlBuzon.findMany({
    where: { miembroId },
    orderBy: [{ llegoEn: "asc" }, { id: "asc" }],
    select: { resultado: true, remitente: true, detalle: true, movimientoId: true },
  });

describe("un comprobante que llega bien", () => {
  test("queda «Por revisar» con su cuenta, quien lo reenvio, desde que correo y quien lo mando", async () => {
    const cuenta = await cuentaSantander();
    const resultado = await procesarCorreo(await transferencia(), opciones());
    expect(resultado).toMatchObject({ tipo: "leido", resultado: "NUEVO" });

    const movimiento = await prisma.movimiento.findFirstOrThrow({ where: { hogarId: HOGAR_INICIAL } });
    expect(movimiento).toMatchObject({
      estado: "POR_REVISAR",
      tipo: "TRANSFERENCIA",
      monto: 245_000,
      comercio: "Pedro Muñoz Lagos",
      cuentaBancariaId: cuenta.id,
      miembroId: yo,
      reenviadoPor: "camila@ejemplo.cl",
      remitente: "mensajeria@santander.cl",
      reenviadoAMano: false,
    });
    expect(await llegadas()).toEqual([
      { resultado: "NUEVO", remitente: "mensajeria@santander.cl", detalle: "Comprobante de Santander", movimientoId: movimiento.id },
    ]);
  });

  test("la bandeja lo muestra con el nombre de su cuenta", async () => {
    await cuentaSantander();
    await procesarCorreo(await transferencia(), opciones());
    const bandeja = await leerBandeja(HOGAR_INICIAL, { hoy: "2026-11-20" }, prisma);
    expect(bandeja.porRevisar.map((m) => m.cuenta)).toEqual(["Cuenta sueldo · •••• 5678"]);
  });

  test("si dos cuentas terminan igual en bancos distintos, va a la del banco del comprobante", async () => {
    const santander = await cuentaSantander();
    await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Consorcio", tipo: "CUENTA_VISTA", ultimos4: "5678" },
    });
    await procesarCorreo(await transferencia(), opciones());
    expect((await prisma.movimiento.findFirstOrThrow()).cuentaBancariaId).toBe(santander.id);
  });

  test("sin una cuenta que calce, no la confunde con otra: reconoce la suya", async () => {
    const otra = await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "9999" },
    });
    await procesarCorreo(await transferencia(), opciones());
    const { cuentaBancaria } = await prisma.movimiento.findFirstOrThrow({
      select: { cuentaBancaria: { select: { id: true, banco: true, tipo: true, ultimos4: true, miembroId: true } } },
    });
    expect(cuentaBancaria).toMatchObject({ banco: "Santander", tipo: "CUENTA", ultimos4: "5678", miembroId: yo });
    expect(cuentaBancaria!.id).not.toBe(otra.id);
  });

  test("la boleta de Lider, con su PDF, queda en la tarjeta con que se pago", async () => {
    const visa = await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Santander", tipo: "TARJETA_CREDITO", ultimos4: "4821", apodo: "Visa" },
    });
    // Una cuenta de otro banco que termina igual: no es la que pago la boleta.
    await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Consorcio", tipo: "CUENTA_VISTA", ultimos4: "4821" },
    });
    const boleta = await correoDelEjemplo("lider/boleta-digital.txt", {
      idDelMensaje: "<boleta-123@info.lider.cl>",
      arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, "info.lider.cl"),
    });
    expect(await procesarCorreo(boleta, opciones())).toMatchObject({ resultado: "NUEVO" });
    expect(await prisma.movimiento.findFirstOrThrow()).toMatchObject({
      tipo: "BOLETA",
      monto: 6_170,
      ultimos4: "4821",
      medioPago: "CREDITO",
      cuentaBancariaId: visa.id,
      remitente: "contacto@info.lider.cl",
    });
  });

  test("un traspaso a otra cuenta del hogar queda fuera, igual que en la Seccion B", async () => {
    await cuentaSantander();
    // La cuenta de destino (de Banco de Chile, terminada en 7890) tambien es del hogar.
    await prisma.cuentaBancaria.create({
      data: { hogarId: HOGAR_INICIAL, miembroId: yo, banco: "Banco de Chile", tipo: "CUENTA_VISTA", ultimos4: "7890" },
    });
    await procesarCorreo(await transferencia(), opciones());
    expect(await prisma.movimiento.findFirstOrThrow()).toMatchObject({ tipo: "TRASPASO_PROPIO", estado: "IGNORADO" });
  });
});

describe("el mismo correo dos veces", () => {
  test("crea un solo movimiento: el segundo queda como repetido", async () => {
    const correo = await transferencia();
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "NUEVO" });
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "REPETIDO" });
    expect(await prisma.movimiento.count()).toBe(1);
    expect((await llegadas()).map((l) => l.resultado)).toEqual(["NUEVO", "REPETIDO"]);
  });

  test("reenviado a mano dos veces, con otro Message-ID cada vez, tambien es uno solo", async () => {
    const aMano = (id: string) =>
      correoDelEjemplo("reenvios/santander-desde-outlook.txt", {
        para: miDireccion,
        idDelMensaje: id,
        arriba: [
          ["Delivered-To", miDireccion],
          ["Authentication-Results", firmaDe("ejemplo.cl")],
        ],
      });
    expect(await procesarCorreo(await aMano("<reenvio-1@ejemplo.cl>"), opciones())).toMatchObject({ resultado: "NUEVO" });
    expect(await procesarCorreo(await aMano("<reenvio-2@ejemplo.cl>"), opciones())).toMatchObject({ resultado: "REPETIDO" });
    const [movimiento] = await prisma.movimiento.findMany();
    expect(movimiento).toMatchObject({ reenviadoAMano: true, monto: 245_000, remitente: "mensajeria@santander.cl" });
    expect(await prisma.movimiento.count()).toBe(1);
  });

  test("reenviado como archivo adjunto, cuenta como el original: si despues llega solo, es repetido", async () => {
    const original = await correoDelEjemplo("santander/transferencia-enviada.txt", {
      idDelMensaje: "<comprobante-0001@santander.cl>",
      arriba: [["Delivered-To", "camila@ejemplo.cl"]],
    });
    const comoAdjunto = await armarCorreo({
      de: "Camila Rojas <camila@ejemplo.cl>",
      para: miDireccion,
      asunto: "Fwd: Comprobante Transferencia de fondos",
      texto: "Para Luka.",
      idDelMensaje: "<otro-id@ejemplo.cl>",
      adjuntos: [{ nombre: "comprobante.eml", tipo: "message/rfc822", contenido: original }],
      arriba: [
        ["Delivered-To", miDireccion],
        ["Authentication-Results", firmaDe("ejemplo.cl")],
      ],
    });
    expect(await procesarCorreo(comoAdjunto, opciones())).toMatchObject({ resultado: "NUEVO" });
    expect(await prisma.movimiento.findFirstOrThrow()).toMatchObject({ reenviadoAMano: true, monto: 245_000 });

    expect(await procesarCorreo(await transferencia(), opciones())).toMatchObject({ resultado: "REPETIDO" });
    expect(await prisma.movimiento.count()).toBe(1);
  });
});

describe("quien lo reenvio", () => {
  test("desde un correo registrado pero sin confirmar no crea nada, y queda anotado por que", async () => {
    await prisma.correoRegistrado.create({ data: { miembroId: yo, direccion: "camila@hotmail.com", proveedor: "OUTLOOK" } });
    const correo = await transferencia("camila@hotmail.com");
    expect(await procesarCorreo(correo, opciones())).toEqual({ tipo: "leido", resultado: "SIN_CONFIRMAR" });
    expect(await prisma.movimiento.count()).toBe(0);
    expect(await llegadas()).toEqual([{ resultado: "SIN_CONFIRMAR", remitente: "camila@hotmail.com", detalle: null, movimientoId: null }]);

    // Con el correo confirmado, el mismo comprobante si se lee.
    await prisma.correoRegistrado.updateMany({ where: { miembroId: yo }, data: { confirmadoEn: AHORA } });
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "NUEVO" });
    expect((await prisma.movimiento.findFirstOrThrow()).reenviadoPor).toBe("camila@hotmail.com");
  });

  test("desde un correo que nadie registro, tampoco", async () => {
    const correo = await transferencia("alguien@desconocido.cl");
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "SIN_CONFIRMAR" });
    expect(await prisma.movimiento.count()).toBe(0);
  });

  test("con «De: tu correo» pero sin la firma de tu correo, no se lee aunque abajo diga que si", async () => {
    const falso = await correoDelEjemplo("reenvios/santander-desde-outlook.txt", {
      para: miDireccion,
      arriba: [
        ["Delivered-To", miDireccion],
        ["Authentication-Results", sinFirmaDe("ejemplo.cl")],
        // Uno inventado mas abajo: no cuenta, el que vale es el de arriba.
        ["Authentication-Results", firmaDe("ejemplo.cl")],
      ],
    });
    expect(await procesarCorreo(falso, opciones())).toEqual({ tipo: "leido", resultado: "SIN_FIRMA" });
    expect(await prisma.movimiento.count()).toBe(0);
    expect((await llegadas())[0]).toMatchObject({ resultado: "SIN_FIRMA", remitente: "camila@ejemplo.cl" });
  });

  test("tu correo no sirve en el buzon de otra persona", async () => {
    const correo = await transferencia("camila@ejemplo.cl", direccionDeAna);
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "SIN_CONFIRMAR" });
    expect(await prisma.movimiento.count()).toBe(0);
    expect(await llegadas(ana)).toHaveLength(1);
    expect(await llegadas(yo)).toHaveLength(0);
  });

  test("lo que llega al buzon de Ana queda en el hogar de Ana, con las cuentas de su hogar", async () => {
    await cuentaSantander();
    const deAna = await cuentaSantander(OTRO, ana);
    await procesarCorreo(await transferencia("ana@ejemplo.cl", direccionDeAna), opciones());
    const [movimiento] = await prisma.movimiento.findMany();
    expect(movimiento).toMatchObject({ hogarId: OTRO, miembroId: ana, cuentaBancariaId: deAna.id });
  });
});

describe("lo que no es un comprobante", () => {
  test("la publicidad y la cartola no crean movimientos, pero quedan anotadas", async () => {
    const publicidad = await correoDelEjemplo("santander/publicidad.txt", {
      idDelMensaje: "<publicidad@santander.cl>",
      arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, "comunicaciones.santander.cl"),
    });
    const cartola = await correoDelEjemplo("consorcio/cartola.txt", {
      idDelMensaje: "<cartola@bancoconsorcio.cl>",
      arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, "bancoconsorcio.cl"),
    });
    expect(await procesarCorreo(publicidad, opciones())).toMatchObject({ resultado: "NO_ES_COMPROBANTE" });
    expect(await procesarCorreo(cartola, opciones())).toMatchObject({ resultado: "CARTOLA" });
    expect(await prisma.movimiento.count()).toBe(0);
    expect((await llegadas()).map((l) => l.resultado)).toEqual(["NO_ES_COMPROBANTE", "CARTOLA"]);
  });

  test("un correo que no va a ninguna direccion de Luka no se toca", async () => {
    const soporte = await armarCorreo({
      de: "persona@ejemplo.cl",
      para: BASE,
      asunto: "Consulta",
      texto: "Hola, ¿cómo conecto mi banco?",
      arriba: [["Delivered-To", BASE]],
    });
    expect(await procesarCorreo(soporte, opciones())).toEqual({ tipo: "ajeno" });
  });

  test("una direccion de Luka que ya no es de nadie se descarta sin leer", async () => {
    const correo = await transferencia("camila@ejemplo.cl", "luka.prueba+clavevieja@gmail.com");
    expect(await procesarCorreo(correo, opciones())).toEqual({ tipo: "leido", resultado: "SIN_DUENO" });
    expect(await prisma.movimiento.count()).toBe(0);
    expect(await prisma.llegadaAlBuzon.count()).toBe(0);
  });
});

describe("la confirmacion de reenvio de Gmail", () => {
  const confirmacion = (firma: string) =>
    armarCorreo({
      de: "Equipo de Gmail <forwarding-noreply@google.com>",
      para: miDireccion,
      asunto: "(#987654321) Confirmación de reenvío de Gmail - Recibir correo de camila@ejemplo.cl",
      texto: `camila@ejemplo.cl solicitó reenviar automáticamente los correos a tu dirección ${miDireccion}.\nCódigo de confirmación: 987654321\nPara permitirlo, haz clic en el enlace: https://mail-settings.google.com/mail/vf-ejemplo`,
      arriba: [
        ["Delivered-To", miDireccion],
        ["Authentication-Results", firma],
      ],
    });

  test("si Gmail no acepto el enlace, deja el codigo y el enlace a la vista de quien es el buzon", async () => {
    expect(await procesarCorreo(await confirmacion(firmaDe("google.com")), opciones())).toMatchObject({
      resultado: "CONFIRMACION_DE_GMAIL",
    });
    const buzon = await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA });
    expect(buzon.codigoDeGmail).toEqual({
      codigo: "987654321",
      enlace: "https://mail-settings.google.com/mail/vf-ejemplo",
      de: "camila@ejemplo.cl",
      llegoEn: AHORA,
    });
    expect(buzon.reenvioAceptado).toBeNull();
    expect(buzon.llegadas[0]).toMatchObject({ resultado: "CONFIRMACION_DE_GMAIL", remitente: "camila@ejemplo.cl" });

    // Despues de una semana ya no se muestra, y se puede sacar antes.
    const despues = new Date(AHORA.getTime() + 8 * 24 * 60 * 60_000);
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: despues })).codigoDeGmail).toBeNull();
    await olvidarCodigoDeGmail(HOGAR_INICIAL, yo, prisma);
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA })).codigoDeGmail).toBeNull();
  });

  test("una falsa, sin la firma de Google, no deja ningun codigo", async () => {
    expect(await procesarCorreo(await confirmacion(sinFirmaDe("google.com")), opciones())).toMatchObject({ resultado: "SIN_CONFIRMAR" });
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma })).codigoDeGmail).toBeNull();
  });

  // Como llega desde 2026: sin codigo, solo con los enlaces para aceptar y para cancelar.
  const ACEPTAR = "https://mail-settings.google.com/mail/vf-%5BANGjdJ9x2Qa7%5D-Zq8w3Lk1mN0pR5tY";
  const CANCELAR = "https://mail-settings.google.com/mail/uf-%5BANGjdJ-B4c7%5D-Zq8w3Lk1mN0pR5tY";
  const confirmacionNueva = (solicitante: string) =>
    armarCorreo({
      de: "El equipo de Gmail <forwarding-noreply@google.com>",
      para: miDireccion,
      asunto: `(Gmail Confirmación de reenvío - Recibir correos de ${solicitante}`,
      texto: [
        `${solicitante} solicitó reenviar automáticamente el correo electrónico a tu dirección ${miDireccion}.`,
        `Para permitir que ${solicitante} reenvíe el correo electrónico automáticamente a tu dirección, haz clic en el siguiente vínculo para confirmar la solicitud:`,
        ACEPTAR,
        "Si no quieres permitirlo, haz clic en este vínculo para cancelar la verificación:",
        CANCELAR,
      ].join("\n"),
      arriba: [
        ["Delivered-To", miDireccion],
        ["Authentication-Results", firmaDe("google.com")],
      ],
    });

  test("si la pidio un correo suyo, Luka da el permiso sola: abre el enlace para aceptar, una vez", async () => {
    const abiertos: string[] = [];
    const darPermiso = async (enlace: string) => {
      abiertos.push(enlace);
      return true;
    };
    const buzon = buzonEnMemoria([await confirmacionNueva("camila@ejemplo.cl")]);
    expect(await revisarBuzon(buzon, opciones({ darPermiso }))).toMatchObject({ revisados: 1, sinMovimiento: 0, pendientes: 0 });
    expect(buzon.quedan()).toBe(0);
    expect(abiertos).toEqual([ACEPTAR]);

    const mio = await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA });
    expect(mio.codigoDeGmail).toBeNull();
    expect(mio.reenvioAceptado).toEqual({ de: "camila@ejemplo.cl", llegoEn: AHORA });
    expect(mio.llegadas[0]).toMatchObject({ resultado: "REENVIO_CONFIRMADO", remitente: "camila@ejemplo.cl" });

    // Una direccion nueva necesita su propio permiso.
    await cambiarMiDireccion(HOGAR_INICIAL, yo, BASE, prisma);
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA })).reenvioAceptado).toBeNull();
  });

  test("si Gmail no contesto que lo acepto, el enlace queda para darlo con un toque", async () => {
    expect(await procesarCorreo(await confirmacionNueva("camila@ejemplo.cl"), opciones())).toMatchObject({
      resultado: "CONFIRMACION_DE_GMAIL",
    });
    const mio = await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA });
    expect(mio.codigoDeGmail).toEqual({ codigo: null, enlace: ACEPTAR, de: "camila@ejemplo.cl", llegoEn: AHORA });
    expect(mio.reenvioAceptado).toBeNull();
    await olvidarCodigoDeGmail(HOGAR_INICIAL, yo, prisma);
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA })).codigoDeGmail).toBeNull();
  });

  test("pedida desde un correo que no es suyo, el enlace ni se abre ni se muestra", async () => {
    const abiertos: string[] = [];
    const darPermiso = async (enlace: string) => {
      abiertos.push(enlace);
      return true;
    };
    expect(await procesarCorreo(await confirmacionNueva("intruso@ejemplo.cl"), opciones({ darPermiso }))).toMatchObject({
      resultado: "SIN_CONFIRMAR",
    });
    expect(abiertos).toEqual([]);
    const mio = await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma, ahora: AHORA });
    expect(mio.codigoDeGmail).toBeNull();
    expect(mio.reenvioAceptado).toBeNull();
    expect(mio.llegadas[0]).toMatchObject({ resultado: "SIN_CONFIRMAR", remitente: "intruso@ejemplo.cl" });
  });
});

describe("la direccion de cada persona", () => {
  test("se crea una vez, con su clave, y no cambia al volver a leerla", async () => {
    expect(miDireccion).toMatch(/^luka\.prueba\+[a-z0-9]{10}@gmail\.com$/);
    expect((await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma })).direccion).toBe(miDireccion);
    expect(direccionDeAna).not.toBe(miDireccion);
  });

  test("Gmail ignora los puntos y las mayusculas: la direccion igual llega", async () => {
    const clave = miDireccion.slice(miDireccion.indexOf("+") + 1, miDireccion.indexOf("@"));
    const correo = await transferencia("camila@ejemplo.cl", `LukaPrueba+${clave.toUpperCase()}@googlemail.com`);
    expect(await procesarCorreo(correo, opciones())).toMatchObject({ resultado: "NUEVO" });
  });

  test("al cambiarla, la anterior deja de servir", async () => {
    const nueva = await cambiarMiDireccion(HOGAR_INICIAL, yo, BASE, prisma);
    expect(nueva).not.toBe(miDireccion);
    expect(await procesarCorreo(await transferencia("camila@ejemplo.cl", miDireccion), opciones())).toMatchObject({
      resultado: "SIN_DUENO",
    });
    expect(await procesarCorreo(await transferencia("camila@ejemplo.cl", nueva), opciones())).toMatchObject({ resultado: "NUEVO" });
  });

  test("de lo que llega se guardan las ultimas 30 llegadas", async () => {
    const correo = await transferencia();
    for (let i = 0; i < 33; i++) await procesarCorreo(correo, opciones({ ahora: new Date(AHORA.getTime() + i * 1000) }));
    expect(await prisma.llegadaAlBuzon.count({ where: { miembroId: yo } })).toBe(30);
    expect(await prisma.movimiento.count()).toBe(1);
  });

  test("si la persona sale del hogar, su buzon y lo que llego se van; el movimiento se queda, sin ella", async () => {
    await procesarCorreo(await transferencia(), opciones());
    await prisma.miembro.delete({ where: { id: yo } });
    expect(await prisma.buzon.count({ where: { miembroId: yo } })).toBe(0);
    expect(await prisma.llegadaAlBuzon.count({ where: { miembroId: yo } })).toBe(0);
    expect(await prisma.movimiento.findFirstOrThrow()).toMatchObject({ miembroId: null, reenviadoPor: "camila@ejemplo.cl" });
  });
});

describe("una revision del buzon", () => {
  test("lee y borra lo que es para Luka, y deja el correo de soporte donde estaba", async () => {
    await cuentaSantander();
    const soporte = await armarCorreo({ de: "persona@ejemplo.cl", para: BASE, asunto: "Hola", texto: "Una consulta", arriba: [["Delivered-To", BASE]] });
    const buzon = buzonEnMemoria([
      await transferencia(),
      await transferencia(), // repetido
      await transferencia("alguien@desconocido.cl"),
      soporte,
    ]);
    const resumen = await revisarBuzon(buzon, opciones());
    expect(resumen).toEqual({
      revisados: 3,
      nuevos: 1,
      repetidos: 1,
      sinMovimiento: 0,
      rechazados: 1,
      pendientes: 0,
      cartolas: 0,
      esperanClave: 0,
    });
    expect(buzon.quedan()).toBe(1);
    expect(await prisma.movimiento.count()).toBe(1);
  });

  test("si el lector falla por algo pasajero, el correo se queda para la proxima", async () => {
    const fallaUnaVez: Lector = async () => {
      throw new Error("La IA no contestó (529)");
    };
    const buzon = buzonEnMemoria([await transferencia()]);
    expect(await revisarBuzon(buzon, opciones({ lectorPara: () => fallaUnaVez }))).toMatchObject({ revisados: 1, pendientes: 1 });
    expect(buzon.quedan()).toBe(1);
    expect(await prisma.llegadaAlBuzon.count()).toBe(0);

    // A la proxima, con la IA de vuelta, se lee y se borra.
    expect(await revisarBuzon(buzon, opciones())).toMatchObject({ nuevos: 1, pendientes: 0 });
    expect(buzon.quedan()).toBe(0);
  });
});
