import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import { crearLector } from "@/dominio/comprobantes/lector";
import { fechaDesdeISO } from "@/lib/fecha";
import type { Correo } from "@/lib/correo";
import { leerMiBuzon, procesarCorreo, revisarBuzon, type OpcionesDelBuzon } from "@/datos/buzon";
import { leerLosBancosDelHogar } from "@/datos/bancos";
import { guardarClaveDeCartola } from "@/datos/cartolas";
import {
  ErrorAlConectar,
  cambiarResumenDiario,
  cartolaQueEsperaClave,
  enviarResumenesDiarios,
  leerParaConectar,
  marcarMisBancos,
} from "@/datos/conectar";
import { armarCorreo, correoDelEjemplo, firmaDe, reenvioDeGmail } from "../fixtures/correos/armar";
import { buzonEnMemoria } from "../fixtures/correos/buzon-en-memoria";

/*
  Conectar los correos contra la base (seccion E). Lo que tiene que cumplirse
  siempre:

    - Una persona nueva no escribe ningun numero de cuenta: con el primer
      aviso, su cuenta queda en el hogar, como suya.
    - La cartola que espera su clave se pide en Inicio hasta que se lee.
    - El resumen diario llega una vez al dia, solo a quien lo quiere y solo
      si hay algo que contar.
*/

let prisma: PrismaClient;
const BASE = "luka.prueba@gmail.com";
const AHORA = new Date("2026-11-24T12:00:00Z");
const MAESTRA = Buffer.alloc(32, 7);
const lector = crearLector();
const CON_CLAVE = new Uint8Array(readFileSync(join(__dirname, "../fixtures/cartolas/santander-con-clave.pdf")));
const CLAVE = "12345678";

let yo: string;
let pareja: string;
let miDireccion: string;

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
  miDireccion = (await leerMiBuzon(HOGAR_INICIAL, yo, { base: BASE, db: prisma })).direccion;
});

const opciones = (extra: Partial<OpcionesDelBuzon> = {}): OpcionesDelBuzon => ({
  db: prisma,
  base: BASE,
  lectorPara: () => lector,
  ahora: AHORA,
  maestra: MAESTRA,
  ...extra,
});

/** Un correo de ejemplo, reenviado solo por el filtro del Gmail de Camila. */
function reenviado(ruta: string, id: string, dominio: string) {
  return correoDelEjemplo(ruta, { para: "camila@ejemplo.cl", idDelMensaje: `<${id}@${dominio}>`, arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, dominio) });
}

const cuentas = () =>
  prisma.cuentaBancaria.findMany({ orderBy: { creadoEn: "asc" }, select: { banco: true, tipo: true, ultimos4: true, miembroId: true } });

describe("las cuentas que Luka reconoce sola", () => {
  test("con el primer aviso, la cuenta queda en el hogar como de quien lo reenvio, y el movimiento en ella", async () => {
    expect(await procesarCorreo(await reenviado("santander/transferencia-enviada.txt", "t-1", "santander.cl"), opciones())).toMatchObject({
      resultado: "NUEVO",
    });
    expect(await cuentas()).toEqual([{ banco: "Santander", tipo: "CUENTA", ultimos4: "5678", miembroId: yo }]);
    const { cuentaBancaria } = await prisma.movimiento.findFirstOrThrow({ select: { cuentaBancaria: { select: { ultimos4: true } } } });
    expect(cuentaBancaria).toEqual({ ultimos4: "5678" });
  });

  test("con el segundo aviso de la misma cuenta no se repite", async () => {
    await procesarCorreo(await reenviado("santander/transferencia-enviada.txt", "t-1", "santander.cl"), opciones());
    await procesarCorreo(await reenviado("santander/pago-de-cuenta.txt", "p-1", "santander.cl"), opciones());
    expect(await cuentas()).toHaveLength(1);
    expect(await prisma.movimiento.count({ where: { cuentaBancariaId: { not: null } } })).toBe(2);
  });

  test("el aviso de BancoEstado a quien recibe no deja una cuenta: la suya es de otro banco", async () => {
    await procesarCorreo(await reenviado("bancoestado/transferencia-recibida.txt", "b-1", "correo.bancoestado.cl"), opciones());
    expect(await prisma.movimiento.count()).toBe(1);
    expect(await cuentas()).toEqual([]);
  });

  test("lo que llega desde un correo sin confirmar no deja nada", async () => {
    const ajeno = await correoDelEjemplo("santander/transferencia-enviada.txt", {
      para: "alguien@ejemplo.cl",
      idDelMensaje: "<t-2@santander.cl>",
      arriba: reenvioDeGmail("alguien@ejemplo.cl", miDireccion, "santander.cl"),
    });
    expect(await procesarCorreo(ajeno, opciones())).toMatchObject({ resultado: "SIN_CONFIRMAR" });
    expect(await cuentas()).toEqual([]);
  });
});

