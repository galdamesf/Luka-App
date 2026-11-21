import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, hoyISO, isoDesdeFecha, mesDesdeFecha, rangoDelMesISO, sumarMeses } from "@/lib/fecha";
import { periodoDeFecha, sumarDias } from "@/lib/periodo";
import { cuotaEnMes } from "@/dominio/balance";
import { bancoDelComprobante, cuentaDelMovimiento, nombreDeLaCuenta } from "@/dominio/bancos";
import type { Bandeja, ItemDejadoFuera, ItemPorRevisar, ReglaPosible } from "@/dominio/bandeja";
import type { LecturaLeida } from "@/dominio/comprobantes/tipos";
import type { MedioPago } from "@/dominio/esquemas";
import {
  DIAS_PARA_JUNTAR,
  DIAS_PARA_PREGUNTAR,
  calzaConClave,
  claveDeComercio,
  deLectura,
  elegirPareja,
  motivoParaDejarFuera,
  propuestaDeDeuda,
  puedeAnotarseIgual,
  revisar,
  type ContextoDeRevision,
  type CuotaPendiente,
  type DatosDeMovimiento,
  type DestinoMovimiento,
  type EstadoMovimiento,
  type GastoParaComparar,
  type PendientesDelMes,
} from "@/dominio/movimientos";
import { pagarCuentaEn, revertirPagoEn } from "./cuentas";
import { pagarCuotaEn, revertirCuotaEn } from "./deudas";

/**
 * Los movimientos que llegan de los comprobantes y la bandeja «Por revisar».
 * Las reglas (que va a la bandeja, que queda fuera, que se junta) estan en
 * src/dominio/movimientos.ts; aqui se leen y se guardan.
 *
 * Como en el resto del acceso a datos, todo recibe primero el hogar de quien
 * mira y solo ve o toca lo de ese hogar: un movimiento de otro hogar se
 * comporta como si no existiera. Y el cliente va al final, con el singleton
 * por omision, para que los tests le pasen el de la base _test.
 *
 * Confirmar es siempre una sola transaccion: el movimiento se cierra y el
 * gasto (o el pago de la cuenta, o la deuda) se crea, o no pasa ninguna de
 * las dos cosas. Y cerrarlo pide que siga por revisar: si dos personas del
 * hogar confirman lo mismo a la vez, la segunda no crea otro gasto.
 */

type Db = typeof prisma;

/** Un error para mostrar tal cual: dice que paso y que hacer. */
export class ErrorDeMovimiento extends Error {}

const DIA_MS = 86_400_000;

/** Cuanto se mira hacia atras para la categoria de siempre de un comercio. */
const DIAS_DE_HISTORIAL = 180;
/** Lo que paso en este tiempo mantiene la bandeja a la vista, aunque este al dia. */
const DIAS_DE_ACTIVIDAD = 30;
const MAXIMO_POR_REVISAR = 100;
const MAXIMO_DEJADOS_FUERA = 20;

/**
 * La huella de un correo: SHA-256 de su identificador (el Message-ID, sin los
 * signos < >) o, si no trae, de su contenido. Es lo que hace que el mismo
 * correo reenviado dos veces sea un solo movimiento.
 */
export function huellaDeCorreo(identificador: string): string {
  const limpio = identificador.trim().replace(/^<|>$/g, "");
  return createHash("sha256").update(limpio).digest("hex");
}

function codigoDe(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : null;
}

function columnas(datos: DatosDeMovimiento) {
  return { ...datos, fecha: fechaDesdeISO(datos.fecha) };
}

// ---------------------------------------------------------------------------
// Lo que llega
// ---------------------------------------------------------------------------

export type EntradaDeMovimiento = {
  /** Ver huellaDeCorreo. */
  huella: string;
  lectura: LecturaLeida;
  /** Cuando llego el correo. */
  recibidoEn: Date;
  /** Quien lo reenvio, si llego por el buzon. Tiene que ser del hogar. */
  miembroId?: string | null;
  /** El correo confirmado desde el que llego. */
  reenviadoPor?: string | null;
  /** El banco o la tienda que lo mando. */
  remitente?: string | null;
};

export type MovimientoRegistrado = {
  id: string;
  estado: EstadoMovimiento;
  /** false si ese correo ya habia llegado: no se creo nada. */
  nuevo: boolean;
};

/**
 * Guarda lo que leyo el lector de un comprobante. Es idempotente: el mismo
 * correo (la misma huella) en el mismo hogar devuelve el movimiento que ya
 * estaba, sin crear otro, aunque lleguen las dos copias a la vez.
 *
 * Si es la otra mitad de una compra que ya llego (la boleta y el aviso, el
 * cargo y su comprobante), los junta: queda a la vista el que dice mas, y el
 * otro pasa a JUNTADO. Si el que ya estaba se confirmo, el nuevo se junta con
 * el y no se crea otro gasto.
 */
