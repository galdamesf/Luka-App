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
 * Antes de aplicar, un respaldo:
 *   npm run db:respaldo
 */
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { formatearCLP } from "../src/lib/dinero";
import { cambiosDelPlan, planearMovimiento } from "../src/dominio/mover-mes";
import { aplicarMovimiento, leerDeudasParaMover, leerParaMover } from "../src/datos/mover-mes";
import { HOGAR_DE_TRANSICION } from "../src/datos/hogares";

cargarEnv();

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

async function main() {
  const argumentos = process.argv.slice(2);
  const aplicar = argumentos.includes("--aplicar");
  const posDia = argumentos.indexOf("--dia");
  const dia = posDia === -1 ? null : Number(argumentos[posDia + 1]);
  // Los dos meses son lo que no es opcion ni el valor de --dia.
  const [desde, hasta] = argumentos.filter((a, i) => !a.startsWith("--") && (posDia === -1 || i !== posDia + 1));

  if (desde === undefined || hasta === undefined || !MES.test(desde) || !MES.test(hasta) || desde === hasta) {
    console.error("Uso: npm run db:mover-mes -- 2026-10 2026-11 [--aplicar] [--dia 27]");
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
    const plan = planearMovimiento(
      await leerParaMover(desde, prisma),
      await leerParaMover(hasta, prisma),
      { desde, hasta },
      await leerDeudasParaMover(prisma),
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

    await aplicarMovimiento(plan, hasta, prisma);
    if (dia !== null) {
      await prisma.ajustes.upsert({
        where: { hogarId: HOGAR_DE_TRANSICION },
        update: { diaInicioMes: dia },
        create: { hogarId: HOGAR_DE_TRANSICION, diaInicioMes: dia },
      });
    }
    console.log("\nListo.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudo mover:", error);
  process.exitCode = 1;
});
