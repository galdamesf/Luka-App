import { prisma } from "@/lib/prisma";
import { fechaDesdeISO, isoDesdeFecha, mesDesdeFecha, rangoDelMesISO } from "@/lib/fecha";
import type { DeudaPlana, PagoCuota } from "@/dominio/balance";
import { CATEGORIA_CUOTAS, colorDeGrupo } from "@/dominio/categorias-base";
import type { DeudaValidada, EdicionDeudaValidada } from "@/dominio/esquemas";
import type { ClienteDb } from "./gastos";

/**
 * El cliente dentro de una transaccion. Mismo criterio que en cuentas.ts: el
 * tipo real lo genera prisma generate, y declararlo asi deja el codigo tipado.
 */
type ClienteTx = Pick<ClienteDb, "deuda" | "gasto" | "categoria" | "cuotaPagada">;

type FilaDeuda = {
  id: string;
  nombre: string;
  montoCuota: number;
  cuotasTotales: number;
  primeraCuota: Date;
  activa: boolean;
  nota: string | null;
};

function aPlano(fila: FilaDeuda): DeudaPlana {
  return {
    id: fila.id,
    nombre: fila.nombre,
    montoCuota: fila.montoCuota,
    cuotasTotales: fila.cuotasTotales,
    primeraCuota: mesDesdeFecha(fila.primeraCuota),
    activa: fila.activa,
  };
}

/**
 * Todas las deudas, activas primero y dentro de eso por cuota mas alta.
 *
 * Se traen todas y no solo las vigentes del mes: el calculo de que cuota toca
 * vive en el dominio (cuotaEnMes), que ademas necesita las terminadas para
 * poder mostrarlas en el historial.
 */
export async function listarDeudas(db: ClienteDb = prisma): Promise<DeudaPlana[]> {
  const filas = (await db.deuda.findMany({
    orderBy: [{ activa: "desc" }, { montoCuota: "desc" }, { nombre: "asc" }],
  })) as FilaDeuda[];
  return filas.map(aPlano);
}

export async function crearDeuda(
  datos: DeudaValidada,
  db: ClienteDb = prisma,
): Promise<DeudaPlana> {
  const fila = (await db.deuda.create({
    data: {
      nombre: datos.nombre,
      montoCuota: datos.montoCuota,
      cuotasTotales: datos.cuotasTotales,
      // Siempre el dia 1: la base lo exige con un CHECK.
      primeraCuota: rangoDelMesISO(datos.primeraCuota).desde,
      nota: datos.nota,
    },
  })) as FilaDeuda;

  return aPlano(fila);
}

/**
 * Marca una deuda como pagada o anulada. No se borra: borrarla haria que los
 * meses pasados dejaran de cuadrar.
 */
export async function desactivarDeuda(id: string, db: ClienteDb = prisma): Promise<void> {
  await db.deuda.update({ where: { id }, data: { activa: false } });
}

export async function reactivarDeuda(id: string, db: ClienteDb = prisma): Promise<void> {
  await db.deuda.update({ where: { id }, data: { activa: true } });
}

/** Para deshacer una deuda recien creada por error. */
export async function eliminarDeuda(id: string, db: ClienteDb = prisma): Promise<void> {
  await db.deuda.delete({ where: { id } });
}

/**
 * Marca pagada la cuota de un mes y crea el gasto, en una sola transaccion.
 *
 * El par (deuda, mes) es unico en la base, asi que dos clics seguidos en
 * "pagar" no dejan dos registros: el segundo choca contra el indice.
 *
 * El gasto se registra en la categoria de deudas. Si alguien la borro o la
 * renombro, se vuelve a crear aqui mismo: pagar no deberia fallar por eso.
 */
