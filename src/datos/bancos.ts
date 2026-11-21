import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, isoDesdeFecha } from "@/lib/fecha";
import { sumarDias } from "@/lib/periodo";
import {
  NOMBRE_DEL_TIPO,
  bancoConocido,
  bancoDelComprobante,
  bancosDelHogar,
  limpiarUltimos4,
  remitentesParaLaRegla,
  type BancoDelHogar,
  type CuentaBancariaDelHogar,
  type TipoCuentaBancaria,
} from "@/dominio/bancos";

/**
 * Las cuentas y tarjetas del hogar: agregarlas, cambiarlas y quitarlas, y lo
 * que se muestra de cada banco. Las reglas estan en src/dominio/bancos.ts.
 *
 * Todos los del hogar ven todas las cuentas (asi Luka reconoce los traspasos
 * entre ellas) y cualquiera puede cambiar o quitar una, como con los gastos.
 * Cada cuenta recuerda quien la agrego: si dos terminan igual, el
 * comprobante va a la de quien lo reenvio.
 */

export class ErrorDeBanco extends Error {}

type Db = PrismaClient;

export type CuentaNueva = {
  banco: string;
  tipo: TipoCuentaBancaria;
  /** Lo que se escribio: se limpia aqui. */
  ultimos4: string;
  apodo?: string | null;
};

/** El nombre que se guarda: el del catalogo si lo es, o el escrito. */
function nombreDelBancoAGuardar(banco: string): string {
  const escrito = banco.trim().replace(/\s+/g, " ");
  if (escrito === "") throw new ErrorDeBanco("Elige el banco o escribe su nombre.");
  if (escrito.length > 60) throw new ErrorDeBanco("El nombre del banco es muy largo.");
  return bancoConocido(escrito)?.nombre ?? escrito;
}

function apodoAGuardar(apodo: string | null | undefined): string | null {
  const limpio = apodo?.trim().replace(/\s+/g, " ") ?? "";
  if (limpio.length > 60) throw new ErrorDeBanco("El nombre de la cuenta es muy largo: hasta 60 letras.");
  return limpio === "" ? null : limpio;
}

function ultimos4AGuardar(texto: string): string {
  const ultimos4 = limpiarUltimos4(texto);
  if (ultimos4 === null) throw new ErrorDeBanco("Los últimos dígitos son 4 números, nunca el número completo.");
  return ultimos4;
}

function repetida(banco: string, tipo: TipoCuentaBancaria, ultimos4: string): ErrorDeBanco {
  return new ErrorDeBanco(`Esa ya está en el hogar: ${NOMBRE_DEL_TIPO[tipo].toLowerCase()} de ${banco} terminada en ${ultimos4}.`);
}

function esRepetida(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

async function miembroDelHogar(db: Db, hogarId: string, miembroId: string): Promise<void> {
  const miembro = await db.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { id: true } });
  if (!miembro) throw new ErrorDeBanco("Ya no eres parte de este hogar.");
}

/** Las cuentas del hogar, en el orden en que se agregaron. */
export async function leerCuentasBancarias(hogarId: string, db: Db = prisma): Promise<CuentaBancariaDelHogar[]> {
  return db.cuentaBancaria.findMany({
    where: { hogarId },
    orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
    select: { id: true, banco: true, tipo: true, ultimos4: true, apodo: true, miembroId: true },
  });
}

/**
 * Agrega las cuentas de un banco, todas o ninguna. Quedan como de quien las
 * agrega.
 */
export async function agregarCuentas(
  hogarId: string,
  miembroId: string,
  cuentas: readonly CuentaNueva[],
  db: Db = prisma,
): Promise<{ banco: string; agregadas: number }> {
  if (cuentas.length === 0) throw new ErrorDeBanco("Agrega al menos una cuenta o tarjeta.");
  if (cuentas.length > 12) throw new ErrorDeBanco("Son demasiadas de una vez: agrega hasta 12.");
  await miembroDelHogar(db, hogarId, miembroId);

  const filas = cuentas.map((cuenta) => ({
    hogarId,
    miembroId,
    banco: nombreDelBancoAGuardar(cuenta.banco),
    tipo: cuenta.tipo,
    ultimos4: ultimos4AGuardar(cuenta.ultimos4),
    apodo: apodoAGuardar(cuenta.apodo),
  }));
  const vistas = new Set<string>();
  for (const fila of filas) {
    const llave = `${fila.banco}|${fila.tipo}|${fila.ultimos4}`;
    if (vistas.has(llave)) throw new ErrorDeBanco(`Escribiste dos veces la misma: terminada en ${fila.ultimos4}.`);
    vistas.add(llave);
  }

  try {
    await db.$transaction(filas.map((data) => db.cuentaBancaria.create({ data, select: { id: true } })));
  } catch (error) {
    if (!esRepetida(error)) throw error;
    // Cual era: la primera que ya estaba.
    for (const fila of filas) {
      const ya = await db.cuentaBancaria.findFirst({
        where: { hogarId, banco: fila.banco, tipo: fila.tipo, ultimos4: fila.ultimos4 },
        select: { id: true },
      });
      if (ya) throw repetida(fila.banco, fila.tipo, fila.ultimos4);
    }
    throw new ErrorDeBanco("Una de esas cuentas ya está en el hogar.");
  }
  return { banco: filas[0]!.banco, agregadas: filas.length };
}