export async function registrarMovimiento(
  hogarId: string,
  entrada: EntradaDeMovimiento,
  db: Db = prisma,
): Promise<MovimientoRegistrado> {
  if (!/^[0-9a-f]{64}$/.test(entrada.huella)) {
    throw new ErrorDeMovimiento("La huella del correo tiene que ser un SHA-256 en hexadecimal.");
  }
  const llave = { hogarId_huella: { hogarId, huella: entrada.huella } };
  const yaEstaba = await db.movimiento.findUnique({ where: llave, select: { id: true, estado: true } });
  if (yaEstaba !== null) return { ...yaEstaba, nuevo: false };

  try {
    return await db.$transaction(async (tx) => {
      const cuentas = await tx.cuentaBancaria.findMany({
        where: { hogarId },
        select: { id: true, banco: true, tipo: true, ultimos4: true, miembroId: true },
      });
      const datos = deLectura(entrada.lectura, cuentas);

      // Quien lo reenvio, solo si es del hogar; y de que cuenta es.
      const miembroId =
        entrada.miembroId
          ? ((await tx.miembro.findFirst({ where: { id: entrada.miembroId, hogarId }, select: { id: true } }))?.id ?? null)
          : null;
      const remitente = entrada.remitente?.trim().toLowerCase().slice(0, 254) || null;
      const banco = bancoDelComprobante({ plantilla: datos.plantilla, remitente, fuente: datos.fuente });
      const cuentaCon = (ultimos4: string | null) =>
        cuentaDelMovimiento({ tipo: datos.tipo, medioPago: datos.medioPago, ultimos4 }, banco, cuentas, miembroId);
      const delBuzon = {
        miembroId,
        reenviadoPor: entrada.reenviadoPor?.trim().toLowerCase().slice(0, 254) || null,
        remitente,
        cuentaBancariaId: cuentaCon(datos.ultimos4),
      };

      const candidatos = await tx.movimiento.findMany({
        where: {
          hogarId,
          monto: datos.monto,
          moneda: datos.moneda,
          sentido: datos.sentido,
          estado: { in: ["POR_REVISAR", "CONFIRMADO", "IGNORADO"] },
          fecha: {
            gte: fechaDesdeISO(sumarDias(datos.fecha, -DIAS_PARA_JUNTAR)),
            lte: fechaDesdeISO(sumarDias(datos.fecha, DIAS_PARA_JUNTAR)),
          },
        },
        select: {
          id: true,
          estado: true,
          tipo: true,
          sentido: true,
          monto: true,
          moneda: true,
          fecha: true,
          ultimos4: true,
          sinDetalle: true,
          medioPago: true,
          cuentaBancariaId: true,
          _count: { select: { juntados: true } },
        },
      });
      const pareja = elegirPareja(
        datos,
        candidatos.map((c) => ({ ...c, fecha: isoDesdeFecha(c.fecha), tieneJuntado: c._count.juntados > 0 })),
      );

      const base = { hogarId, huella: entrada.huella, recibidoEn: entrada.recibidoEn, ...columnas(datos), ...delBuzon };
      const elegir = { id: true, estado: true } as const;

      if (pareja === null) {
        return { ...(await tx.movimiento.create({ data: base, select: elegir })), nuevo: true };
      }
      const otro = candidatos.find((c) => c.id === pareja.candidato.id)!;
      if (pareja.principal === "candidato") {
        const creado = await tx.movimiento.create({
          data: { ...base, estado: "JUNTADO", juntadoConId: pareja.candidato.id },
          select: elegir,
        });
        // Si el que se ve no sabia de que cuenta era y este si, ahora lo sabe.
        if (otro.cuentaBancariaId === null && base.cuentaBancariaId !== null) {
          await tx.movimiento.update({ where: { id: otro.id }, data: { cuentaBancariaId: base.cuentaBancariaId } });
        }
        return { ...creado, nuevo: true };
      }

      // El nuevo dice mas: queda a la vista, con lo que le faltaba del otro.
      const ultimos4 = base.ultimos4 ?? otro.ultimos4;
      const creado = await tx.movimiento.create({
        data: {
          ...base,
          medioPago: base.medioPago ?? otro.medioPago,
          ultimos4,
          cuentaBancariaId: base.cuentaBancariaId ?? otro.cuentaBancariaId ?? cuentaCon(ultimos4),
        },
        select: elegir,
      });
      await tx.movimiento.update({ where: { id: otro.id }, data: { estado: "JUNTADO", juntadoConId: creado.id } });
      return { ...creado, nuevo: true };
    });
  } catch (error) {
    // Las dos copias del mismo correo a la vez: la segunda choca con el
    // indice unico, y lo correcto es devolver la que quedo.
    if (codigoDe(error) === "P2002") {
      const quedo = await db.movimiento.findUnique({ where: llave, select: { id: true, estado: true } });
      if (quedo !== null) return { ...quedo, nuevo: false };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// La bandeja
// ---------------------------------------------------------------------------

const SELECCION_POR_REVISAR = {
  id: true,
  tipo: true,
  sentido: true,
  monto: true,
  moneda: true,
  fecha: true,
  comercio: true,
  fuente: true,
  plantilla: true,
  confianza: true,
  medioPago: true,
  ultimos4: true,
  cuotas: true,
  contraparteNombre: true,
  contraparteBanco: true,
  contraparteUltimos4: true,
  sinDetalle: true,
  reenviadoAMano: true,
  juntados: { select: { fuente: true }, orderBy: { recibidoEn: "asc" } },
  cuentaBancaria: { select: { apodo: true, tipo: true, ultimos4: true } },
} as const;

const SELECCION_GASTO = {
  id: true,
  fecha: true,
  descripcion: true,
  monto: true,
  categoriaId: true,
  cuenta: { select: { nombre: true } },
  cuota: { select: { deuda: { select: { nombre: true } } } },
  movimientos: { select: { fuente: true } },
} as const;

type FilaGasto = {
  id: string;
  fecha: Date;
  descripcion: string;
  monto: number;
  categoriaId: string;
  cuenta: { nombre: string } | null;
  cuota: { deuda: { nombre: string } } | null;
  movimientos?: { fuente: string }[];
};

function paraComparar(fila: FilaGasto): GastoParaComparar {
  return {
    id: fila.id,
    fecha: isoDesdeFecha(fila.fecha),
    descripcion: fila.descripcion,
    monto: fila.monto,
    categoriaId: fila.categoriaId,
    pagoDe:
      fila.cuota !== null
        ? { tipo: "cuota", nombre: fila.cuota.deuda.nombre }
        : fila.cuenta !== null
          ? { tipo: "cuenta", nombre: fila.cuenta.nombre }
          : null,
    fuentes: [...new Set((fila.movimientos ?? []).map((m) => m.fuente))],
  };
}

/**
 * Lo que la bandeja necesita del hogar para proponer algo por cada
 * movimiento: reglas, categorias, los gastos de los ultimos meses (para la
 * categoria de siempre y para preguntar si ya estaba anotado) y lo que falta
 * pagar en el mes de cada movimiento y el anterior.
 */
async function contextoDeRevision(
  hogarId: string,
  filas: readonly { fecha: Date; monto: number; moneda: string }[],
  hoy: string,
  diaInicioMes: number,
  db: Db,
): Promise<{ base: Omit<ContextoDeRevision, "pendientes">; pendientesDe: (fecha: string) => PendientesDelMes[] }> {
  const fechas = filas.map((f) => isoDesdeFecha(f.fecha)).sort();
  const primera = fechas[0]!;
  const ultima = fechas[fechas.length - 1]!;
  const montos = [...new Set(filas.filter((f) => f.moneda === "CLP").map((f) => f.monto))];

  /** El mes de gastos de una fecha, y el anterior. */
  const mesesDe = (fecha: string) => {
    const mes = periodoDeFecha(fecha, diaInicioMes).mes;
    return [mes, sumarMeses(mes, -1)];
  };
  const meses = [...new Set(fechas.flatMap(mesesDe))];
  const mesesComoFecha = meses.map((mes) => rangoDelMesISO(mes).desde);

  const [categorias, reglas, parecidos, historial, cuentas, deudas, pagadas] = await Promise.all([
    db.categoria.findMany({ where: { hogarId, activa: true }, select: { id: true } }),
    db.reglaDeComercio.findMany({ where: { hogarId }, select: { clave: true, etiqueta: true, categoriaId: true } }),
    montos.length === 0
      ? Promise.resolve([] as FilaGasto[])
      : db.gasto.findMany({
          where: {
            hogarId,
            monto: { in: montos },
            fecha: {
              gte: fechaDesdeISO(sumarDias(primera, -DIAS_PARA_PREGUNTAR)),
              lte: fechaDesdeISO(sumarDias(ultima, DIAS_PARA_PREGUNTAR)),
            },
          },
          select: SELECCION_GASTO,
        }),
    db.gasto.findMany({
      where: { hogarId, fecha: { gte: fechaDesdeISO(sumarDias(hoy, -DIAS_DE_HISTORIAL)) } },
      orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
      take: 2_000,
      select: { id: true, fecha: true, descripcion: true, monto: true, categoriaId: true, cuenta: SELECCION_GASTO.cuenta, cuota: SELECCION_GASTO.cuota },
    }),
    db.cuenta.findMany({
      where: { hogarId, pagadaEn: null, mes: { in: mesesComoFecha } },
      select: { id: true, nombre: true, monto: true, mes: true },
      orderBy: [{ mes: "asc" }, { nombre: "asc" }],
    }),
    db.deuda.findMany({
      where: { hogarId, activa: true },
      select: { id: true, nombre: true, montoCuota: true, cuotasTotales: true, primeraCuota: true, activa: true },
      orderBy: { nombre: "asc" },
    }),
    db.cuotaPagada.findMany({ where: { deuda: { hogarId }, mes: { in: mesesComoFecha } }, select: { deudaId: true, mes: true } }),
  ]);

  // Los parecidos traen de que comprobantes vinieron; pisan a los del historial.
  const gastos = new Map<string, GastoParaComparar>();
  for (const fila of historial as FilaGasto[]) gastos.set(fila.id, paraComparar(fila));
  for (const fila of parecidos as FilaGasto[]) gastos.set(fila.id, paraComparar(fila));

  const yaPagada = new Set(pagadas.map((p) => `${p.deudaId}/${mesDesdeFecha(p.mes)}`));
  const cuotasPendientes: CuotaPendiente[] = [];
  for (const mes of meses) {
    for (const fila of deudas) {
      const deuda = { ...fila, primeraCuota: mesDesdeFecha(fila.primeraCuota) };
      const cuota = cuotaEnMes(deuda, mes);
      if (cuota === null || yaPagada.has(`${deuda.id}/${mes}`)) continue;
      cuotasPendientes.push({
        deudaId: deuda.id,
        nombre: deuda.nombre,
        mes,
        numero: cuota.numero,
        de: deuda.cuotasTotales,
        monto: deuda.montoCuota,
      });
    }
  }

  const cuentasPendientes = cuentas.map((c) => ({ ...c, mes: mesDesdeFecha(c.mes) }));
  return {
    base: {
      reglas,
      gastos: [...gastos.values()],
      categoriasActivas: new Set(categorias.map((c) => c.id)),
      diaInicioMes,
    },
    pendientesDe: (fecha) =>
      mesesDe(fecha).map((mes) => ({
        cuentas: cuentasPendientes.filter((c) => c.mes === mes),
        cuotas: cuotasPendientes.filter((c) => c.mes === mes),
      })),
  };
}

/**
 * La bandeja del hogar: lo que esta por revisar, del mas reciente al mas
 * antiguo, cada uno con lo que se propone hacer, y lo que Luka dejo fuera en
 * el ultimo mes con su motivo.
 *
 * No depende del mes que se este mirando en el panel: lo que llega se revisa
 * cuando llega.
 */
export async function leerBandeja(
  hogarId: string,
  { hoy = hoyISO(), diaInicioMes = 1 }: { hoy?: string; diaInicioMes?: number } = {},
  db: Db = prisma,
): Promise<Bandeja> {
  const desde = new Date(fechaDesdeISO(hoy).getTime() - DIAS_DE_ACTIVIDAD * DIA_MS);
  const [filas, fuera, recientes] = await Promise.all([
    db.movimiento.findMany({
      where: { hogarId, estado: "POR_REVISAR" },
      orderBy: [{ fecha: "desc" }, { recibidoEn: "desc" }, { id: "asc" }],
      take: MAXIMO_POR_REVISAR,
      select: SELECCION_POR_REVISAR,
    }),
    db.movimiento.findMany({
      where: { hogarId, estado: "IGNORADO", actualizadoEn: { gte: desde } },
      orderBy: [{ fecha: "desc" }, { id: "asc" }],
      take: MAXIMO_DEJADOS_FUERA,
      select: { id: true, tipo: true, sentido: true, comercio: true, monto: true, moneda: true, fecha: true, fuente: true },
    }),
    db.movimiento.count({ where: { hogarId, actualizadoEn: { gte: desde } } }),
  ]);

  const dejadosFuera: ItemDejadoFuera[] = fuera.map((f) => ({
    id: f.id,
    comercio: f.comercio,
    monto: f.monto,
    moneda: f.moneda,
    fecha: isoDesdeFecha(f.fecha),
    fuente: f.fuente,
    motivo: motivoParaDejarFuera(f) ?? "sin-movimiento",
    puedeAnotarse: puedeAnotarseIgual(f),
  }));
  const visible = filas.length > 0 || recientes > 0;
  if (filas.length === 0) return { porRevisar: [], dejadosFuera, visible };

  const { base, pendientesDe } = await contextoDeRevision(hogarId, filas, hoy, diaInicioMes, db);

  const porRevisar: ItemPorRevisar[] = filas.map((fila) => {
    const fecha = isoDesdeFecha(fila.fecha);
    const revision = revisar({ ...fila, fecha }, { ...base, pendientes: pendientesDe(fecha) });
    return {
      id: fila.id,
      tipo: fila.tipo,
      sentido: fila.sentido,
      monto: fila.monto,
      moneda: fila.moneda,
      fecha,
      comercio: fila.comercio,
      fuente: fila.fuente,
      medioPago: fila.medioPago,
      ultimos4: fila.ultimos4,
      cuotas: fila.cuotas,
      contraparte: { nombre: fila.contraparteNombre, banco: fila.contraparteBanco, ultimos4: fila.contraparteUltimos4 },
      confianza: fila.confianza,
      juntados: fila.juntados.map((j) => j.fuente),
      cuenta: fila.cuentaBancaria === null ? null : nombreDeLaCuenta(fila.cuentaBancaria),
      revision,
    };
  });

  return { porRevisar, dejadosFuera, visible };
}

// ---------------------------------------------------------------------------
// Confirmar
// ---------------------------------------------------------------------------

/** Como se confirma un movimiento. Lo que no viene se toma del comprobante. */
export type Confirmacion =
  | {
      como: "gasto";
      categoriaId: string;
      descripcion?: string;
      /** En pesos. Obligatorio si el comprobante es en dolares. */
      monto?: number;
      fecha?: string;
    }
  | { como: "mismo-gasto"; gastoId: string }
  | { como: "pago-de-cuenta"; cuentaId: string }
  | { como: "pago-de-cuota"; deudaId: string; mes: string }
  | { como: "deuda" };

const DESTINO: Record<Confirmacion["como"], DestinoMovimiento> = {
  gasto: "GASTO_NUEVO",
  "mismo-gasto": "GASTO_EXISTENTE",
  "pago-de-cuenta": "PAGO_DE_CUENTA",
  "pago-de-cuota": "PAGO_DE_CUOTA",
  deuda: "DEUDA",
};

export type Confirmado = {
  id: string;
  destino: DestinoMovimiento;
  /** Lo que quedo anotado, para el aviso: "Líder", "Luz", "PARIS.CL". */
  descripcion: string;
  /** En pesos. En una deuda, lo de cada cuota. */
  monto: number;
  /** La categoria del gasto nuevo. */
  categoria: string | null;
  /** En una deuda: en cuantas cuotas y desde que mes. */
  deuda: { cuotas: number; primeraCuota: string } | null;
  /** Despues de un gasto nuevo: la regla que se puede crear o cambiar. */
  regla: ReglaPosible | null;
};

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

/** Lo que salio de una cuenta y no se sabe como: "Otro". Una transferencia, transferencia. */
function medioPorOmision(tipo: string, medio: MedioPago | null): MedioPago {
  if (medio !== null) return medio;
  return tipo === "TRANSFERENCIA" ? "TRANSFERENCIA" : "OTRO";
}

/**
 * Lo cierra solo si sigue por revisar. Dentro de la transaccion la fila queda
 * tomada: quien llegue segundo espera, y despues ya no lo encuentra.
 */
async function tomar(tx: Tx, hogarId: string, id: string, destino: DestinoMovimiento) {
  const tomado = await tx.movimiento.updateMany({
    where: { id, hogarId, estado: "POR_REVISAR" },
    data: { estado: "CONFIRMADO", destino },
  });
  if (tomado.count === 0) throw new ErrorDeMovimiento("Ese movimiento ya no está por revisar.");
  return tx.movimiento.findUniqueOrThrow({ where: { id } });
}

type MovimientoTomado = Awaited<ReturnType<typeof tomar>>;

async function crearGastoDe(
  tx: Tx,
  hogarId: string,
  miembroId: string | null,
  movimiento: MovimientoTomado,
  datos: { categoriaId: string; descripcion?: string; monto?: number; fecha?: string },
) {
  if (movimiento.moneda !== "CLP" && datos.monto === undefined) {
    throw new ErrorDeMovimiento("Fue en dólares: escribe cuánto fue en pesos.");
  }
  const descripcion = (datos.descripcion?.trim() || movimiento.comercio).slice(0, 120);
  const gasto = await tx.gasto.create({
    data: {
      hogarId,
      anotadoPorId: miembroId,
      fecha: fechaDesdeISO(datos.fecha ?? isoDesdeFecha(movimiento.fecha)),
      descripcion,
      monto: datos.monto ?? movimiento.monto,
      medioPago: medioPorOmision(movimiento.tipo, movimiento.medioPago),
      categoriaId: datos.categoriaId,
    },
    select: { id: true, descripcion: true, monto: true, categoria: { select: { nombre: true } } },
  });
  await tx.movimiento.update({ where: { id: movimiento.id }, data: { gastoId: gasto.id } });
  return gasto;
}

/**
 * La regla que se puede ofrecer despues de anotar un gasto: crearla si el
 * comercio no tenia, o cambiarla si tenia otra categoria. null si ya tiene
 * esa misma, o si el movimiento no tiene comercio para una regla.
 */
async function reglaPosible(
  tx: Tx,
  hogarId: string,
  movimiento: MovimientoTomado,
  categoriaId: string,
  categoria: string,
): Promise<ReglaPosible | null> {
  const clave = claveDeComercio(movimiento.comercio, movimiento.tipo, movimiento.sinDetalle);
  if (clave === null) return null;
  const reglas = await tx.reglaDeComercio.findMany({ where: { hogarId }, select: { clave: true, categoriaId: true } });
  const actual = reglas
    .filter((r) => calzaConClave(movimiento.comercio, r.clave))
    .sort((a, b) => b.clave.split(" ").length - a.clave.split(" ").length)[0];
  if (actual?.categoriaId === categoriaId) return null;
  return { movimientoId: movimiento.id, categoriaId, categoria, etiqueta: legible(clave.etiqueta), cambia: actual !== undefined };
}

/** "COMERCIAL LOS AROMOS" se muestra "Comercial Los Aromos"; lo que ya trae minusculas, tal cual. */
export function legible(etiqueta: string): string {
  if (/\p{Ll}/u.test(etiqueta)) return etiqueta;
  return etiqueta
    .toLocaleLowerCase("es-CL")
    .replace(/(^|\s)(\p{L})/gu, (_, espacio: string, letra: string) => espacio + letra.toLocaleUpperCase("es-CL"));
}

/**
 * Confirma un movimiento por revisar, en una sola transaccion con lo que
 * crea:
 *
 *   - gasto: un gasto nuevo, en la categoria elegida y a nombre de quien lo
 *     confirma. Si el comprobante es en dolares, con el monto en pesos.
 *   - mismo-gasto: lo enlaza con un gasto que ya estaba anotado.
 *   - pago-de-cuenta / pago-de-cuota: la paga, que es lo que crea su gasto,
 *     con la fecha y el monto del comprobante.
 *   - deuda: una compra en cuotas queda como deuda, sin gasto.
 */
export async function confirmarMovimiento(
  hogarId: string,
  miembroId: string | null,
  id: string,
  confirmacion: Confirmacion,
  db: Db = prisma,
): Promise<Confirmado> {
  const destino = DESTINO[confirmacion.como];
  return db.$transaction(async (tx) => {
    const movimiento = await tomar(tx, hogarId, id, destino);
    const fecha = isoDesdeFecha(movimiento.fecha);
    const sinDeuda = { deuda: null, regla: null };

    switch (confirmacion.como) {
      case "gasto": {
        const gasto = await crearGastoDe(tx, hogarId, miembroId, movimiento, confirmacion);
        const regla = await reglaPosible(tx, hogarId, movimiento, confirmacion.categoriaId, gasto.categoria.nombre);
        return {
          id,
          destino,
          descripcion: gasto.descripcion,
          monto: gasto.monto,
          categoria: gasto.categoria.nombre,
          deuda: null,
          regla,
        };
      }
      case "mismo-gasto": {
        const gasto = await tx.gasto.findFirst({
          where: { id: confirmacion.gastoId, hogarId },
          select: { id: true, descripcion: true, monto: true },
        });
        if (gasto === null) throw new ErrorDeMovimiento("Ese gasto ya no existe. Recarga la página.");
        await tx.movimiento.update({ where: { id }, data: { gastoId: gasto.id } });
        return { id, destino, descripcion: gasto.descripcion, monto: gasto.monto, categoria: null, ...sinDeuda };
      }
      case "pago-de-cuenta": {
        if (movimiento.moneda !== "CLP") throw new ErrorDeMovimiento("Una cuenta se paga en pesos.");
        const { cuenta, gastoId } = await pagarCuentaEn(tx, hogarId, confirmacion.cuentaId, fecha, movimiento.monto, null);
        await tx.movimiento.update({ where: { id }, data: { gastoId } });
        return { id, destino, descripcion: cuenta.nombre, monto: movimiento.monto, categoria: null, ...sinDeuda };
      }
      case "pago-de-cuota": {
        if (movimiento.moneda !== "CLP") throw new ErrorDeMovimiento("Una cuota se paga en pesos.");
        const { gastoId } = await pagarCuotaEn(tx, hogarId, confirmacion.deudaId, confirmacion.mes, fecha, movimiento.monto, null);
        const deuda = await tx.deuda.findUniqueOrThrow({ where: { id: confirmacion.deudaId }, select: { nombre: true } });
        await tx.movimiento.update({ where: { id }, data: { gastoId } });
        return { id, destino, descripcion: deuda.nombre, monto: movimiento.monto, categoria: null, ...sinDeuda };
      }
      case "deuda": {
        if (movimiento.cuotas === null || movimiento.moneda !== "CLP") {
          throw new ErrorDeMovimiento("Este movimiento no es una compra en cuotas.");
        }
        const ajustes = await tx.ajustes.findUnique({ where: { hogarId }, select: { diaInicioMes: true } });
        const propuesta = propuestaDeDeuda({ ...movimiento, cuotas: movimiento.cuotas, fecha }, ajustes?.diaInicioMes ?? 1);
        const deuda = await tx.deuda.create({
          data: {
            hogarId,
            nombre: propuesta.nombre,
            montoCuota: propuesta.montoCuota,
            cuotasTotales: propuesta.cuotas,
            primeraCuota: rangoDelMesISO(propuesta.primeraCuota).desde,
          },
          select: { id: true },
        });
        await tx.movimiento.update({ where: { id }, data: { deudaId: deuda.id } });
        return {
          id,
          destino,
          descripcion: propuesta.nombre,
          monto: propuesta.montoCuota,
          categoria: null,
          deuda: { cuotas: propuesta.cuotas, primeraCuota: propuesta.primeraCuota },
          regla: null,
        };
      }
    }
  });
}

/**
 * «Confirmar las listas»: varios gastos nuevos de una vez, cada uno con la
 * categoria que tenia elegida, en una sola transaccion. Lo que ya no esta
 * por revisar (otra persona del hogar lo confirmo) o es en dolares se salta
 * sin fallar; una categoria que no es del hogar si hace fallar todo.
 */
export async function confirmarVarios(
  hogarId: string,
  miembroId: string | null,
  elegidos: readonly { id: string; categoriaId: string }[],
  db: Db = prisma,
): Promise<{ confirmados: { id: string; descripcion: string; monto: number }[]; saltados: number }> {
  return db.$transaction(async (tx) => {
    const categorias = [...new Set(elegidos.map((e) => e.categoriaId))];
    const delHogar = await tx.categoria.count({ where: { hogarId, id: { in: categorias } } });
    if (delHogar !== categorias.length) {
      throw new ErrorDeMovimiento("Una de las categorías ya no existe. Recarga la página.");
    }

    const confirmados: { id: string; descripcion: string; monto: number }[] = [];
    for (const { id, categoriaId } of elegidos) {
      const pendiente = await tx.movimiento.findFirst({
        where: { id, hogarId, estado: "POR_REVISAR", moneda: "CLP" },
        select: { id: true },
      });
      if (pendiente === null) continue;
      const movimiento = await tomar(tx, hogarId, id, "GASTO_NUEVO");
      const gasto = await crearGastoDe(tx, hogarId, miembroId, movimiento, { categoriaId });
      confirmados.push({ id, descripcion: gasto.descripcion, monto: gasto.monto });
    }
    return { confirmados, saltados: elegidos.length - confirmados.length };
  });
}

/** Lo saca de la bandeja: no es un gasto, o no es del hogar. */
export async function descartarMovimiento(hogarId: string, id: string, db: Db = prisma): Promise<{ comercio: string }> {
  const movimiento = await db.movimiento.findFirst({
    where: { id, hogarId, estado: "POR_REVISAR" },
    select: { comercio: true },
  });
  const hecho = await db.movimiento.updateMany({
    where: { id, hogarId, estado: "POR_REVISAR" },
    data: { estado: "DESCARTADO" },
  });
  if (movimiento === null || hecho.count === 0) throw new ErrorDeMovimiento("Ese movimiento ya no está por revisar.");
  return movimiento;
}

/**
 * Vuelve a la bandeja algo que Luka dejo fuera: un traspaso que en verdad
 * fue un pago, un giro que se quiere anotar. Un ingreso no: en Luka un gasto
 * siempre es plata que sale.
 */
export async function anotarIgual(hogarId: string, id: string, db: Db = prisma): Promise<{ comercio: string }> {
  const movimiento = await db.movimiento.findFirst({
    where: { id, hogarId, estado: "IGNORADO" },
    select: { tipo: true, sentido: true, comercio: true },
  });
  if (movimiento === null) throw new ErrorDeMovimiento("Ese movimiento ya no está entre los que Luka dejó fuera.");
  if (!puedeAnotarseIgual(movimiento)) throw new ErrorDeMovimiento("Es plata que entró: no se puede anotar como gasto.");
  const hecho = await db.movimiento.updateMany({ where: { id, hogarId, estado: "IGNORADO" }, data: { estado: "POR_REVISAR" } });
  if (hecho.count === 0) throw new ErrorDeMovimiento("Ese movimiento ya no está entre los que Luka dejó fuera.");
  return { comercio: movimiento.comercio };
}

/** Borra un gasto como eliminarGasto (src/datos/gastos.ts), dentro de una transaccion ya abierta. */
async function borrarGastoEn(tx: Tx, hogarId: string, gastoId: string): Promise<void> {
  await tx.cuotaPagada.deleteMany({ where: { gastoId, gasto: { hogarId } } });
  await tx.cuenta.updateMany({ where: { gastoId, hogarId }, data: { pagadaEn: null, gastoId: null } });
  await tx.gasto.deleteMany({ where: { id: gastoId, hogarId } });
}

/**
 * Deshace una confirmacion: el movimiento vuelve a la bandeja y se deshace
 * lo que creo. El gasto nuevo se borra; la cuenta o la cuota vuelven a
 * pendiente; la deuda se borra, salvo que ya tenga cuotas pagadas. Un gasto
 * que ya estaba anotado (mismo-gasto) se queda: solo se suelta el enlace.
 */
async function deshacerConfirmacionEn(tx: Tx, hogarId: string, id: string): Promise<void> {
  const movimiento = await tx.movimiento.findFirst({
    where: { id, hogarId, estado: "CONFIRMADO" },
    select: { destino: true, gastoId: true, deudaId: true },
  });
  if (movimiento === null) throw new ErrorDeMovimiento("Ese movimiento ya no está confirmado.");

  // Primero se suelta el movimiento, despues se borra lo que creo: asi nada
  // queda apuntando a algo que ya no existe.
  await tx.movimiento.update({
    where: { id },
    data: { estado: "POR_REVISAR", destino: null, gastoId: null, deudaId: null },
  });

  const { gastoId, deudaId } = movimiento;
  switch (movimiento.destino) {
    case "GASTO_NUEVO":
      if (gastoId !== null) await borrarGastoEn(tx, hogarId, gastoId);
      return;
    case "PAGO_DE_CUENTA": {
      if (gastoId === null) return;
      const cuenta = await tx.cuenta.findFirst({ where: { gastoId, hogarId }, select: { id: true } });
      if (cuenta !== null) await revertirPagoEn(tx, hogarId, cuenta.id);
      else await borrarGastoEn(tx, hogarId, gastoId);
      return;
    }
    case "PAGO_DE_CUOTA": {
      if (gastoId === null) return;
      const cuota = await tx.cuotaPagada.findFirst({
        where: { gastoId, deuda: { hogarId } },
        select: { deudaId: true, mes: true },
      });
      if (cuota !== null) await revertirCuotaEn(tx, hogarId, cuota.deudaId, mesDesdeFecha(cuota.mes));
      else await borrarGastoEn(tx, hogarId, gastoId);
      return;
    }
    case "DEUDA": {
      if (deudaId === null) return;
      const pagadas = await tx.cuotaPagada.count({ where: { deudaId } });
      if (pagadas > 0) {
        throw new ErrorDeMovimiento("Esa deuda ya tiene cuotas pagadas: deshaz esos pagos primero.");
      }
      await tx.deuda.deleteMany({ where: { id: deudaId, hogarId } });
      return;
    }
    default:
      return;
  }
}

/**
 * El «Deshacer» del aviso, para lo que se acaba de hacer en la bandeja:
 * confirmar (uno o varios), descartar o anotar igual. Todo o nada, en una
 * sola transaccion.
 */
export async function deshacerEnLaBandeja(
  hogarId: string,
  de: "confirmacion" | "descarte" | "anotar-igual",
  ids: readonly string[],
  db: Db = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const id of ids) {
      if (de === "confirmacion") {
        await deshacerConfirmacionEn(tx, hogarId, id);
      } else if (de === "descarte") {
        const hecho = await tx.movimiento.updateMany({
          where: { id, hogarId, estado: "DESCARTADO" },
          data: { estado: "POR_REVISAR" },
        });
        if (hecho.count === 0) throw new ErrorDeMovimiento("Ese movimiento ya no está descartado.");
      } else {
        const movimiento = await tx.movimiento.findFirst({
          where: { id, hogarId, estado: "POR_REVISAR" },
          select: { tipo: true, sentido: true },
        });
        if (movimiento === null || motivoParaDejarFuera(movimiento) === null) {
          throw new ErrorDeMovimiento("Ese movimiento ya no está por revisar.");
        }
        await tx.movimiento.update({ where: { id }, data: { estado: "IGNORADO" } });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

/**
 * Crea (o cambia) la regla del comercio de un movimiento: desde ahi, lo que
 * llegue de ese comercio trae esa categoria. El comercio sale del movimiento
 * y no del formulario, para que la regla sea la que se mostro.
 */
export async function crearReglaDeComercio(
  hogarId: string,
  movimientoId: string,
  categoriaId: string,
  db: Db = prisma,
): Promise<{ etiqueta: string; categoria: string }> {
  const movimiento = await db.movimiento.findFirst({
    where: { id: movimientoId, hogarId },
    select: { comercio: true, tipo: true, sinDetalle: true },
  });
  if (movimiento === null) throw new ErrorDeMovimiento("Ese movimiento ya no existe.");
  const clave = claveDeComercio(movimiento.comercio, movimiento.tipo, movimiento.sinDetalle);
  if (clave === null) throw new ErrorDeMovimiento("Este movimiento no tiene un comercio para crear la regla.");

  const categoria = await db.categoria.findFirst({ where: { id: categoriaId, hogarId }, select: { nombre: true } });
  if (categoria === null) throw new ErrorDeMovimiento("Esa categoría ya no existe. Recarga la página.");

  const etiqueta = legible(clave.etiqueta);
  await db.reglaDeComercio.upsert({
    where: { hogarId_clave: { hogarId, clave: clave.clave } },
    create: { hogarId, clave: clave.clave, etiqueta, categoriaId },
    update: { etiqueta, categoriaId },
  });
  return { etiqueta, categoria: categoria.nombre };
}
