import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, hoyISO } from "@/lib/fecha";
import { periodoDeFecha, sumarDias } from "@/lib/periodo";
import { enviarCorreoDelEntorno, type EnviarCorreo } from "@/lib/correo";
import { urlDeLuka } from "@/lib/automatico";
import { BANCOS, bancoConocido, bancoDelComprobante, mismoBanco } from "@/dominio/bancos";
import { BANCOS_CON_CARTOLA, PISTA_DE_LA_CLAVE } from "@/dominio/cartolas";
import { fechaDeVencimiento, resumirCuentas } from "@/dominio/cuentas";
import { armarResumenDiario, pruebaQueLlega, type DatosDelResumen } from "@/dominio/conectar";
import type { ResultadoDeLlegada } from "@/dominio/buzon";
import { leerAjustes } from "./ajustes";
import { listarCuentasDelMes, regenerarMensuales } from "./cuentas";

/**
 * Conectar los correos de una persona y lo que Luka hace despues sola: sus
 * bancos marcados, en que va, la cartola que espera su clave y el resumen
 * diario por correo. Las reglas estan en src/dominio/conectar.ts.
 */

type Db = PrismaClient;

export class ErrorAlConectar extends Error {}

async function miembroDelHogar(hogarId: string, miembroId: string, db: Db): Promise<void> {
  const miembro = await db.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { id: true } });
  if (!miembro) throw new ErrorAlConectar("Ya no eres parte de este hogar.");
}

// ---------------------------------------------------------------------------
// Los bancos de la persona
// ---------------------------------------------------------------------------

/**
 * Deja marcados esos bancos (y solo esos) como de la persona. Son los del
 * catalogo: Luka sabe desde donde escriben, y eso es lo que va en el filtro.
 */
export async function marcarMisBancos(
  hogarId: string,
  miembroId: string,
  bancos: readonly string[],
  { db = prisma }: { db?: Db } = {},
): Promise<string[]> {
  await miembroDelHogar(hogarId, miembroId, db);
  const nombres: string[] = [];
  for (const banco of bancos) {
    const conocido = bancoConocido(banco);
    if (!conocido) throw new ErrorAlConectar(`Luka no conoce el banco «${banco.trim().slice(0, 60)}».`);
    if (!nombres.includes(conocido.nombre)) nombres.push(conocido.nombre);
  }
  if (nombres.length === 0) throw new ErrorAlConectar("Marca al menos un banco o billetera.");

  await db.$transaction([
    db.bancoMarcado.deleteMany({ where: { miembroId } }),
    db.bancoMarcado.createMany({ data: nombres.map((banco) => ({ miembroId, banco })) }),
  ]);
  return nombres;
}

export type ParaConectar = {
  /** Los bancos que marco, en el orden del catalogo. */
  bancos: string[];
  /** Si ya tiene cuentas o tarjetas suyas en el hogar. */
  conCuentas: boolean;
  /** Si ya llego algo reenviado desde uno de sus correos. */
  yaLlegoAlgo: boolean;
  /** Si quiere el resumen diario por correo. */
  resumenDiario: boolean;
};

/** En que va la persona con sus correos. */
export async function leerParaConectar(hogarId: string, miembroId: string, { db = prisma }: { db?: Db } = {}): Promise<ParaConectar> {
  const [miembro, marcados, cuenta, llegadas, reenviado] = await Promise.all([
    db.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { resumenDiario: true } }),
    db.bancoMarcado.findMany({ where: { miembroId }, select: { banco: true } }),
    db.cuentaBancaria.findFirst({ where: { hogarId, miembroId }, select: { id: true } }),
    db.llegadaAlBuzon.findMany({ where: { miembroId }, select: { resultado: true }, distinct: ["resultado"] }),
    db.movimiento.findFirst({ where: { hogarId, miembroId, reenviadoPor: { not: null } }, select: { id: true } }),
  ]);
  if (!miembro) throw new ErrorAlConectar("Ya no eres parte de este hogar.");
  const orden = (banco: string) => BANCOS.findIndex((b) => mismoBanco(b.nombre, banco));
  return {
    bancos: marcados.map((m) => m.banco).sort((a, b) => orden(a) - orden(b)),
    conCuentas: cuenta !== null,
    yaLlegoAlgo: reenviado !== null || llegadas.some((l) => pruebaQueLlega(l.resultado as ResultadoDeLlegada)),
    resumenDiario: miembro.resumenDiario,
  };
}

