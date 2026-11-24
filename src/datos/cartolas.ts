import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, isoDesdeFecha } from "@/lib/fecha";
import { claveMaestra } from "@/lib/dos-pasos";
import { cifrarClaveDeCartola, descifrarClaveDeCartola } from "@/lib/claves-de-cartola";
import { abrirCartola, type PdfDeCartola } from "@/lib/cartola-pdf";
import { bancoConocido, mismoBanco, nombreDeLaCuenta, type TipoCuentaBancaria } from "@/dominio/bancos";
import {
  BANCOS_CON_CARTOLA,
  claveDeLaCartola,
  clavesDeLasFilas,
  cuadrar,
  leerCartola,
  lecturaDeLaFila,
  type CartolaLeida,
} from "@/dominio/cartolas";
import { registrarMovimiento } from "./movimientos";

/**
 * Leer la cartola del mes: abrirla con su clave, leerla con la plantilla de
 * su banco, cuadrarla y anotar sus filas como movimientos. Lo que ya estaba
 * anotado (porque llego por correo, o porque la cartola ya se habia leido)
 * se reconoce y no se duplica: las reglas estan en src/dominio/movimientos.ts.
 *
 * Tambien las claves de los PDF: cada persona guarda la suya por banco,
 * cifrada (src/lib/claves-de-cartola.ts), para que las cartolas que llegan
 * al buzon se lean solas. Nunca se muestra.
 */

export class ErrorDeCartola extends Error {}

type Db = PrismaClient;

export type OpcionesDeCartola = { db?: Db; maestra?: Buffer };

/** Ninguna clave de un PDF de banco es mas larga. */
const CLAVE_MAXIMA = 64;

function sha256(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

async function miembroDelHogar(hogarId: string, miembroId: string, db: Db): Promise<void> {
  const miembro = await db.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { id: true } });
  if (!miembro) throw new ErrorDeCartola("Esa persona no es de este hogar.");
}

/** El banco como se guarda su clave: el del catalogo, y solo si Luka sabe leer sus cartolas. */
function bancoConCartola(banco: string): string {
  const nombre = bancoConocido(banco)?.nombre ?? banco.trim();
  const conocido = BANCOS_CON_CARTOLA.find((b) => mismoBanco(b, nombre));
  if (!conocido) throw new ErrorDeCartola(`Luka todavía no sabe leer las cartolas de ${nombre}.`);
  return conocido;
}

function limpiarClave(clave: string): string {
  const limpia = clave.trim();
  if (limpia === "") throw new ErrorDeCartola("Escribe la clave del PDF.");
  if (limpia.length > CLAVE_MAXIMA) throw new ErrorDeCartola("Esa clave es demasiado larga para ser la de un PDF.");
  return limpia;
}

// ---------------------------------------------------------------------------
// La clave del PDF
// ---------------------------------------------------------------------------

export async function guardarClaveDeCartola(
  hogarId: string,
  miembroId: string,
  banco: string,
  clave: string,
  { db = prisma, maestra = claveMaestra() }: OpcionesDeCartola = {},
): Promise<{ banco: string }> {
  await miembroDelHogar(hogarId, miembroId, db);
  const nombre = bancoConCartola(banco);
  const cifrada = cifrarClaveDeCartola(limpiarClave(clave), miembroId, nombre, maestra);
  await db.claveDeCartola.upsert({
    where: { miembroId_banco: { miembroId, banco: nombre } },
    create: { miembroId, banco: nombre, cifrada },
    update: { cifrada, creadaEn: new Date() },
  });
  return { banco: nombre };
}

export async function quitarClaveDeCartola(
  hogarId: string,
  miembroId: string,
  banco: string,
  { db = prisma }: Pick<OpcionesDeCartola, "db"> = {},
): Promise<void> {
  await miembroDelHogar(hogarId, miembroId, db);
  await db.claveDeCartola.deleteMany({ where: { miembroId, banco: bancoConCartola(banco) } });
}

