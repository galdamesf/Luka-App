import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import {
  ErrorDeDosPasos,
  accesoDeSesion,
  appsDelHogar,
  claveParaConfigurar,
  confirmarConfiguracion,
  estadoDeLaApp,
  olvidarSesion,
  quitarMiApp,
  reiniciarAppDe,
  renovarCodigosDeRespaldo,
  verificarCodigo,
} from "@/datos/dos-pasos";
import { DOS_PASOS } from "@/dominio/dos-pasos";
import { codigoDeApp, deBase32, pasoDe } from "@/lib/dos-pasos";

/**
 * La verificacion en dos pasos contra Postgres de verdad: configurar la app,
 * entrar con el codigo o con uno de respaldo, los bloqueos y lo que se hace
 * desde «Tu hogar».
 */

let prisma: PrismaClient;
const MAESTRA = randomBytes(32);
const T0 = new Date("2026-11-04T15:00:00Z");
const despues = (segundos: number) => new Date(T0.getTime() + segundos * 1000);
const sesion = () => randomBytes(16).toString("hex");

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.miembro.create({
    data: { id: "m-yo", hogarId: HOGAR_INICIAL, correo: "yo@gmail.com", rol: "DUENO", entroEn: T0 },
  });
  await prisma.miembro.create({
    data: { id: "m-pareja", hogarId: HOGAR_INICIAL, correo: "pareja@gmail.com", rol: "MIEMBRO", entroEn: T0 },
  });
  await prisma.hogar.create({
    data: {
      id: "h-otro",
      nombre: "Otro",
      miembros: { create: { id: "m-otro", correo: "otro@gmail.com", rol: "DUENO", entroEn: T0 } },
    },
  });
});

const op = (ahora: Date = T0) => ({ db: prisma, maestra: MAESTRA, ahora });

/** El codigo que mostraria la app en ese instante. */
const codigo = (clave: string, ahora: Date) => codigoDeApp(deBase32(clave), pasoDe(ahora));

/** Configura la app del miembro de punta a punta y devuelve su clave y codigos. */
async function configurar(miembroId: string, sid = sesion(), ahora = T0) {
  const clave = await claveParaConfigurar(miembroId, op(ahora));
  const resultado = await confirmarConfiguracion(miembroId, sid, codigo(clave, ahora), op(ahora));
  if (!resultado.ok) throw new Error(resultado.mensaje);
  return { clave, codigos: resultado.codigos, sid };
}

describe("configurar la app", () => {
  test("la clave es la misma al recargar, va cifrada en la base y al confirmar queda todo listo", async () => {
    const clave = await claveParaConfigurar("m-yo", op());
    expect(clave).toMatch(/^[A-Z2-7]{32}$/);
    expect(await claveParaConfigurar("m-yo", op())).toBe(clave);

    const fila = await prisma.dosPasos.findUniqueOrThrow({ where: { miembroId: "m-yo" } });
    expect(fila.claveCifrada.startsWith("v1.")).toBe(true);
    expect(fila.claveCifrada).not.toContain(clave);
    expect(fila.confirmadoEn).toBeNull();

    const sid = sesion();
    const resultado = await confirmarConfiguracion("m-yo", sid, codigo(clave, T0), op());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.codigos).toHaveLength(DOS_PASOS.codigosDeRespaldo);
    for (const c of resultado.codigos) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);

    // Se guardan solo las huellas.
    const guardados = await prisma.codigoDeRespaldo.findMany({ where: { miembroId: "m-yo" } });
    expect(guardados).toHaveLength(10);
    for (const g of guardados) {
      expect(g.huella).toMatch(/^[0-9a-f]{64}$/);
      expect(resultado.codigos.map((c) => c.replace("-", ""))).not.toContain(g.huella);
    }

    // Esta sesion queda verificada; la app, configurada.
    expect(await accesoDeSesion("yo@gmail.com", sid, op())).toEqual({
      hogar: { hogarId: HOGAR_INICIAL, miembroId: "m-yo", rol: "DUENO" },
      appConfigurada: true,
      sesionVerificada: true,
    });
    // Y ya no se puede volver a configurar por aqui.
    await expect(claveParaConfigurar("m-yo", op())).rejects.toThrow(ErrorDeDosPasos);
    expect(await confirmarConfiguracion("m-yo", sesion(), codigo(clave, T0), op())).toEqual({
      ok: false,
      mensaje: "Ya tienes la app configurada.",
    });
  });

  test("un codigo equivocado al configurar cuenta como intento y no configura nada", async () => {
    await claveParaConfigurar("m-yo", op());
    expect(await confirmarConfiguracion("m-yo", sesion(), "000000", op())).toEqual({
      ok: false,
      mensaje: "Ese código no es. Te quedan 4 intentos.",
    });
    expect(await confirmarConfiguracion("m-yo", sesion(), "12a", op())).toEqual({
      ok: false,
      mensaje: "Escribe los 6 dígitos que muestra la app.",
    });
    const fila = await prisma.dosPasos.findUniqueOrThrow({ where: { miembroId: "m-yo" } });
    expect(fila.confirmadoEn).toBeNull();
    expect(fila.intentos).toBe(1);
    expect(await prisma.codigoDeRespaldo.count()).toBe(0);
  });

  test("sin haber visto el QR no hay nada que confirmar", async () => {
    expect(await confirmarConfiguracion("m-yo", sesion(), "123456", op())).toEqual({
      ok: false,
      mensaje: "Vuelve a cargar la página para ver el código QR.",
    });
  });
});