describe("los bancos de cada persona", () => {
  test("se marcan con su nombre del catalogo, reemplazan a los de antes y salen en «Tus bancos»", async () => {
    expect(await marcarMisBancos(HOGAR_INICIAL, yo, ["banco santander", "BCI", "Santander"], { db: prisma })).toEqual(["Santander", "BCI"]);
    expect(await marcarMisBancos(HOGAR_INICIAL, yo, ["BCI", "Banco de Chile"], { db: prisma })).toEqual(["BCI", "Banco de Chile"]);
    expect((await leerParaConectar(HOGAR_INICIAL, yo, { db: prisma })).bancos).toEqual(["Banco de Chile", "BCI"]);

    const { bancos, remitentes } = await leerLosBancosDelHogar(HOGAR_INICIAL, { db: prisma, hoy: "2026-11-24" });
    expect(bancos.map((b) => [b.banco, b.cuentas.length])).toEqual([
      ["BCI", 0],
      ["Banco de Chile", 0],
    ]);
    expect(remitentes).toEqual(expect.arrayContaining(["bci.cl", "bancochile.cl", "bancoedwards.cl"]));
  });

  test("un banco que Luka no conoce, o ninguno, no se puede marcar", async () => {
    await expect(marcarMisBancos(HOGAR_INICIAL, yo, ["Banco Inventado"], { db: prisma })).rejects.toThrow(ErrorAlConectar);
    await expect(marcarMisBancos(HOGAR_INICIAL, yo, [], { db: prisma })).rejects.toThrow("Marca al menos un banco");
    await expect(marcarMisBancos("otro-hogar", yo, ["BCI"], { db: prisma })).rejects.toThrow("Ya no eres parte");
  });

  test("lo que dice en que va: sus bancos, sus cuentas y si ya llego algo de verdad", async () => {
    expect(await leerParaConectar(HOGAR_INICIAL, yo, { db: prisma })).toEqual({
      bancos: [],
      conCuentas: false,
      yaLlegoAlgo: false,
      resumenDiario: true,
    });

    // La confirmacion de Gmail no prueba que el filtro funcione.
    const confirmacion = await armarCorreo({
      de: "Equipo de Gmail <forwarding-noreply@google.com>",
      para: miDireccion,
      asunto: "(#987654321) Confirmación de reenvío de Gmail - Recibir correo de camila@ejemplo.cl",
      texto: `camila@ejemplo.cl solicitó reenviar automáticamente los correos a tu dirección ${miDireccion}.\nCódigo de confirmación: 987654321`,
      arriba: [
        ["Delivered-To", miDireccion],
        ["Authentication-Results", firmaDe("google.com")],
      ],
    });
    expect(await procesarCorreo(confirmacion, opciones())).toMatchObject({ resultado: "CONFIRMACION_DE_GMAIL" });
    expect((await leerParaConectar(HOGAR_INICIAL, yo, { db: prisma })).yaLlegoAlgo).toBe(false);

    await procesarCorreo(await reenviado("santander/transferencia-enviada.txt", "t-1", "santander.cl"), opciones());
    expect(await leerParaConectar(HOGAR_INICIAL, yo, { db: prisma })).toMatchObject({ conCuentas: true, yaLlegoAlgo: true });
    // Lo de Camila no cuenta para Pedro.
    expect(await leerParaConectar(HOGAR_INICIAL, pareja, { db: prisma })).toMatchObject({ conCuentas: false, yaLlegoAlgo: false });
  });
});

