/**
 * Llena la bandeja «Por revisar» con los comprobantes de ejemplo de las
 * pruebas, leidos con el lector de verdad, para verla y probarla en tu Mac
 * antes de conectar los correos. Todos los datos son inventados.
 *
 *   npm run ejemplos:bandeja                       (los agrega)
 *   npm run ejemplos:bandeja -- --quitar           (los saca)
 *   npm run ejemplos:bandeja -- --correo tu@gmail.com   (si hay varios hogares)
 *
 * Agregarlos dos veces no los duplica: cada ejemplo tiene su huella, igual
 * que un correo. Quitarlos deshace primero lo que se haya confirmado desde
 * ellos (el gasto, el pago de la cuenta, la deuda) y despues los borra; no
 * toca nada mas.
 *
 * Solo corre contra la base de tu computador, nunca contra la nube.
 */
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { crearLector } from "../src/dominio/comprobantes/lector";
import type { LecturaLeida } from "../src/dominio/comprobantes/tipos";
import { normalizarCorreo } from "../src/dominio/entrada";
import { deshacerEnLaBandeja, huellaDeCorreo, registrarMovimiento } from "../src/datos/movimientos";
import { cargarEjemplo } from "../tests/fixtures/comprobantes/cargar";

cargarEnv();

/** Los correos de ejemplo, en el orden en que "llegan". */
const CORREOS = [
  "santander/transferencia-enviada.txt",
  "santander/pago-de-cuenta.txt",
  "consorcio/cargo.txt",
  "consorcio/transferencia-enviada.txt",
  "lider/boleta-digital.txt",
  "bsale/boleta.txt",
  "santander/transferencia-recibida.txt",
  "bancoestado/transferencia-recibida.txt",
  "consorcio/abono.txt",
];

/** Lo que todavia no tiene ejemplo de correo: una compra en cuotas, una en dolares y un comercio nuevo. */
const LEIDOS_CON_IA: { nombre: string; lectura: LecturaLeida }[] = [
  {
    nombre: "paris-en-cuotas",
    lectura: {
      ok: true, tipo: "COMPRA", sentido: "gasto", monto: 89_970, moneda: "CLP", fecha: "2026-11-18",
      comercio: "PARIS.CL", fuente: "Aviso de compra (ejemplo)", via: "ia", confianza: 0.92,
      cuotas: 3, medioPago: "CREDITO", ultimos4: "4821",
    },
  },
  {
    nombre: "suscripcion-en-dolares",
    lectura: {
      ok: true, tipo: "COMPRA", sentido: "gasto", monto: 1_599, moneda: "USD", fecha: "2026-11-17",
      comercio: "STREAMING DIGITAL", fuente: "Aviso de compra (ejemplo)", via: "ia", confianza: 0.88,
      medioPago: "CREDITO", ultimos4: "4821",
    },
  },
  {
    nombre: "viaje-en-auto",
    lectura: {
      ok: true, tipo: "COMPRA", sentido: "gasto", monto: 6_240, moneda: "CLP", fecha: "2026-11-19",
      comercio: "UBER *TRIP", fuente: "Aviso de compra (ejemplo)", via: "ia", confianza: 0.95,
      medioPago: "CREDITO", ultimos4: "4821",
    },
  },
];

const huellaDe = (nombre: string) => huellaDeCorreo(`<ejemplo-luka-${nombre}@luka.local>`);
const HUELLAS = [...CORREOS, ...LEIDOS_CON_IA.map((e) => e.nombre)].map(huellaDe);

const MAQUINA_LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

async function main() {
  const argumentos = process.argv.slice(2);
  const quitar = argumentos.includes("--quitar");
  const posCorreo = argumentos.indexOf("--correo");
  const correo = posCorreo === -1 ? null : (argumentos[posCorreo + 1] ?? "");

  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // Sin URL valida no hay base local que llenar.
  }
  if (!MAQUINA_LOCAL.has(host)) {
    console.error("Los ejemplos van solo en la base de tu computador: DATABASE_URL no apunta a localhost.");
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
    if (quitar) await quitarEjemplos(prisma, hogar);
    else await agregarEjemplos(prisma, hogar);
  } finally {
    await prisma.$disconnect();
  }
}

async function agregarEjemplos(prisma: PrismaClient, hogar: { id: string; nombre: string }) {
  const lector = crearLector();
  let nuevos = 0;
  let estaban = 0;
  const registrar = async (nombre: string, lectura: LecturaLeida) => {
    const { nuevo } = await registrarMovimiento(
      hogar.id,
      { huella: huellaDe(nombre), lectura, recibidoEn: new Date() },
      prisma,
    );
    if (nuevo) nuevos += 1;
    else estaban += 1;
  };

  for (const ruta of CORREOS) {
    const lectura = await lector(cargarEjemplo(ruta));
    if (!lectura.ok) {
      console.error(`  · ${ruta}: no se pudo leer (${lectura.motivo}). Se salta.`);
      continue;
    }
    await registrar(ruta, lectura);
  }
  for (const { nombre, lectura } of LEIDOS_CON_IA) await registrar(nombre, lectura);

  const porRevisar = await prisma.movimiento.count({ where: { hogarId: hogar.id, estado: "POR_REVISAR" } });
  console.log(
    `Hogar «${hogar.nombre}»: ${nuevos} ${nuevos === 1 ? "ejemplo nuevo" : "ejemplos nuevos"}` +
      (estaban > 0 ? ` (${estaban} ya estaban)` : "") +
      `. En «Por revisar» hay ${porRevisar}. Abre el panel: la bandeja va arriba.`,
  );
  console.log("Para sacarlos: npm run ejemplos:bandeja -- --quitar");
}

async function quitarEjemplos(prisma: PrismaClient, hogar: { id: string; nombre: string }) {
  const confirmados = await prisma.movimiento.findMany({
    where: { hogarId: hogar.id, huella: { in: HUELLAS }, estado: "CONFIRMADO" },
    select: { id: true, comercio: true },
  });
  for (const movimiento of confirmados) {
    try {
      await deshacerEnLaBandeja(hogar.id, "confirmacion", [movimiento.id], prisma);
    } catch (error) {
      console.error(`  · ${movimiento.comercio}: ${(error as Error).message} Se queda.`);
    }
  }
  const borrados = await prisma.movimiento.deleteMany({
    where: { hogarId: hogar.id, huella: { in: HUELLAS }, estado: { not: "CONFIRMADO" } },
  });
  console.log(
    `Hogar «${hogar.nombre}»: ${borrados.count} ${borrados.count === 1 ? "ejemplo quitado" : "ejemplos quitados"}` +
      (confirmados.length > 0 ? `, con lo que se había confirmado desde ellos.` : "."),
  );
}

async function elegirHogar(prisma: PrismaClient, correo: string | null): Promise<{ id: string; nombre: string } | null> {
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
  console.error("No se pudieron poner los ejemplos:", error);
  process.exitCode = 1;
});