/** Los bancos de los que esta persona ya guardo la clave. Las claves no salen de aqui. */
export async function bancosConClave(miembroId: string, { db = prisma }: Pick<OpcionesDeCartola, "db"> = {}): Promise<string[]> {
  const claves = await db.claveDeCartola.findMany({ where: { miembroId }, select: { banco: true }, orderBy: { banco: "asc" } });
  return claves.map((c) => c.banco);
}

/**
 * Las claves que se prueban, ya descifradas: primero las de quien trae la
 * cartola y despues las del resto del hogar (la cartola de una persona la
 * puede subir otra). Una que no se puede descifrar (la maestra cambio) se
 * salta. La maestra se pide solo si hay algo que descifrar.
 */
async function clavesParaProbar(hogarId: string, miembroId: string | null, db: Db, maestra?: Buffer): Promise<string[]> {
  const guardadas = await db.claveDeCartola.findMany({
    where: { miembro: { hogarId } },
    select: { miembroId: true, banco: true, cifrada: true },
    orderBy: { creadaEn: "asc" },
  });
  if (guardadas.length === 0) return [];
  const llave = maestra ?? claveMaestra();
  const ordenadas = [...guardadas.filter((c) => c.miembroId === miembroId), ...guardadas.filter((c) => c.miembroId !== miembroId)];
  const claves: string[] = [];
  for (const guardada of ordenadas) {
    try {
      const clave = descifrarClaveDeCartola(guardada.cifrada, guardada.miembroId, guardada.banco, llave);
      if (!claves.includes(clave)) claves.push(clave);
    } catch {
      // Cifrada con otra maestra: no sirve aqui.
    }
  }
  return claves;
}

// ---------------------------------------------------------------------------
// Leer una cartola
// ---------------------------------------------------------------------------

export type ResumenDeCartola = {
  id: string;
  banco: string;
  ultimos4: string;
  /** La cuenta del hogar, como se muestra, o null si no esta en «Tus bancos». */
  cuenta: string | null;
  /** AAAA-MM-DD */
  desde: string;
  hasta: string;
  filas: number;
  nuevas: number;
  yaEstaban: number;
  fuera: number;
  cargos: number;
  abonos: number;
  leidaEn: Date;
};

export type MotivoSinCartola =
  | "falta-la-clave"
  | "clave-incorrecta"
  | "no-se-pudo-abrir"
  | "muy-grande"
  | "formato-desconocido"
  | "incompleta"
  | "no-cuadra";

export type ResultadoDeCartola =
  | { ok: true; yaLeida: boolean; cartola: ResumenDeCartola }
  | { ok: false; motivo: MotivoSinCartola; banco: string | null; mensaje: string };

const MENSAJE_DEL_PDF: Record<Exclude<PdfDeCartola, { ok: true }>["motivo"], string> = {
  "falta-la-clave": "El PDF tiene clave. Escríbela: el correo del banco dice cuál es.",
  "clave-incorrecta": "Esa clave no abre el PDF. Revisa en el correo del banco cuál es.",
  "no-se-pudo-abrir": "No se pudo abrir el archivo: ¿es el PDF de la cartola?",
  "muy-grande": "El archivo es demasiado grande para ser una cartola.",
};

export type CartolaEnPdf = {
  pdf: Uint8Array;
  /** Quien la subio o la reenvio. */
  miembroId: string | null;
  /** La clave que se escribio al subirla. Sin ella se prueban las guardadas. */
  clave?: string;
  /** Guardar la clave escrita para las proximas, si abrio. */
  recordarClave?: boolean;
  /** Cuando llego el correo, o cuando se subio. */
  recibidoEn?: Date;
  /** El banco que la mando, si llego por el buzon. */
  remitente?: string | null;
};