describe("la cartola que espera su clave", () => {
  const cartola = () =>
    armarCorreo({
      de: "mensajeria@santander.cl",
      para: "camila@ejemplo.cl",
      asunto: "Cuenta Corriente Persona",
      idDelMensaje: "<cartola-0001@santander.cl>",
      html: "<p>Ya puedes revisar tu cartola de este mes. Por tu seguridad, el archivo PDF adjunto está encriptado.</p>",
      adjuntos: [{ nombre: "LCA_CTA_CTE_CRONO-0000_0000000.pdf", tipo: "application/octet-stream", contenido: CON_CLAVE }],
      arriba: reenvioDeGmail("camila@ejemplo.cl", miDireccion, "santander.cl"),
    });

  test("se pide en Inicio hasta que se guarda la clave, y si no la abre se vuelve a pedir", async () => {
    // Con la hora de verdad: la clave se guarda con la hora de la base.
    const ahora = () => opciones({ ahora: new Date() });
    const espera = (miembroId = yo) => cartolaQueEsperaClave(HOGAR_INICIAL, miembroId, { db: prisma });
    const buzon = buzonEnMemoria([await cartola()]);
    expect(await espera()).toBeNull();

    await revisarBuzon(buzon, ahora());
    expect(await espera()).toEqual({
      banco: "Santander",
      pista: "tu RUT sin puntos, sin guión y sin el dígito verificador",
      detalle: "El PDF tiene clave. Escríbela: el correo del banco dice cuál es.",
    });
    // A Pedro no se le pide: la cartola llego al buzon de Camila.
    expect(await espera(pareja)).toBeNull();

    // Guarda una clave equivocada: deja de pedirse, y con la revision siguiente se pide de nuevo.
    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", "11111111", { db: prisma, maestra: MAESTRA });
    expect(await espera()).toBeNull();
    await revisarBuzon(buzon, ahora());
    expect(await espera()).toMatchObject({
      detalle: "La clave guardada no abre este PDF. Escríbela de nuevo: el correo del banco dice cuál es.",
    });
    // Otra revision sin cambios no la anota otra vez.
    await revisarBuzon(buzon, ahora());
    expect(await prisma.llegadaAlBuzon.count({ where: { resultado: "CARTOLA_SIN_CLAVE" } })).toBe(2);

    // Con la buena, se lee y deja de pedirse.
    await guardarClaveDeCartola(HOGAR_INICIAL, yo, "Santander", CLAVE, { db: prisma, maestra: MAESTRA });
    expect(await revisarBuzon(buzon, ahora())).toMatchObject({ cartolas: 1, esperanClave: 0 });
    expect(buzon.quedan()).toBe(0);
    expect(await espera()).toBeNull();
  });

  test("despues de 45 dias ya no se pide", async () => {
    await revisarBuzon(buzonEnMemoria([await cartola()]), opciones());
    const despues = new Date(AHORA.getTime() + 46 * 86_400_000);
    expect(await cartolaQueEsperaClave(HOGAR_INICIAL, yo, { db: prisma, ahora: despues })).toBeNull();
  });
});