/** Cambia el tipo, los 4 digitos o el nombre de una cuenta del hogar. */
export async function editarCuenta(
  hogarId: string,
  id: string,
  cambios: { tipo: TipoCuentaBancaria; ultimos4: string; apodo?: string | null },
  db: Db = prisma,
): Promise<void> {
  const actual = await db.cuentaBancaria.findFirst({ where: { id, hogarId }, select: { banco: true } });
  if (!actual) throw new ErrorDeBanco("Esa cuenta ya no está en el hogar.");
  const datos = { tipo: cambios.tipo, ultimos4: ultimos4AGuardar(cambios.ultimos4), apodo: apodoAGuardar(cambios.apodo) };
  try {
    const cambiada = await db.cuentaBancaria.updateMany({ where: { id, hogarId }, data: datos });
    if (cambiada.count === 0) throw new ErrorDeBanco("Esa cuenta ya no está en el hogar.");
  } catch (error) {
    if (esRepetida(error)) throw repetida(actual.banco, datos.tipo, datos.ultimos4);
    throw error;
  }
}

/**
 * Quita una cuenta del hogar. Los movimientos que ya llegaron se quedan,
 * sin cuenta: se puede volver a agregar cuando se quiera.
 */
export async function quitarCuenta(hogarId: string, id: string, db: Db = prisma): Promise<{ banco: string }> {
  const actual = await db.cuentaBancaria.findFirst({ where: { id, hogarId }, select: { banco: true } });
  const borrada = await db.cuentaBancaria.deleteMany({ where: { id, hogarId } });
  if (!actual || borrada.count === 0) throw new ErrorDeBanco("Esa cuenta ya no está en el hogar.");
  return { banco: actual.banco };
}

/** Cuantos dias hacia atras se mira lo que llego de cada banco. */
const DIAS_DE_LO_QUE_LLEGO = 90;

export type LosBancosDelHogar = {
  bancos: BancoDelHogar[];
  /** Los remitentes para la regla de reenvio: los de los bancos del hogar y las tiendas que Luka lee. */
  remitentes: string[];
};

/**
 * Lo que se muestra en «Tus bancos y tarjetas»: cada banco con sus cuentas,
 * el ultimo comprobante que llego y sus remitentes, mas la lista de
 * remitentes para la regla de reenvio.
 */
export async function leerLosBancosDelHogar(
  hogarId: string,
  { db = prisma, hoy }: { db?: Db; hoy: string },
): Promise<LosBancosDelHogar> {
  const [cuentas, llegados] = await Promise.all([
    leerCuentasBancarias(hogarId, db),
    db.movimiento.findMany({
      where: { hogarId, fecha: { gte: fechaDesdeISO(sumarDias(hoy, -DIAS_DE_LO_QUE_LLEGO)) } },
      orderBy: { fecha: "desc" },
      take: 500,
      select: { fecha: true, fuente: true, plantilla: true, remitente: true, cuentaBancaria: { select: { banco: true } } },
    }),
  ]);

  const conBanco = llegados.flatMap((m) => {
    const banco = m.cuentaBancaria?.banco ?? bancoDelComprobante({ plantilla: m.plantilla, remitente: m.remitente, fuente: m.fuente });
    return banco === null ? [] : [{ banco, fecha: isoDesdeFecha(m.fecha), fuente: m.fuente, remitente: m.remitente }];
  });
  const bancos = bancosDelHogar(cuentas, conBanco);
  const aprendidos = conBanco.flatMap((m) => (m.remitente ? [{ banco: m.banco, remitente: m.remitente }] : []));
  return { bancos, remitentes: remitentesParaLaRegla(bancos.map((b) => b.banco), aprendidos) };
}