describe("accesoDeSesion", () => {
  test("recien entrado con Google: es miembro, sin app ni sesion verificada", async () => {
    expect(await accesoDeSesion("YO@gmail.com", sesion(), op())).toEqual({
      hogar: { hogarId: HOGAR_INICIAL, miembroId: "m-yo", rol: "DUENO" },
      appConfigurada: false,
      sesionVerificada: false,
    });
  });

  test("solo vale la sesion que puso el codigo, y solo hasta que vence", async () => {
    const { sid } = await configurar("m-yo");
    expect((await accesoDeSesion("yo@gmail.com", sid, op())).sesionVerificada).toBe(true);
    expect((await accesoDeSesion("yo@gmail.com", sesion(), op())).sesionVerificada).toBe(false);
    // Otra persona no puede usar tu sesion verificada.
    expect((await accesoDeSesion("pareja@gmail.com", sid, op())).sesionVerificada).toBe(false);
    // Despues del maximo de una sesion (8 horas), ya no.
    expect((await accesoDeSesion("yo@gmail.com", sid, op(despues(8 * 3600 + 1)))).sesionVerificada).toBe(false);
  });

  test("un id de sesion con mala forma nunca vale, y una invitacion pendiente no es nadie", async () => {
    await configurar("m-yo");
    expect((await accesoDeSesion("yo@gmail.com", "x' OR 1=1 --", op())).sesionVerificada).toBe(false);
    expect((await accesoDeSesion("yo@gmail.com", null, op())).sesionVerificada).toBe(false);
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "invitada@gmail.com" } });
    expect(await accesoDeSesion("invitada@gmail.com", sesion(), op())).toEqual({
      hogar: null,
      appConfigurada: false,
      sesionVerificada: false,
    });
    expect((await accesoDeSesion(null, sesion(), op())).hogar).toBeNull();
  });

  test("al salir, la sesion deja de estar verificada", async () => {
    const { sid } = await configurar("m-yo");
    await olvidarSesion(sid, prisma);
    expect((await accesoDeSesion("yo@gmail.com", sid, op())).sesionVerificada).toBe(false);
    await olvidarSesion("no es un id", prisma); // no reclama
  });
});

