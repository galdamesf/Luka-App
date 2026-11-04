import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, isoDesdeFecha, mesDesdeFecha, rangoDelMesISO, sumarMeses } from "@/lib/fecha";
import { mensualesQueFaltan, type CuentaPlana } from "@/dominio/cuentas";
import type { CuentaValidada, EdicionCuentaValidada } from "@/dominio/esquemas";
import type { ClienteDb } from "./gastos";

/*
  Acceso a las cuentas del mes. Como en gastos (ver src/datos/gastos.ts), todo
  recibe primero el hogar de quien mira y solo ve o toca lo de ese hogar: una
  cuenta de otro hogar se comporta como si no existiera.
*/

/**
 * Lo que necesitamos del cliente dentro de una transaccion. Se declara a mano
 * porque el tipo real (Prisma.TransactionClient) lo genera prisma generate, y
 * declararlo asi deja el codigo tipado igual.
 */
type ClienteTx = Pick<ClienteDb, "cuenta" | "gasto">;

const CATEGORIA_INCLUIDA = {
  categoria: {
    select: { id: true, nombre: true, color: true, icono: true, esencial: true },
  },
} as const;

type FilaCuenta = {
  id: string;
  nombre: string;
  monto: number;
  mes: Date;
  diaVencimiento: number | null;
  pagadaEn: Date | null;
  gastoId: string | null;
  mensual: boolean;
  boletaArchivo: string | null;
  nota: string | null;
  categoria: { id: string; nombre: string; color: string; icono: string; esencial: boolean };
};

function aPlano(fila: FilaCuenta): CuentaPlana {
  return {
    id: fila.id,
    nombre: fila.nombre,
    monto: fila.monto,
    mes: mesDesdeFecha(fila.mes),
    diaVencimiento: fila.diaVencimiento,
    categoria: fila.categoria,
    pagadaEn: fila.pagadaEn === null ? null : isoDesdeFecha(fila.pagadaEn),
    gastoId: fila.gastoId,
    mensual: fila.mensual,
    boletaArchivo: fila.boletaArchivo,
    nota: fila.nota,
  };
}

export async function listarCuentasDelMes(
  hogarId: string,
  mes: string,
  db: ClienteDb = prisma,
): Promise<CuentaPlana[]> {
  const filas = (await db.cuenta.findMany({
    where: { hogarId, mes: rangoDelMesISO(mes).desde },
    include: CATEGORIA_INCLUIDA,
    orderBy: [{ diaVencimiento: "asc" }, { nombre: "asc" }],
  })) as FilaCuenta[];
  return filas.map(aPlano);
}

/** La categoria tiene que ser del hogar: si no, la base la rechaza. */
export async function crearCuenta(
  hogarId: string,
  datos: CuentaValidada,
  db: ClienteDb = prisma,
): Promise<CuentaPlana> {
  const fila = (await db.cuenta.create({
    data: {
      hogarId,
      nombre: datos.nombre,
      monto: datos.monto,
      mes: rangoDelMesISO(datos.mes).desde,
      diaVencimiento: datos.diaVencimiento,
      categoriaId: datos.categoriaId,
      mensual: datos.mensual,
      nota: datos.nota,
    },
    include: CATEGORIA_INCLUIDA,
  })) as FilaCuenta;
  return aPlano(fila);
}

/**
 * Edita una cuenta pendiente.
 *
 * Se niega a tocar una cuenta ya pagada, y no por prolijidad: al pagarla se
 * creo un gasto con su monto, su fecha y su categoria. Cambiarle el monto o
 * la categoria despues dejaria la cuenta diciendo una cosa y el gasto otra,
 * y el total del mes ya no cuadraria con la suma de las cuentas. Para
 * cambiarla hay que deshacer el pago primero.
 */
export async function actualizarCuenta(
  hogarId: string,
  datos: EdicionCuentaValidada,
  db: ClienteDb = prisma,
): Promise<CuentaPlana> {
  const actual = await db.cuenta.findFirst({
    where: { id: datos.id, hogarId },
    select: { pagadaEn: true },
  });

  if (actual === null) throw new Error("Esa cuenta ya no existe.");
  if (actual.pagadaEn !== null) {
    throw new Error("La cuenta ya está pagada. Deshaz el pago para poder editarla.");
  }

  const fila = (await db.cuenta.update({
    where: { id: datos.id, hogarId },
    data: {
      nombre: datos.nombre,
      monto: datos.monto,
      diaVencimiento: datos.diaVencimiento,
      categoriaId: datos.categoriaId,
      mensual: datos.mensual,
      nota: datos.nota,
    },
    include: CATEGORIA_INCLUIDA,
  })) as FilaCuenta;

  return aPlano(fila);
}