export async function pagarCuota(
  deudaId: string,
  mes: string,
  fechaPago: string,
  montoReal: number,
  boletaArchivo: string | null = null,
  db: typeof prisma = prisma,
): Promise<void> {
  await db.$transaction(async (tx: ClienteTx) => {
    const deuda = await tx.deuda.findUniqueOrThrow({ where: { id: deudaId } });

    const yaPagada = await tx.cuotaPagada.findUnique({
      where: { deudaId_mes: { deudaId, mes: rangoDelMesISO(mes).desde } },
      select: { id: true },
    });
    if (yaPagada !== null) throw new Error("Esa cuota ya está pagada.");

    const categoria =
      (await tx.categoria.findUnique({
        where: { nombre: CATEGORIA_CUOTAS },
        select: { id: true },
      })) ??
      (await tx.categoria.create({
        data: {
          nombre: CATEGORIA_CUOTAS,
          color: colorDeGrupo("otros"),
          icono: "credit-card",
          esencial: true,
        },
        select: { id: true },
      }));

    const gasto = await tx.gasto.create({
      data: {
        fecha: fechaDesdeISO(fechaPago),
        descripcion: deuda.nombre.slice(0, 120),
        monto: montoReal,
        categoriaId: categoria.id,
        boletaArchivo,
      },
    });

    await tx.cuotaPagada.create({
      data: {
        deudaId,
        mes: rangoDelMesISO(mes).desde,
        pagadaEn: fechaDesdeISO(fechaPago),
        monto: montoReal,
        gastoId: gasto.id,
      },
    });
  });
}

/**
 * Deshace el pago de una cuota: borra el registro y el gasto que genero.
 *
 * Primero se suelta el enlace y despues se borra el gasto, igual que en
 * cuentas: borrar el gasto mientras la cuota lo apunta deja un estado
 * intermedio que las restricciones rechazan.
 */
export async function revertirCuota(
  deudaId: string,
  mes: string,
  db: typeof prisma = prisma,
): Promise<void> {
  await db.$transaction(async (tx: ClienteTx) => {
    const cuota = await tx.cuotaPagada.findUnique({
      where: { deudaId_mes: { deudaId, mes: rangoDelMesISO(mes).desde } },
      select: { id: true, gastoId: true },
    });
    if (cuota === null) return;

    await tx.cuotaPagada.delete({ where: { id: cuota.id } });
    if (cuota.gastoId !== null) {
      await tx.gasto.delete({ where: { id: cuota.gastoId } });
    }
  });
}

/** Las cuotas pagadas de un mes, para que el balance sepa que descontar. */
export async function listarPagosDelMes(
  mes: string,
  db: ClienteDb = prisma,
): Promise<PagoCuota[]> {
  const filas = (await db.cuotaPagada.findMany({
    where: { mes: rangoDelMesISO(mes).desde },
    select: { deudaId: true, mes: true, pagadaEn: true, monto: true },
  })) as { deudaId: string; mes: Date; pagadaEn: Date; monto: number }[];

  return filas.map((f) => ({
    deudaId: f.deudaId,
    // Siempre por los helpers: leer un @db.Date con metodos locales corre el dia.
    mes: mesDesdeFecha(f.mes),
    pagadaEn: isoDesdeFecha(f.pagadaEn),
    monto: f.monto,
  }));
}

/**
 * Edita una deuda.
 *
 * Se niega si ya hay cuotas pagadas y el cambio tocaria el calendario (el mes
 * de la primera cuota o el total de cuotas): esos pagos quedaron anclados a
 * un mes, y correr el calendario debajo dejaria cuotas pagadas fuera del
 * plazo de la deuda. El nombre, el monto y la nota se pueden cambiar siempre.
 */
export async function actualizarDeuda(
  datos: EdicionDeudaValidada,
  db: ClienteDb = prisma,
): Promise<DeudaPlana> {
  const actual = await db.deuda.findUnique({
    where: { id: datos.id },
    select: { primeraCuota: true, cuotasTotales: true, _count: { select: { cuotasPagadas: true } } },
  });

  if (actual === null) throw new Error("Esa deuda ya no existe.");

  const cambiaCalendario =
    mesDesdeFecha(actual.primeraCuota) !== datos.primeraCuota ||
    actual.cuotasTotales !== datos.cuotasTotales;

  if (cambiaCalendario && actual._count.cuotasPagadas > 0) {
    throw new Error(
      "Esta deuda ya tiene cuotas pagadas. Puedes cambiarle el nombre, el monto y la nota, pero no el calendario.",
    );
  }

  const fila = (await db.deuda.update({
    where: { id: datos.id },
    data: {
      nombre: datos.nombre,
      montoCuota: datos.montoCuota,
      cuotasTotales: datos.cuotasTotales,
      primeraCuota: rangoDelMesISO(datos.primeraCuota).desde,
      nota: datos.nota,
    },
  })) as FilaDeuda;

  return aPlano(fila);
}