describe("entrar con el codigo de la app", () => {
  test("el codigo de ahora entra; el mismo codigo no sirve otra vez; el siguiente si", async () => {
    const { clave } = await configurar("m-yo");
    const t = despues(60);
    const s1 = sesion();
    expect(await verificarCodigo("m-yo", s1, codigo(clave, t), op(t))).toEqual({
      ok: true,
      conRespaldo: false,
      respaldosQueQuedan: 10,
    });
    expect((await accesoDeSesion("yo@gmail.com", s1, op(t))).sesionVerificada).toBe(true);

    // Alguien que vio el codigo por encima del hombro no lo puede reusar.
    const s2 = sesion();
    expect((await verificarCodigo("m-yo", s2, codigo(clave, t), op(t))).ok).toBe(false);
    expect((await accesoDeSesion("yo@gmail.com", s2, op(t))).sesionVerificada).toBe(false);

    const t2 = despues(90);
    expect((await verificarCodigo("m-yo", s2, codigo(clave, t2), op(t2))).ok).toBe(true);
  });

  test("con espacios tambien vale; con otra forma, dice que escribir", async () => {
    const { clave } = await configurar("m-yo");
    const t = despues(60);
    const c = codigo(clave, t);
    expect((await verificarCodigo("m-yo", sesion(), `${c.slice(0, 3)} ${c.slice(3)}`, op(t))).ok).toBe(true);
    expect(await verificarCodigo("m-yo", sesion(), "hola", op(t))).toEqual({
      ok: false,
      mensaje: "Escribe los 6 dígitos de la app, o un código de respaldo (como ABCDE-FGHJK).",
    });
  });

  test("al quinto codigo equivocado se bloquea 15 minutos, aunque despues llegue el correcto", async () => {
    const { clave } = await configurar("m-yo");
    const t = despues(60);
    for (let i = 1; i < DOS_PASOS.intentos; i++) {
      const r = await verificarCodigo("m-yo", sesion(), "000000", op(t));
      expect(r).toEqual({ ok: false, mensaje: expect.stringMatching(/^Ese código no es/) });
    }
    expect(await verificarCodigo("m-yo", sesion(), "000000", op(t))).toEqual({
      ok: false,
      mensaje: "Demasiados intentos. Espera 15 minutos y prueba de nuevo.",
    });
    // Bloqueado: ni el correcto entra.
    const t2 = despues(120);
    expect(await verificarCodigo("m-yo", sesion(), codigo(clave, t2), op(t2))).toEqual({
      ok: false,
      mensaje: "Demasiados intentos. Espera 14 minutos y prueba de nuevo.",
    });
    // Pasado el bloqueo, el correcto entra y la cuenta vuelve a cero.
    const t3 = despues(60 + 15 * 60 + 30);
    expect((await verificarCodigo("m-yo", sesion(), codigo(clave, t3), op(t3))).ok).toBe(true);
    const fila = await prisma.dosPasos.findUniqueOrThrow({ where: { miembroId: "m-yo" } });
    expect(fila.intentos).toBe(0);
  });

  test("sin app configurada no hay codigo que revisar", async () => {
    expect(await verificarCodigo("m-pareja", sesion(), "123456", op())).toEqual({
      ok: false,
      mensaje: "Primero tienes que configurar la app.",
    });
  });
});

describe("entrar con un codigo de respaldo", () => {
  test("cada uno sirve una vez, escrito como sea", async () => {
    const { codigos } = await configurar("m-yo");
    const primero = codigos[0]!;
    const sid = sesion();
    expect(await verificarCodigo("m-yo", sid, primero.toLowerCase().replace("-", " "), op())).toEqual({
      ok: true,
      conRespaldo: true,
      respaldosQueQuedan: 9,
    });
    expect((await accesoDeSesion("yo@gmail.com", sid, op())).sesionVerificada).toBe(true);
    expect((await verificarCodigo("m-yo", sesion(), primero, op())).ok).toBe(false);
    expect(await estadoDeLaApp("m-yo", prisma)).toEqual({ configuradaEn: T0, respaldosQueQuedan: 9 });
  });

  test("un codigo de respaldo de otra persona no sirve", async () => {
    const mios = await configurar("m-yo");
    await configurar("m-pareja");
    expect((await verificarCodigo("m-pareja", sesion(), mios.codigos[0]!, op())).ok).toBe(false);
  });

  test("renovarlos deja sin efecto los anteriores", async () => {
    const { codigos: viejos } = await configurar("m-yo");
    const nuevos = await renovarCodigosDeRespaldo("m-yo", op());
    expect(nuevos).toHaveLength(10);
    expect(nuevos).not.toEqual(viejos);
    expect((await verificarCodigo("m-yo", sesion(), viejos[1]!, op())).ok).toBe(false);
    expect((await verificarCodigo("m-yo", sesion(), nuevos[1]!, op())).ok).toBe(true);
    await expect(renovarCodigosDeRespaldo("m-pareja", op())).rejects.toThrow("Primero tienes que configurar la app.");
  });
});