/** La cuenta del hogar de la cartola: del mismo banco y con sus 4 digitos (con o sin el verificador). */
async function cuentaDeLaCartola(
  hogarId: string,
  cartola: CartolaLeida,
  miembroId: string | null,
  db: Db,
): Promise<{ id: string; ultimos4: string; apodo: string | null; tipo: TipoCuentaBancaria } | null> {
  const cuentas = await db.cuentaBancaria.findMany({
    where: { hogarId },
    select: { id: true, banco: true, tipo: true, ultimos4: true, apodo: true, miembroId: true },
  });
  const delBanco = cuentas.filter((c) => mismoBanco(c.banco, cartola.banco));
  for (const ultimos4 of [cartola.ultimos4, cartola.ultimos4SinVerificador]) {
    if (ultimos4 === null) continue;
    let calzan = delBanco.filter((c) => c.ultimos4 === ultimos4);
    if (calzan.length > 1) calzan = calzan.filter((c) => c.tipo === cartola.tipoDeCuenta);
    if (calzan.length > 1) calzan = calzan.filter((c) => c.miembroId === miembroId);
    if (calzan.length === 1) {
      const [cuenta] = calzan;
      return { id: cuenta!.id, ultimos4: cuenta!.ultimos4, apodo: cuenta!.apodo, tipo: cuenta!.tipo };
    }
  }
  return null;
}

const SELECCION_RESUMEN = {
  id: true,
  banco: true,
  ultimos4: true,
  desde: true,
  hasta: true,
  filas: true,
  nuevas: true,
  yaEstaban: true,
  fuera: true,
  cargos: true,
  abonos: true,
  leidaEn: true,
  cuentaBancaria: { select: { apodo: true, tipo: true, ultimos4: true } },
} as const;

type FilaDeResumen = {
  id: string;
  banco: string;
  ultimos4: string;
  desde: Date;
  hasta: Date;
  filas: number;
  nuevas: number;
  yaEstaban: number;
  fuera: number;
  cargos: number;
  abonos: number;
  leidaEn: Date;
  cuentaBancaria: { apodo: string | null; tipo: TipoCuentaBancaria; ultimos4: string } | null;
};

function aResumen(fila: FilaDeResumen): ResumenDeCartola {
  const { cuentaBancaria, desde, hasta, ...resto } = fila;
  return {
    ...resto,
    desde: isoDesdeFecha(desde),
    hasta: isoDesdeFecha(hasta),
    cuenta: cuentaBancaria ? nombreDeLaCuenta(cuentaBancaria) : null,
  };
}

/**
 * Lee una cartola en PDF y anota sus filas. No anota nada si no cuadra con
 * los totales del banco. Leer la misma cartola dos veces no anota nada la
 * segunda: devuelve lo que paso la primera.
 */