// ---------------------------------------------------------------------------
// La cartola que espera su clave
// ---------------------------------------------------------------------------

/** Hasta cuantos dias despues de llegar se sigue pidiendo su clave en Inicio. */
const DIAS_QUE_SE_PIDE_LA_CLAVE = 45;

export type CartolaQueEspera = {
  banco: string;
  /** Cual es la clave, como lo dice el correo del banco. */
  pista: string;
  /** Por que no se pudo abrir: falta la clave, o la guardada no la abre. */
  detalle: string | null;
};

/**
 * La cartola de esta persona que esta en el buzon esperando la clave de su
 * PDF, para pedirla en Inicio. Ninguna si despues se leyo una cartola de ese
 * banco o si despues guardo la clave (si tampoco la abre, el buzon lo vuelve
 * a anotar y se pide de nuevo).
 */
export async function cartolaQueEsperaClave(
  hogarId: string,
  miembroId: string,
  { db = prisma, ahora = new Date() }: { db?: Db; ahora?: Date } = {},
): Promise<CartolaQueEspera | null> {
  const espera = await db.llegadaAlBuzon.findFirst({
    where: {
      miembroId,
      miembro: { hogarId },
      resultado: "CARTOLA_SIN_CLAVE",
      llegoEn: { gte: new Date(ahora.getTime() - DIAS_QUE_SE_PIDE_LA_CLAVE * 86_400_000) },
    },
    orderBy: [{ llegoEn: "desc" }, { id: "desc" }],
    select: { llegoEn: true, remitente: true, detalle: true },
  });
  if (!espera) return null;
  const delCorreo = bancoDelComprobante({ plantilla: null, remitente: espera.remitente, fuente: null });
  const banco = delCorreo === null ? undefined : BANCOS_CON_CARTOLA.find((b) => mismoBanco(b, delCorreo));
  if (!banco) return null;

  const [leida, clave] = await Promise.all([
    db.cartola.findFirst({ where: { hogarId, banco, leidaEn: { gte: espera.llegoEn } }, select: { id: true } }),
    db.claveDeCartola.findUnique({ where: { miembroId_banco: { miembroId, banco } }, select: { creadaEn: true } }),
  ]);
  if (leida !== null || (clave !== null && clave.creadaEn > espera.llegoEn)) return null;
  return { banco, pista: PISTA_DE_LA_CLAVE[banco] ?? "la clave que dice el correo del banco", detalle: espera.detalle };
}

// ---------------------------------------------------------------------------
// El resumen diario por correo
// ---------------------------------------------------------------------------