describe("desde «Tu hogar»", () => {
  test("pasar la app a otro celular: se quita la actual y la sesion queda pidiendo configurar", async () => {
    const { sid, clave } = await configurar("m-yo");
    // Otra sesion de la misma persona, ya verificada (otro computador).
    const otra = sesion();
    expect((await verificarCodigo("m-yo", otra, codigo(clave, despues(30)), op(despues(30)))).ok).toBe(true);

    await quitarMiApp("m-yo", sid, prisma);
    const acceso = await accesoDeSesion("yo@gmail.com", sid, op());
    expect(acceso.appConfigurada).toBe(false);
    // La otra sesion deja de estar verificada; esta, no (sigue para configurar la nueva).
    expect(await prisma.sesionVerificada.findMany({ where: { miembroId: "m-yo" }, select: { id: true } })).toEqual([{ id: sid }]);
    expect(await prisma.codigoDeRespaldo.count({ where: { miembroId: "m-yo" } })).toBe(0);
    // Y se puede configurar una nueva.
    const nueva = await claveParaConfigurar("m-yo", op());
    expect((await confirmarConfiguracion("m-yo", sid, codigo(nueva, despues(60)), op(despues(60)))).ok).toBe(true);
    expect((await accesoDeSesion("yo@gmail.com", otra, op(despues(60)))).sesionVerificada).toBe(false);
  });

  test("el dueno le reinicia la app a otro miembro: se le quita y se le cierran las sesiones", async () => {
    const { sid } = await configurar("m-pareja");
    expect(await appsDelHogar(HOGAR_INICIAL, prisma)).toEqual(new Set(["m-pareja"]));
    await reiniciarAppDe(HOGAR_INICIAL, "m-yo", "m-pareja", prisma);
    expect(await accesoDeSesion("pareja@gmail.com", sid, op())).toMatchObject({ appConfigurada: false, sesionVerificada: false });
    expect(await appsDelHogar(HOGAR_INICIAL, prisma)).toEqual(new Set());
  });

  test("ni un miembro, ni el dueno a si mismo, ni a alguien de otro hogar", async () => {
    await configurar("m-yo");
    await configurar("m-otro");
    await expect(reiniciarAppDe(HOGAR_INICIAL, "m-pareja", "m-yo", prisma)).rejects.toThrow("Solo el dueño");
    await expect(reiniciarAppDe(HOGAR_INICIAL, "m-yo", "m-yo", prisma)).rejects.toThrow("código de respaldo");
    await expect(reiniciarAppDe(HOGAR_INICIAL, "m-yo", "m-otro", prisma)).rejects.toThrow("no es parte de tu hogar");
    // El dueno de otro hogar tampoco puede tocar a los de este.
    await expect(reiniciarAppDe("h-otro", "m-otro", "m-yo", prisma)).rejects.toThrow("no es parte de tu hogar");
    expect((await estadoDeLaApp("m-yo", prisma)).configuradaEn).toEqual(T0);
    expect((await estadoDeLaApp("m-otro", prisma)).configuradaEn).toEqual(T0);
  });
});

describe("lo que se va con el miembro", () => {
  test("al sacar a alguien del hogar, o borrar el hogar, se van su app, sus respaldos y sus sesiones", async () => {
    await configurar("m-pareja");
    await prisma.miembro.delete({ where: { id: "m-pareja" } });
    expect(await prisma.dosPasos.count({ where: { miembroId: "m-pareja" } })).toBe(0);
    expect(await prisma.codigoDeRespaldo.count({ where: { miembroId: "m-pareja" } })).toBe(0);
    expect(await prisma.sesionVerificada.count({ where: { miembroId: "m-pareja" } })).toBe(0);

    await configurar("m-otro");
    await prisma.hogar.delete({ where: { id: "h-otro" } });
    expect(await prisma.dosPasos.count()).toBe(0);
  });

  test("la base rechaza una clave sin cifrar, una huella o un id de sesion con mala forma", async () => {
    await expect(prisma.dosPasos.create({ data: { miembroId: "m-yo", claveCifrada: "JBSWY3DPEHPK3PXP" } })).rejects.toThrow();
    await expect(prisma.codigoDeRespaldo.create({ data: { miembroId: "m-yo", huella: "ABCDEFGHJK".padEnd(64, "x") } })).rejects.toThrow();
    await expect(
      prisma.sesionVerificada.create({ data: { id: "z".repeat(32), miembroId: "m-yo", expiraEn: despues(60), verificadaEn: T0 } }),
    ).rejects.toThrow();
  });
});
