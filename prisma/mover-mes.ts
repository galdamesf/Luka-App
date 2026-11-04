/**
 * Mueve lo anotado en un mes a otro: cuentas, presupuestos y ahorros, y corre
 * el calendario de las deudas (con sus pagos) la misma cantidad de meses.
 * Primero muestra que haria; solo cambia algo con --aplicar.
 *
 * Repetirlo no hace dano: una vez aplicado, el mes de origen queda vacio y
 * no hay nada que mover, ni las deudas.
 *
 *   npm run db:mover-mes -- 2026-10 2026-11             (vista previa)
 *   npm run db:mover-mes -- 2026-10 2026-11 --aplicar   (lo hace)
 *
 * Con --dia 27 deja ademas guardado el dia de inicio del mes.
 *
 * Mueve lo de un solo hogar. Si en la base hay uno solo, es ese; si hay
 * varios, se elige con el correo de un miembro: --correo tu@gmail.com
 *
 * Antes de aplicar, un respaldo:
 *   npm run db:respaldo
 */
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { formatearCLP } from "../src/lib/dinero";
import { cambiosDelPlan, planearMovimiento } from "../src/dominio/mover-mes";
import { aplicarMovimiento, leerDeudasParaMover, leerParaMover } from "../src/datos/mover-mes";
import { normalizarCorreo } from "../src/dominio/entrada";

cargarEnv();

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

async function main() {
  const argumentos = process.argv.slice(2);
  const aplicar = argumentos.includes("--aplicar");
  const posDia = argumentos.indexOf("--dia");
  const dia = posDia === -1 ? null : Number(argumentos[posDia + 1]);
  const posCorreo = argumentos.indexOf("--correo");
  const correo = posCorreo === -1 ? null : (argumentos[posCorreo + 1] ?? "");
  // Los dos meses son lo que no es opcion ni el valor de --dia o --correo.
  const valores = new Set([posDia + 1, posCorreo + 1].filter((i) => i > 0));
  const [desde, hasta] = argumentos.filter((a, i) => !a.startsWith("--") && !valores.has(i));

  if (desde === undefined || hasta === undefined || !MES.test(desde) || !MES.test(hasta) || desde === hasta) {
    console.error("Uso: npm run db:mover-mes -- 2026-10 2026-11 [--aplicar] [--dia 27] [--correo tu@gmail.com]");
    process.exitCode = 1;
    return;
  }
  if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
    console.error("El día de inicio va entre 1 y 31.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const hogar = await elegirHogar(prisma, correo);
    if (hogar === null) {
      process.exitCode = 1;
      return;
    }
    const hogarId = hogar.id;
    console.log(`\nHogar: ${hogar.nombre}`);

    const plan = planearMovimiento(
      await leerParaMover(hogarId, desde, prisma),
      await leerParaMover(hogarId, hasta, prisma),
      { desde, hasta },
      await leerDeudasParaMover(hogarId, prisma),
    );
    const cuota = (numero: number | null, total: number) =>
      numero === null ? "sin cuota" : `cuota ${numero} de ${total}`;

    console.log(`\nDe ${desde} a ${hasta}${aplicar ? "" : " (vista previa: no se cambia nada)"}\n`);
    const lista = (titulo: string, filas: string[]) => {
      if (filas.length === 0) return;
      console.log(`${titulo} (${filas.length})`);
      for (const fila of filas) console.log(`  · ${fila}`);
    };
    lista("Cuentas que pasan", plan.cuentas.map((c) => `${c.nombre} · ${formatearCLP(c.monto)}${c.pagada ? " · pagada" : ""}`));
    lista(
      "Copias pendientes que se quitan del destino (la app las creó sola)",
      plan.copiasQueSobran.map((c) => `${c.nombre} · ${formatearCLP(c.monto)}`),
    );
    lista("Presupuestos que pasan", plan.presupuestos.map((p) => `${p.categoriaNombre} · ${formatearCLP(p.monto)}`));
    lista("Ahorros que pasan", plan.ahorros.map((a) => `${a.nota ?? "Ahorro"} · ${formatearCLP(a.monto)}`));
    lista(
      "Deudas: su calendario se corre",
      plan.deudas.map(
        (d) =>
          `${d.nombre} · primera cuota ${d.primeraCuota} → ${d.nuevaPrimeraCuota} · en ${hasta}: ` +
          `${cuota(d.cuotaDespues, d.cuotasTotales)} (hoy dice ${cuota(d.cuotaAntes, d.cuotasTotales)})`,
      ),
    );
    lista(
      "Pagos de cuota que se corren con su deuda",
      plan.pagos.map((p) => `${p.deudaNombre} · ${formatearCLP(p.monto)} · ${p.mes} → ${p.nuevoMes}`),
    );
    lista("No se mueven", plan.conflictos.map((c) => `${c.que}: ${c.motivo}`));
    if (dia !== null) console.log(`Día de inicio del mes: ${dia}`);

    if (cambiosDelPlan(plan) === 0 && dia === null) {
      console.log("No hay nada que mover.");
      return;
    }
    if (!aplicar) {
      console.log(`\nPara hacerlo: npm run db:mover-mes -- ${desde} ${hasta} --aplicar${dia === null ? "" : ` --dia ${dia}`}\n`);
      return;
    }

    await aplicarMovimiento(hogarId, plan, hasta, prisma);
    if (dia !== null) {
      await prisma.ajustes.upsert({
        where: { hogarId },
        update: { diaInicioMes: dia },
        create: { hogarId, diaInicioMes: dia },
      });
    }
    console.log("\nListo.\n");
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * El hogar a mover: el del correo si se dio uno; si no, el unico que haya.
 * Con varios hogares y sin correo, no adivina: lo pide.
 */
async function elegirHogar(
  prisma: PrismaClient,
  correo: string | null,
): Promise<{ id: string; nombre: string } | null> {
  if (correo !== null) {
    const normalizado = normalizarCorreo(correo);
    const miembro =
      normalizado === null
        ? null
        : await prisma.miembro.findUnique({
            where: { correo: normalizado },
            select: { hogar: { select: { id: true, nombre: true } } },
          });
    if (miembro === null) {
      console.error(`Ningún hogar tiene a ${correo} como miembro.`);
      return null;
    }
    return miembro.hogar;
  }

  const hogares = await prisma.hogar.findMany({ select: { id: true, nombre: true }, take: 2 });
  if (hogares.length === 1) return hogares[0]!;
  console.error("Hay varios hogares: di de cuál con --correo tu@gmail.com");
  return null;
}

main().catch((error) => {
  console.error("No se pudo mover:", error);
  process.exitCode = 1;
});