describe("el resumen diario por correo", () => {
  let enviados: Correo[];
  const enviar = async (correo: Correo) => {
    enviados.push(correo);
  };
  // El martes 24 de noviembre a las 8 de la mañana en Chile.
  const MANANA_DEL_24 = new Date("2026-11-24T11:00:00Z");
  const resumen = (extra: Parameters<typeof enviarResumenesDiarios>[0] = {}) =>
    enviarResumenesDiarios({ db: prisma, enviar, ahora: MANANA_DEL_24, url: "https://lukaapp.cl", ...extra });

  beforeEach(() => {
    enviados = [];
  });

  async function gastoDeAyer() {
    const categoria = await prisma.categoria.create({ data: { hogarId: HOGAR_INICIAL, nombre: "Supermercado", color: "#15803D", icono: "x" } });
    await prisma.gasto.create({
      data: { hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-23"), descripcion: "Líder", monto: 17_500, categoriaId: categoria.id },
    });
    await prisma.gasto.create({
      data: { hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-10"), descripcion: "Feria", monto: 12_000, categoriaId: categoria.id },
    });
  }

  test("sin nada que contar no se manda nada", async () => {
    expect(await resumen()).toEqual({ enviados: 0, sinNovedad: 2, fallidos: 0 });
    expect(enviados).toEqual([]);
  });

  test("llega a cada persona del hogar que ya entro, con lo de ayer y lo del mes, una vez al dia", async () => {
    await gastoDeAyer();
    await miembroDePrueba(prisma, { correo: "invitada@ejemplo.cl", entro: false });

    expect(await resumen()).toEqual({ enviados: 2, sinNovedad: 0, fallidos: 0 });
    expect(enviados.map((c) => c.para).sort()).toEqual(["camila@ejemplo.cl", "pedro@ejemplo.cl"]);
    const deCamila = enviados.find((c) => c.para === "camila@ejemplo.cl")!;
    expect(deCamila.asunto).toBe("Ayer: $17.500");
    expect(deCamila.texto).toContain("Hola, Camila:");
    expect(deCamila.texto).toContain("El lunes 23 se anotaron $17.500 en 1 gasto:");
    expect(deCamila.texto).toContain("En noviembre van $29.500.");

    // Si la tarea corre otra vez el mismo dia, no lo repite.
    expect(await resumen()).toEqual({ enviados: 0, sinNovedad: 0, fallidos: 0 });
    expect(enviados).toHaveLength(2);
  });

  test("si la tarea corre dos veces a la vez, cada uno recibe uno solo", async () => {
    await gastoDeAyer();
    const [una, otra] = await Promise.all([resumen(), resumen()]);
    expect(una.enviados + otra.enviados).toBe(2);
    expect(enviados.map((c) => c.para).sort()).toEqual(["camila@ejemplo.cl", "pedro@ejemplo.cl"]);
  });

  test("a quien lo apago no le llega", async () => {
    await gastoDeAyer();
    await cambiarResumenDiario(HOGAR_INICIAL, pareja, false, { db: prisma });
    expect(await resumen()).toMatchObject({ enviados: 1 });
    expect(enviados.map((c) => c.para)).toEqual(["camila@ejemplo.cl"]);
    await expect(cambiarResumenDiario("otro-hogar", yo, false, { db: prisma })).rejects.toThrow("Ya no eres parte");
  });

  test("cuenta lo que espera en «Por revisar»", async () => {
    await procesarCorreo(await reenviado("santander/transferencia-enviada.txt", "t-1", "santander.cl"), opciones());
    await resumen();
    expect(enviados[0]!.asunto).toBe("1 por revisar");
  });

  test("si el correo no sale, el dia queda libre para la proxima", async () => {
    await gastoDeAyer();
    const falla = async () => {
      throw new Error("SMTP caido");
    };
    expect(await resumen({ enviar: falla })).toEqual({ enviados: 0, sinNovedad: 0, fallidos: 2 });
    expect(await resumen()).toMatchObject({ enviados: 2 });
  });

  test("sin correo configurado no hace nada", async () => {
    await gastoDeAyer();
    expect(await resumen({ enviar: null })).toEqual({ enviados: 0, sinNovedad: 0, fallidos: 0 });
  });
});