export async function cambiarResumenDiario(
  hogarId: string,
  miembroId: string,
  activo: boolean,
  { db = prisma }: { db?: Db } = {},
): Promise<void> {
  const cambiado = await db.miembro.updateMany({ where: { id: miembroId, hogarId }, data: { resumenDiario: activo } });
  if (cambiado.count === 0) throw new ErrorAlConectar("Ya no eres parte de este hogar.");
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type DatosDelHogar = Omit<DatosDelResumen, "nombre" | "url">;

/** Lo que cuenta el resumen de un hogar: lo de ayer, el mes, lo por revisar y las cuentas por vencer. */
export async function datosDelResumen(hogarId: string, { db = prisma, hoy }: { db?: Db; hoy: string }): Promise<DatosDelHogar> {
  const ayer = sumarDias(hoy, -1);
  const manana = sumarDias(hoy, 1);
  const { diaInicioMes } = await leerAjustes(hogarId, db);
  const periodo = periodoDeFecha(hoy, diaInicioMes);
  // Las cuentas mensuales del mes, por si nadie abrio el panel todavia.
  await regenerarMensuales(hogarId, periodo.mes, db);

  const [deAyer, delMes, porRevisar, cuentas] = await Promise.all([
    db.gasto.findMany({ where: { hogarId, fecha: fechaDesdeISO(ayer) }, select: { descripcion: true, monto: true } }),
    db.gasto.aggregate({
      where: { hogarId, fecha: { gte: fechaDesdeISO(periodo.desde), lte: fechaDesdeISO(hoy) } },
      _sum: { monto: true },
    }),
    db.movimiento.count({ where: { hogarId, estado: "POR_REVISAR" } }),
    listarCuentasDelMes(hogarId, periodo.mes, db),
  ]);
  const cuentasPorVencer = resumirCuentas(cuentas, periodo, hoy).pendientes.flatMap((cuenta) => {
    const vence = fechaDeVencimiento(cuenta, periodo.diaInicio);
    return vence === hoy || vence === manana ? [{ nombre: cuenta.nombre, monto: cuenta.monto, venceHoy: vence === hoy }] : [];
  });
  return {
    ayer,
    gastosDeAyer: deAyer,
    totalDelMes: delMes._sum.monto ?? 0,
    nombreDelMes: MESES[Number(periodo.mes.slice(5, 7)) - 1] ?? periodo.mes,
    porRevisar,
    cuentasPorVencer,
  };
}

export type ResultadoDelResumen = {
  enviados: number;
  /** Los que no tenian nada que contar. */
  sinNovedad: number;
  fallidos: number;
};

/**
 * Manda el resumen del dia a cada persona que lo quiere y ya entro a Luka,
 * uno por dia: el dia se reserva antes de mandarlo, asi que si la tarea
 * programada corre dos veces, la segunda no lo repite. Si el envio falla, se
 * libera para la proxima.
 */
export async function enviarResumenesDiarios({
  db = prisma,
  enviar = enviarCorreoDelEntorno(),
  ahora = new Date(),
  url = urlDeLuka(),
}: { db?: Db; enviar?: EnviarCorreo | null; ahora?: Date; url?: string } = {}): Promise<ResultadoDelResumen> {
  const resultado: ResultadoDelResumen = { enviados: 0, sinNovedad: 0, fallidos: 0 };
  if (enviar === null) return resultado;

  const hoy = hoyISO("America/Santiago", ahora);
  const dia = fechaDesdeISO(hoy);
  const pendiente = { OR: [{ resumenEnviadoEl: null }, { resumenEnviadoEl: { lt: dia } }] };
  const miembros = await db.miembro.findMany({
    where: { resumenDiario: true, entroEn: { not: null }, ...pendiente },
    orderBy: [{ hogarId: "asc" }, { id: "asc" }],
    select: { id: true, hogarId: true, correo: true, nombre: true, resumenEnviadoEl: true },
  });

  const delHogar = new Map<string, DatosDelHogar>();
  for (const miembro of miembros) {
    let datos = delHogar.get(miembro.hogarId);
    if (!datos) {
      datos = await datosDelResumen(miembro.hogarId, { db, hoy });
      delHogar.set(miembro.hogarId, datos);
    }
    const nombre = miembro.nombre?.trim().split(/\s+/)[0] || null;
    const correo = armarResumenDiario({ ...datos, nombre, url });
    if (correo === null) {
      resultado.sinNovedad += 1;
      continue;
    }

    const reservado = await db.miembro.updateMany({ where: { id: miembro.id, ...pendiente }, data: { resumenEnviadoEl: dia } });
    if (reservado.count === 0) continue;
    try {
      await enviar({ para: miembro.correo, ...correo });
      resultado.enviados += 1;
    } catch (error) {
      console.error("No se pudo mandar el resumen diario:", error);
      await db.miembro.update({ where: { id: miembro.id }, data: { resumenEnviadoEl: miembro.resumenEnviadoEl } });
      resultado.fallidos += 1;
    }
  }
  return resultado;
}