export async function leerCartolaEnPdf(
  hogarId: string,
  entrada: CartolaEnPdf,
  { db = prisma, maestra }: OpcionesDeCartola = {},
): Promise<ResultadoDeCartola> {
  if (entrada.miembroId !== null) await miembroDelHogar(hogarId, entrada.miembroId, db);

  // 1. Abrirla: con la clave que se escribio, sin clave, o con las guardadas.
  const escrita = entrada.clave?.trim() ? limpiarClave(entrada.clave) : null;
  let pdf = await abrirCartola(entrada.pdf, escrita ?? undefined);
  if (!pdf.ok && pdf.motivo === "falta-la-clave" && escrita === null) {
    const guardadas = await clavesParaProbar(hogarId, entrada.miembroId, db, maestra);
    for (const clave of guardadas) {
      pdf = await abrirCartola(entrada.pdf, clave);
      if (pdf.ok || pdf.motivo !== "clave-incorrecta") break;
    }
    if (!pdf.ok && pdf.motivo === "clave-incorrecta") {
      return { ok: false, motivo: "clave-incorrecta", banco: null, mensaje: "La clave guardada no abre este PDF. Escríbela de nuevo: el correo del banco dice cuál es." };
    }
  }
  if (!pdf.ok) return { ok: false, motivo: pdf.motivo, banco: null, mensaje: MENSAJE_DEL_PDF[pdf.motivo] };

  // 2. Leerla y cuadrarla.
  const leida = leerCartola(pdf.paginas);
  if (!leida.ok) {
    return {
      ok: false,
      motivo: leida.motivo,
      banco: leida.banco,
      mensaje: leida.motivo === "incompleta" ? `Luka no pudo leer toda la cartola: ${leida.detalle}` : leida.detalle,
    };
  }
  const cuadre = cuadrar(leida);
  if (!cuadre.cuadra) {
    return {
      ok: false,
      motivo: "no-cuadra",
      banco: leida.banco,
      mensaje: `Lo que Luka leyó no suma lo que dice el banco, así que no anotó nada. ${cuadre.problemas[0] ?? ""}`.trim(),
    };
  }

  if (escrita !== null && entrada.recordarClave && entrada.miembroId !== null) {
    await guardarClaveDeCartola(hogarId, entrada.miembroId, leida.banco, escrita, { db, maestra });
  }

  // 3. Si ya se leyo entera, no se anota otra vez.
  const huella = sha256(claveDeLaCartola(leida));
  const cuenta = await cuentaDeLaCartola(hogarId, leida, entrada.miembroId, db);
  const yaEstaba = await db.cartola.findUnique({ where: { hogarId_huella: { hogarId, huella } }, select: SELECCION_RESUMEN });
  if (yaEstaba !== null && yaEstaba.filas === leida.filas.length) {
    return { ok: true, yaLeida: true, cartola: aResumen(yaEstaba) };
  }

  const cartola =
    yaEstaba ??
    (await db.cartola.create({
      data: {
        hogarId,
        huella,
        miembroId: entrada.miembroId,
        cuentaBancariaId: cuenta?.id ?? null,
        banco: leida.banco,
        ultimos4: leida.ultimos4,
        plantilla: leida.plantilla,
        numero: leida.numero,
        desde: fechaDesdeISO(leida.desde),
        hasta: fechaDesdeISO(leida.hasta),
        filas: 0,
        nuevas: 0,
        yaEstaban: 0,
        fuera: 0,
        cargos: cuadre.cargos,
        abonos: cuadre.abonos,
      },
      select: SELECCION_RESUMEN,
    }));

  // 4. Cada fila, como un movimiento.
  const recibidoEn = entrada.recibidoEn ?? new Date();
  const claves = clavesDeLasFilas(leida);
  let nuevas = 0;
  let yaEstaban = 0;
  let fuera = 0;
  for (const [i, fila] of leida.filas.entries()) {
    const lectura = lecturaDeLaFila(fila, { ...leida, ultimos4: cuenta?.ultimos4 ?? leida.ultimos4 });
    const registrado = await registrarMovimiento(
      hogarId,
      {
        huella: sha256(claves[i]!),
        lectura,
        recibidoEn,
        miembroId: entrada.miembroId,
        remitente: entrada.remitente ?? null,
        cartola: { id: cartola.id, cuentaBancariaId: cuenta?.id ?? null },
      },
      db,
    );
    if (!registrado.nuevo || registrado.juntado) yaEstaban++;
    else if (registrado.estado === "POR_REVISAR") nuevas++;
    else fuera++;
  }

  const terminada = await db.cartola.update({
    where: { id: cartola.id },
    data: { filas: leida.filas.length, nuevas, yaEstaban, fuera },
    select: SELECCION_RESUMEN,
  });
  return { ok: true, yaLeida: false, cartola: aResumen(terminada) };
}

/** Las ultimas cartolas leidas en el hogar, la mas nueva primero. */
export async function leerCartolasDelHogar(
  hogarId: string,
  { db = prisma, cuantas = 6 }: { db?: Db; cuantas?: number } = {},
): Promise<ResumenDeCartola[]> {
  const cartolas = await db.cartola.findMany({
    where: { hogarId },
    orderBy: [{ hasta: "desc" }, { leidaEn: "desc" }],
    take: cuantas,
    select: SELECCION_RESUMEN,
  });
  return cartolas.map(aResumen);
}