/**
 * Marca una cuenta como pagada y crea el gasto correspondiente, en una sola
 * transaccion: o quedan las dos cosas o no queda ninguna. Si fallara a medias
 * tendrias una cuenta pagada sin gasto, o un gasto fantasma.
 *
 * El monto puede diferir del esperado: la cuenta de la luz nunca llega igual.
 * El gasto queda en el hogar de la cuenta.
 */
export async function pagarCuenta(
  hogarId: string,
  id: string,
  fechaPago: string,
  montoReal: number,
  boletaArchivo: string | null,
  db: typeof prisma = prisma,
): Promise<CuentaPlana> {
  return db.$transaction(async (tx: ClienteTx) => {
    const cuenta = await tx.cuenta.findFirstOrThrow({
      where: { id, hogarId },
      include: CATEGORIA_INCLUIDA,
    });

    if (cuenta.pagadaEn !== null) {
      throw new Error("Esa cuenta ya está pagada.");
    }

    const gasto = await tx.gasto.create({
      data: {
        hogarId,
        fecha: fechaDesdeISO(fechaPago),
        descripcion: cuenta.nombre.slice(0, 120),
        monto: montoReal,
        categoriaId: cuenta.categoriaId,
        // La boleta nueva manda; si no viene, se arrastra la que ya tenia.
        boletaArchivo: boletaArchivo ?? cuenta.boletaArchivo,
      },
    });

    const actualizada = await tx.cuenta.update({
      where: { id, hogarId },
      data: {
        pagadaEn: fechaDesdeISO(fechaPago),
        gastoId: gasto.id,
        monto: montoReal,
        boletaArchivo: boletaArchivo ?? cuenta.boletaArchivo,
      },
      include: CATEGORIA_INCLUIDA,
    });

    return aPlano(actualizada as FilaCuenta);
  });
}

/**
 * Deshace el pago: borra el gasto que se habia creado y deja la cuenta
 * pendiente otra vez. En transaccion, por lo mismo que pagarCuenta.
 */
export async function revertirPago(
  hogarId: string,
  id: string,
  db: typeof prisma = prisma,
): Promise<void> {
  await db.$transaction(async (tx: ClienteTx) => {
    const cuenta = await tx.cuenta.findFirstOrThrow({ where: { id, hogarId } });

    // Primero soltar el enlace: con el CHECK puesto, borrar el gasto mientras
    // la cuenta lo apunta dejaria un estado intermedio invalido.
    await tx.cuenta.update({
      where: { id, hogarId },
      data: { pagadaEn: null, gastoId: null },
    });

    if (cuenta.gastoId !== null) {
      await tx.gasto.delete({ where: { id: cuenta.gastoId, hogarId } });
    }
  });
}

export async function eliminarCuenta(hogarId: string, id: string, db: ClienteDb = prisma): Promise<void> {
  await db.cuenta.delete({ where: { id, hogarId } });
}

export async function adjuntarBoletaACuenta(
  hogarId: string,
  id: string,
  archivo: string,
  db: ClienteDb = prisma,
): Promise<void> {
  await db.cuenta.update({ where: { id, hogarId }, data: { boletaArchivo: archivo } });
}

/**
 * Adjunta la boleta a un gasto. Si el gasto es el pago de una cuenta, la
 * cuenta se queda con la misma foto: es la que se ve en Pagos del mes, y si
 * no se copiara la boleta solo apareceria en Movimientos.
 */
export async function adjuntarBoletaAGasto(
  hogarId: string,
  id: string,
  archivo: string,
  db: typeof prisma = prisma,
): Promise<void> {
  await db.$transaction([
    db.gasto.update({ where: { id, hogarId }, data: { boletaArchivo: archivo } }),
    db.cuenta.updateMany({ where: { gastoId: id, hogarId }, data: { boletaArchivo: archivo } }),
  ]);
}

/**
 * Crea las cuentas mensuales que faltan en `mes`, copiandolas del mes
 * anterior del mismo hogar. Es idempotente: el indice unico (hogar, nombre,
 * mes) impide duplicar aunque se llame dos veces a la vez.
 *
 * @returns cuantas se crearon.
 */
export async function regenerarMensuales(
  hogarId: string,
  mes: string,
  db: ClienteDb = prisma,
): Promise<number> {
  const anterior = sumarMeses(mes, -1);

  const [delAnterior, deEsteMes] = await Promise.all([
    listarCuentasDelMes(hogarId, anterior, db),
    listarCuentasDelMes(hogarId, mes, db),
  ]);

  const faltantes = mensualesQueFaltan(delAnterior, deEsteMes);
  if (faltantes.length === 0) return 0;

  const resultado = await db.cuenta.createMany({
    data: faltantes.map((f) => ({
      hogarId,
      nombre: f.nombre,
      monto: f.monto,
      mes: rangoDelMesISO(mes).desde,
      diaVencimiento: f.diaVencimiento,
      categoriaId: f.categoriaId,
      mensual: true,
    })),
    // Si otra pestana las creo primero, no es un error.
    skipDuplicates: true,
  });

  return resultado.count;
}
