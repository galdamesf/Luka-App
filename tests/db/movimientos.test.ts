import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDeLaNube, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import { crearLector } from "@/dominio/comprobantes/lector";
import type { LecturaLeida } from "@/dominio/comprobantes/tipos";
import {
  anotarIgual,
  confirmarMovimiento,
  confirmarVarios,
  crearReglaDeComercio,
  descartarMovimiento,
  deshacerEnLaBandeja,
  huellaDeCorreo,
  leerBandeja,
  registrarMovimiento,
} from "@/datos/movimientos";
import { crearGasto, eliminarGasto } from "@/datos/gastos";
import { crearCuenta, listarCuentasDelMes } from "@/datos/cuentas";
import { crearDeuda, listarPagosDelMes, pagarCuota } from "@/datos/deudas";
import { definirDiaInicioMes } from "@/datos/ajustes";
import { copiarDatos, leerTodo, tablasDistintas } from "@/datos/subir-a-la-nube";
import { fechaDesdeISO, isoDesdeFecha } from "@/lib/fecha";
import { cargarEjemplo } from "../fixtures/comprobantes/cargar";

/*
  Los movimientos y la bandeja «Por revisar» contra la base. Lo que tiene que
  cumplirse siempre:

    - Confirmar crea el gasto y cierra el movimiento en una sola transaccion.
    - La boleta y el aviso de la misma compra quedan en un solo gasto.
    - Si se borra ese gasto, el movimiento no vuelve a la bandeja.

  Los comprobantes son los ejemplos de la Seccion A, leidos con el lector de
  verdad.
*/

let prisma: PrismaClient;
let nube: PrismaClient;
const A = HOGAR_INICIAL;
const B = "hogar-de-ana";
const HOY = "2026-11-20";
let supermercado: string;
let transporte: string;
let luz: string;
let deB: string;
let miembro: string;

const lector = crearLector();

beforeAll(async () => {
  prisma = clienteDePrueba();
  nube = clienteDeLaNube();
  await prisma.$connect();
  await nube.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await nube.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.hogar.create({ data: { id: B, nombre: "Casa de Ana" } });
  const categoria = (hogarId: string, nombre: string) =>
    prisma.categoria.create({ data: { hogarId, nombre, color: "#15803D", icono: "shopping-cart" } });
  supermercado = (await categoria(A, "Supermercado")).id;
  transporte = (await categoria(A, "Transporte")).id;
  luz = (await categoria(A, "Luz y agua")).id;
  deB = (await categoria(B, "Supermercado")).id;
  miembro = await miembroDePrueba(prisma, { nombre: "Camila Rojas" });
});

async function leer(ruta: string): Promise<LecturaLeida> {
  const lectura = await lector(cargarEjemplo(ruta));
  if (!lectura.ok) throw new Error(`${ruta} no se leyo: ${lectura.motivo}`);
  return lectura;
}

function registrarLectura(lectura: LecturaLeida, nombre: string, hogarId = A) {
  return registrarMovimiento(
    hogarId,
    { huella: huellaDeCorreo(`<${nombre}@ejemplo.cl>`), lectura, recibidoEn: new Date("2026-11-20T12:00:00Z") },
    prisma,
  );
}

async function registrar(ruta: string, hogarId = A) {
  return registrarLectura(await leer(ruta), ruta, hogarId);
}

/** Un aviso de compra con tarjeta, como los de Banco de Chile (leido con IA, por ejemplo). */
function avisoDeCompra(cambios: Partial<LecturaLeida> = {}): LecturaLeida {
  return {
    ok: true,
    tipo: "COMPRA",
    sentido: "gasto",
    monto: 6_170,
    moneda: "CLP",
    fecha: "2026-11-15",
    comercio: "LIDER EXPRESS LOS LEONES",
    fuente: "Aviso de Banco de Chile",
    via: "plantilla",
    plantilla: "bancochile/compra",
    medioPago: "CREDITO",
    ultimos4: "4821",
    ...cambios,
  };
}

const bandeja = (hogarId = A) => leerBandeja(hogarId, { hoy: HOY }, prisma);
const movimiento = (id: string) => prisma.movimiento.findUniqueOrThrow({ where: { id } });

describe("lo que llega", () => {
  test("una transferencia queda por revisar, con lo que dice el comprobante", async () => {
    const { id, estado, nuevo } = await registrar("santander/transferencia-enviada.txt");
    expect({ estado, nuevo }).toEqual({ estado: "POR_REVISAR", nuevo: true });
    const fila = await movimiento(id);
    expect(fila).toMatchObject({
      hogarId: A,
      tipo: "TRANSFERENCIA",
      sentido: "GASTO",
      monto: 245_000,
      moneda: "CLP",
      comercio: "Pedro Muñoz Lagos",
      fuente: "Comprobante de Santander",
      ultimos4: "5678",
      contraparteUltimos4: "7890",
      gastoId: null,
      destino: null,
    });
    expect(isoDesdeFecha(fila.fecha)).toBe("2026-11-18");
  });

  test("el mismo correo dos veces es un solo movimiento", async () => {
    const primero = await registrar("santander/transferencia-enviada.txt");
    const segundo = await registrar("santander/transferencia-enviada.txt");
    expect(segundo).toEqual({ ...primero, nuevo: false });
    expect(await prisma.movimiento.count()).toBe(1);
  });

  test("aunque las dos copias lleguen a la vez", async () => {
    const lectura = await leer("santander/transferencia-enviada.txt");
    const copias = await Promise.all([registrarLectura(lectura, "mismo"), registrarLectura(lectura, "mismo")]);
    expect(copias.map((c) => c.nuevo).sort()).toEqual([false, true]);
    expect(await prisma.movimiento.count()).toBe(1);
  });

  test("el mismo correo en dos hogares es uno en cada uno", async () => {
    await registrar("santander/transferencia-enviada.txt", A);
    await registrar("santander/transferencia-enviada.txt", B);
    expect(await prisma.movimiento.count({ where: { hogarId: A } })).toBe(1);
    expect(await prisma.movimiento.count({ where: { hogarId: B } })).toBe(1);
  });

  test("un ingreso queda fuera, con su motivo a la vista", async () => {
    const { estado } = await registrar("santander/transferencia-recibida.txt");
    expect(estado).toBe("IGNORADO");
    const { porRevisar, dejadosFuera } = await bandeja();
    expect(porRevisar).toEqual([]);
    expect(dejadosFuera).toMatchObject([
      { comercio: "SERVICIOS DIGITALES ANDES SPA", monto: 850_000, motivo: "ingreso", puedeAnotarse: false },
    ]);
  });

  test("una transferencia a otra cuenta del hogar es un traspaso y queda fuera", async () => {
    await prisma.cuentaBancaria.create({
      data: { hogarId: A, banco: "Banco de Chile", tipo: "CUENTA_CORRIENTE", ultimos4: "7890" },
    });
    const { id, estado } = await registrar("santander/transferencia-enviada.txt");
    expect(estado).toBe("IGNORADO");
    expect((await movimiento(id)).tipo).toBe("TRASPASO_PROPIO");
    expect((await bandeja()).dejadosFuera[0]).toMatchObject({ motivo: "traspaso", puedeAnotarse: true });
  });

  test("las cuentas de otro hogar no cuentan como propias", async () => {
    await prisma.cuentaBancaria.create({
      data: { hogarId: B, banco: "Banco de Chile", tipo: "CUENTA_CORRIENTE", ultimos4: "7890" },
    });
    expect((await registrar("santander/transferencia-enviada.txt")).estado).toBe("POR_REVISAR");
  });

  test("la huella tiene que ser un SHA-256", async () => {
    const lectura = await leer("santander/transferencia-enviada.txt");
    await expect(
      registrarMovimiento(A, { huella: "no-es-huella", lectura, recibidoEn: new Date() }, prisma),
    ).rejects.toThrow(/SHA-256/);
  });
});

describe("la boleta y el aviso de la misma compra", () => {
  test("el cargo de Consorcio y su comprobante quedan en uno solo, llegue primero el que llegue", async () => {
    const cargo = await registrar("consorcio/cargo.txt");
    const transferencia = await registrar("consorcio/transferencia-enviada.txt");

    expect(transferencia.estado).toBe("POR_REVISAR");
    expect(await movimiento(cargo.id)).toMatchObject({ estado: "JUNTADO", juntadoConId: transferencia.id });

    const { porRevisar } = await bandeja();
    expect(porRevisar).toHaveLength(1);
    expect(porRevisar[0]).toMatchObject({ comercio: "Pedro Muñoz Lagos", juntados: ["Aviso de cargo de Consorcio"] });
  });

  test("y al reves: el comprobante primero, el cargo despues", async () => {
    const transferencia = await registrar("consorcio/transferencia-enviada.txt");
    const cargo = await registrar("consorcio/cargo.txt");
    expect(cargo.estado).toBe("JUNTADO");
    expect((await movimiento(cargo.id)).juntadoConId).toBe(transferencia.id);
    expect((await bandeja()).porRevisar.map((m) => m.id)).toEqual([transferencia.id]);
  });

  test("la boleta y el aviso del banco quedan en un solo gasto", async () => {
    const aviso = await registrarLectura(avisoDeCompra({ fecha: "2026-11-16" }), "aviso");
    const boleta = await registrar("lider/boleta-digital.txt");

    // Queda a la vista la boleta, y el aviso se junta con ella.
    expect(await movimiento(aviso.id)).toMatchObject({ estado: "JUNTADO", juntadoConId: boleta.id });
    const { porRevisar } = await bandeja();
    expect(porRevisar.map((m) => m.id)).toEqual([boleta.id]);

    await confirmarMovimiento(A, miembro, boleta.id, { como: "gasto", categoriaId: supermercado }, prisma);
    expect(await prisma.gasto.count()).toBe(1);
    expect((await bandeja()).porRevisar).toEqual([]);
  });

  test("si la boleta ya se confirmo, el aviso que llega despues se junta con ella y no crea otro gasto", async () => {
    const boleta = await registrar("lider/boleta-digital.txt");
    await confirmarMovimiento(A, miembro, boleta.id, { como: "gasto", categoriaId: supermercado }, prisma);

    const aviso = await registrarLectura(avisoDeCompra(), "aviso");
    expect(aviso.estado).toBe("JUNTADO");
    expect((await movimiento(aviso.id)).juntadoConId).toBe(boleta.id);
    expect((await bandeja()).porRevisar).toEqual([]);
    expect(await prisma.gasto.count()).toBe(1);
  });

  test("un traspaso que quedo fuera se lleva tambien su aviso de cargo", async () => {
    await prisma.cuentaBancaria.create({ data: { hogarId: A, banco: "Itaú", tipo: "CUENTA_CORRIENTE", ultimos4: "8765" } });
    const transferencia = await registrar("consorcio/transferencia-enviada.txt");
    const cargo = await registrar("consorcio/cargo.txt");
    expect(transferencia.estado).toBe("IGNORADO");
    expect(cargo.estado).toBe("JUNTADO");
    expect((await bandeja()).porRevisar).toEqual([]);
  });
});

describe("confirmar", () => {
  test("crea el gasto y cierra el movimiento, con lo que dice el comprobante", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt");
    const hecho = await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma);
    expect(hecho).toMatchObject({ destino: "GASTO_NUEVO", descripcion: "Pedro Muñoz Lagos", monto: 245_000, categoria: "Transporte" });

    const fila = await movimiento(id);
    expect(fila).toMatchObject({ estado: "CONFIRMADO", destino: "GASTO_NUEVO" });
    const gasto = await prisma.gasto.findUniqueOrThrow({ where: { id: fila.gastoId! } });
    expect(gasto).toMatchObject({
      hogarId: A,
      descripcion: "Pedro Muñoz Lagos",
      monto: 245_000,
      medioPago: "TRANSFERENCIA",
      categoriaId: transporte,
      anotadoPorId: miembro,
    });
    expect(isoDesdeFecha(gasto.fecha)).toBe("2026-11-18");
  });

  test("en una sola transaccion: si el gasto no se puede crear, el movimiento sigue por revisar", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt");
    // La categoria de otro hogar: la llave por categoria y hogar lo rechaza.
    await expect(confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: deB }, prisma)).rejects.toThrow();
    expect(await movimiento(id)).toMatchObject({ estado: "POR_REVISAR", destino: null, gastoId: null });
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("se puede corregir la descripcion, el monto y la fecha", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt");
    await confirmarMovimiento(
      A,
      miembro,
      id,
      { como: "gasto", categoriaId: transporte, descripcion: "Arriendo bodega", monto: 240_000, fecha: "2026-11-19" },
      prisma,
    );
    const gasto = await prisma.gasto.findFirstOrThrow();
    expect(gasto).toMatchObject({ descripcion: "Arriendo bodega", monto: 240_000 });
    expect(isoDesdeFecha(gasto.fecha)).toBe("2026-11-19");
  });

  test("confirmar dos veces no crea dos gastos, ni aunque sea a la vez", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt");
    const intentos = await Promise.allSettled([
      confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma),
      confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma),
    ]);
    expect(intentos.filter((i) => i.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.gasto.count()).toBe(1);

    await expect(
      confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma),
    ).rejects.toThrow(/ya no está por revisar/);
  });

  test("en dolares pide el monto en pesos", async () => {
    const { id } = await registrarLectura(
      avisoDeCompra({ comercio: "NETFLIX.COM", monto: 1_599, moneda: "USD", via: "ia", plantilla: undefined, confianza: 0.9 }),
      "netflix",
    );
    await expect(confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: luz }, prisma)).rejects.toThrow(/en pesos/);
    expect((await movimiento(id)).estado).toBe("POR_REVISAR");

    await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: luz, monto: 15_380 }, prisma);
    expect((await prisma.gasto.findFirstOrThrow()).monto).toBe(15_380);
  });

  test("si se borra ese gasto, el movimiento no vuelve a la bandeja, ni aunque el correo llegue otra vez", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt");
    await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma);
    const gastoId = (await movimiento(id)).gastoId!;

    await eliminarGasto(A, gastoId, prisma);

    expect(await movimiento(id)).toMatchObject({ estado: "CONFIRMADO", gastoId: null });
    expect((await bandeja()).porRevisar).toEqual([]);
    expect((await registrar("santander/transferencia-enviada.txt")).nuevo).toBe(false);
    expect((await bandeja()).porRevisar).toEqual([]);
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("varios de una vez, cada uno con su categoria", async () => {
    const transferencia = await registrar("santander/transferencia-enviada.txt");
    const boleta = await registrar("lider/boleta-digital.txt");
    const hecho = await confirmarVarios(
      A,
      miembro,
      [
        { id: transferencia.id, categoriaId: transporte },
        { id: boleta.id, categoriaId: supermercado },
      ],
      prisma,
    );
    expect(hecho.confirmados).toHaveLength(2);
    expect(hecho.saltados).toBe(0);
    const gastos = await prisma.gasto.findMany({ orderBy: { monto: "asc" } });
    expect(gastos.map((g) => [g.descripcion, g.categoriaId])).toEqual([
      ["Líder", supermercado],
      ["Pedro Muñoz Lagos", transporte],
    ]);
  });

  test("lo que ya no esta por revisar se salta; una categoria ajena hace fallar todo", async () => {
    const transferencia = await registrar("santander/transferencia-enviada.txt");
    const boleta = await registrar("lider/boleta-digital.txt");
    await descartarMovimiento(A, boleta.id, prisma);

    const hecho = await confirmarVarios(
      A,
      miembro,
      [
        { id: transferencia.id, categoriaId: transporte },
        { id: boleta.id, categoriaId: supermercado },
      ],
      prisma,
    );
    expect(hecho).toMatchObject({ saltados: 1, confirmados: [{ id: transferencia.id }] });

    const otra = await registrar("bsale/boleta.txt");
    await expect(confirmarVarios(A, miembro, [{ id: otra.id, categoriaId: deB }], prisma)).rejects.toThrow(/categorías/);
    expect((await movimiento(otra.id)).estado).toBe("POR_REVISAR");
  });
});

describe("lo que ya estaba anotado", () => {
  test("con un gasto del mismo monto a dos dias, pregunta si es el mismo; y si lo es, no crea otro", async () => {
    const aMano = await crearGasto(
      A,
      { fecha: "2026-11-16", descripcion: "Feria", monto: 6_170, categoriaId: supermercado, medioPago: "DEBITO", notas: null },
      prisma,
    );
    const { id } = await registrar("lider/boleta-digital.txt");

    const [item] = (await bandeja()).porRevisar;
    expect(item?.revision.propuesta).toMatchObject({ como: "mismo-gasto", gasto: { id: aMano.id, descripcion: "Feria" } });

    await confirmarMovimiento(A, miembro, id, { como: "mismo-gasto", gastoId: aMano.id }, prisma);
    expect(await movimiento(id)).toMatchObject({ estado: "CONFIRMADO", destino: "GASTO_EXISTENTE", gastoId: aMano.id });
    expect(await prisma.gasto.count()).toBe(1);
  });

  test("no se enlaza con un gasto de otro hogar", async () => {
    const ajeno = await crearGasto(
      B,
      { fecha: "2026-11-15", descripcion: "Feria", monto: 6_170, categoriaId: deB, medioPago: "DEBITO", notas: null },
      prisma,
    );
    const { id } = await registrar("lider/boleta-digital.txt");
    expect((await bandeja()).porRevisar[0]?.revision.propuesta.como).toBe("gasto");
    await expect(confirmarMovimiento(A, miembro, id, { como: "mismo-gasto", gastoId: ajeno.id }, prisma)).rejects.toThrow(
      /ya no existe/,
    );
    expect((await movimiento(id)).estado).toBe("POR_REVISAR");
  });
});

describe("cuentas y cuotas por pagar", () => {
  test("el pago de una cuenta pendiente la deja pagada con su gasto, y deshacerlo la devuelve a pendiente", async () => {
    await crearCuenta(
      A,
      { nombre: "Luz", monto: 45_000, mes: "2026-11", diaVencimiento: 10, categoriaId: luz, mensual: true, nota: null },
      prisma,
    );
    const { id } = await registrar("santander/pago-de-cuenta.txt");
    const [item] = (await bandeja()).porRevisar;
    // "Luz" no calza por nombre con ENEL ni por monto: no se propone.
    expect(item?.revision.propuesta.como).toBe("gasto");

    const [cuenta] = await listarCuentasDelMes(A, "2026-11", prisma);
    await confirmarMovimiento(A, miembro, id, { como: "pago-de-cuenta", cuentaId: cuenta!.id }, prisma);

    const [pagada] = await listarCuentasDelMes(A, "2026-11", prisma);
    expect(pagada).toMatchObject({ pagadaEn: "2026-11-05", monto: 48_350 });
    expect((await movimiento(id)).gastoId).toBe(pagada!.gastoId);
    expect(await prisma.gasto.count()).toBe(1);

    await deshacerEnLaBandeja(A, "confirmacion", [id], prisma);
    const [devuelta] = await listarCuentasDelMes(A, "2026-11", prisma);
    expect(devuelta).toMatchObject({ pagadaEn: null, gastoId: null });
    expect(await prisma.gasto.count()).toBe(0);
    expect((await movimiento(id)).estado).toBe("POR_REVISAR");
  });

  test("si la cuenta tiene el mismo monto, se propone pagarla", async () => {
    const cuenta = await crearCuenta(
      A,
      { nombre: "Enel", monto: 48_350, mes: "2026-11", diaVencimiento: 10, categoriaId: luz, mensual: false, nota: null },
      prisma,
    );
    await registrar("santander/pago-de-cuenta.txt");
    expect((await bandeja()).porRevisar[0]?.revision.propuesta).toMatchObject({
      como: "pago-de-cuenta",
      cuenta: { id: cuenta.id, nombre: "Enel" },
    });
  });

  test("la cuota de una deuda: se paga desde la bandeja y se deshace", async () => {
    const deuda = await crearDeuda(
      A,
      { nombre: "Préstamo de Pedro", montoCuota: 245_000, cuotasTotales: 6, primeraCuota: "2026-10", nota: null },
      prisma,
    );
    const { id } = await registrar("santander/transferencia-enviada.txt");
    expect((await bandeja()).porRevisar[0]?.revision.propuesta).toMatchObject({
      como: "pago-de-cuota",
      cuota: { deudaId: deuda.id, mes: "2026-11", numero: 2, de: 6 },
    });

    await confirmarMovimiento(A, miembro, id, { como: "pago-de-cuota", deudaId: deuda.id, mes: "2026-11" }, prisma);
    expect(await listarPagosDelMes(A, "2026-11", prisma)).toMatchObject([{ deudaId: deuda.id, pagadaEn: "2026-11-18" }]);

    await deshacerEnLaBandeja(A, "confirmacion", [id], prisma);
    expect(await listarPagosDelMes(A, "2026-11", prisma)).toEqual([]);
    expect(await prisma.gasto.count()).toBe(0);
  });

  test("una cuota que ya se pago a mano no se propone", async () => {
    const deuda = await crearDeuda(
      A,
      { nombre: "Préstamo", montoCuota: 245_000, cuotasTotales: 6, primeraCuota: "2026-11", nota: null },
      prisma,
    );
    await pagarCuota(A, deuda.id, "2026-11", "2026-11-02", 245_000, null, prisma);
    await registrar("santander/transferencia-enviada.txt");
    expect((await bandeja()).porRevisar[0]?.revision.propuesta.como).not.toBe("pago-de-cuota");
  });
});

describe("compras en cuotas", () => {
  test("se anotan como deuda, sin gasto, y deshacerlo borra la deuda", async () => {
    const { id } = await registrarLectura(
      avisoDeCompra({ comercio: "PARIS.CL", monto: 89_970, cuotas: 3, fecha: "2026-11-18" }),
      "paris",
    );
    expect((await bandeja()).porRevisar[0]?.revision.propuesta).toMatchObject({
      como: "deuda",
      deuda: { cuotas: 3, montoCuota: 29_990, primeraCuota: "2026-12" },
    });

    const hecho = await confirmarMovimiento(A, miembro, id, { como: "deuda" }, prisma);
    expect(hecho).toMatchObject({ destino: "DEUDA", monto: 29_990, deuda: { cuotas: 3, primeraCuota: "2026-12" } });
    const deuda = await prisma.deuda.findFirstOrThrow({ where: { hogarId: A } });
    expect(deuda).toMatchObject({ nombre: "PARIS.CL", montoCuota: 29_990, cuotasTotales: 3 });
    expect(isoDesdeFecha(deuda.primeraCuota)).toBe("2026-12-01");
    expect(await movimiento(id)).toMatchObject({ destino: "DEUDA", deudaId: deuda.id, gastoId: null });
    expect(await prisma.gasto.count()).toBe(0);

    await deshacerEnLaBandeja(A, "confirmacion", [id], prisma);
    expect(await prisma.deuda.count()).toBe(0);
  });

  test("con el mes que parte el 27, la primera cuota es la del mes siguiente al de gastos", async () => {
    await definirDiaInicioMes(A, 27, prisma);
    const { id } = await registrarLectura(avisoDeCompra({ monto: 60_000, cuotas: 2, fecha: "2026-11-28" }), "tarde");
    await confirmarMovimiento(A, miembro, id, { como: "deuda" }, prisma);
    expect(isoDesdeFecha((await prisma.deuda.findFirstOrThrow()).primeraCuota)).toBe("2027-01-01");
  });

  test("no se deshace una deuda que ya tiene cuotas pagadas", async () => {
    const { id } = await registrarLectura(avisoDeCompra({ monto: 60_000, cuotas: 2 }), "dos-cuotas");
    await confirmarMovimiento(A, miembro, id, { como: "deuda" }, prisma);
    const deuda = await prisma.deuda.findFirstOrThrow();
    await pagarCuota(A, deuda.id, "2026-12", "2026-12-05", 30_000, null, prisma);

    await expect(deshacerEnLaBandeja(A, "confirmacion", [id], prisma)).rejects.toThrow(/cuotas pagadas/);
    expect(await movimiento(id)).toMatchObject({ estado: "CONFIRMADO", deudaId: deuda.id });
  });
});

describe("descartar, deshacer y anotar igual", () => {
  test("descartar lo saca de la bandeja; deshacer lo devuelve", async () => {
    const { id } = await registrar("bsale/boleta.txt");
    expect(await descartarMovimiento(A, id, prisma)).toEqual({ comercio: "COMERCIAL LOS AROMOS SPA" });
    expect((await bandeja()).porRevisar).toEqual([]);

    await deshacerEnLaBandeja(A, "descarte", [id], prisma);
    expect((await bandeja()).porRevisar.map((m) => m.id)).toEqual([id]);
  });

  test("deshacer una confirmacion borra el gasto y lo vuelve a la bandeja", async () => {
    const { id } = await registrar("bsale/boleta.txt");
    await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: supermercado }, prisma);
    expect(await prisma.gasto.count()).toBe(1);

    await deshacerEnLaBandeja(A, "confirmacion", [id], prisma);
    expect(await prisma.gasto.count()).toBe(0);
    expect(await movimiento(id)).toMatchObject({ estado: "POR_REVISAR", destino: null, gastoId: null });
  });

  test("deshacer «es el mismo» suelta el enlace y deja el gasto que ya estaba", async () => {
    const aMano = await crearGasto(
      A,
      { fecha: "2026-11-09", descripcion: "Almacén", monto: 23_990, categoriaId: supermercado, medioPago: "EFECTIVO", notas: null },
      prisma,
    );
    const { id } = await registrar("bsale/boleta.txt");
    await confirmarMovimiento(A, miembro, id, { como: "mismo-gasto", gastoId: aMano.id }, prisma);
    await deshacerEnLaBandeja(A, "confirmacion", [id], prisma);
    expect(await prisma.gasto.count({ where: { id: aMano.id } })).toBe(1);
    expect((await movimiento(id)).gastoId).toBeNull();
  });

  test("un traspaso se puede anotar igual, y deshacerlo lo deja fuera otra vez", async () => {
    await prisma.cuentaBancaria.create({
      data: { hogarId: A, banco: "Banco de Chile", tipo: "CUENTA_CORRIENTE", ultimos4: "7890" },
    });
    const { id } = await registrar("santander/transferencia-enviada.txt");
    expect(await anotarIgual(A, id, prisma)).toEqual({ comercio: "Pedro Muñoz Lagos" });

    const [item] = (await bandeja()).porRevisar;
    expect(item).toMatchObject({ id, tipo: "TRASPASO_PROPIO" });
    expect(item?.revision.avisos).toContain("estaba-fuera");

    await deshacerEnLaBandeja(A, "anotar-igual", [id], prisma);
    expect((await movimiento(id)).estado).toBe("IGNORADO");
  });

  test("un ingreso no se anota como gasto", async () => {
    const { id } = await registrar("santander/transferencia-recibida.txt");
    await expect(anotarIgual(A, id, prisma)).rejects.toThrow(/entró/);
    expect((await movimiento(id)).estado).toBe("IGNORADO");
  });
});

describe("las reglas de comercio", () => {
  test("con regla, llega con su categoria y lista para confirmar con las demas", async () => {
    const { id } = await registrar("lider/boleta-digital.txt");
    expect(await crearReglaDeComercio(A, id, supermercado, prisma)).toEqual({ etiqueta: "Líder", categoria: "Supermercado" });

    const [item] = (await bandeja()).porRevisar;
    expect(item?.revision).toMatchObject({
      categoria: { categoriaId: supermercado, porque: "regla", de: "Líder" },
      lista: true,
    });

    // Y vale para el aviso del banco del mismo comercio.
    await registrarLectura(avisoDeCompra({ monto: 9_990, fecha: "2026-11-19", ultimos4: "1111" }), "otra-compra");
    const enLider = (await bandeja()).porRevisar.find((m) => m.comercio === "LIDER EXPRESS LOS LEONES");
    expect(enLider?.revision.categoria?.categoriaId).toBe(supermercado);
  });

  test("al confirmar un comercio sin regla, se ofrece crearla; con otra categoria, cambiarla; con la misma, nada", async () => {
    const primero = await registrar("lider/boleta-digital.txt");
    const sinRegla = await confirmarMovimiento(A, miembro, primero.id, { como: "gasto", categoriaId: supermercado }, prisma);
    expect(sinRegla.regla).toEqual({
      movimientoId: primero.id,
      categoriaId: supermercado,
      categoria: "Supermercado",
      etiqueta: "Líder",
      cambia: false,
    });
    await crearReglaDeComercio(A, primero.id, supermercado, prisma);

    const segundo = await registrarLectura(avisoDeCompra({ monto: 9_990, ultimos4: "1111" }), "segunda");
    const otra = await confirmarMovimiento(A, miembro, segundo.id, { como: "gasto", categoriaId: transporte }, prisma);
    expect(otra.regla).toMatchObject({ cambia: true, categoria: "Transporte" });

    const tercero = await registrarLectura(avisoDeCompra({ monto: 4_990, ultimos4: "2222" }), "tercera");
    const misma = await confirmarMovimiento(A, miembro, tercero.id, { como: "gasto", categoriaId: supermercado }, prisma);
    expect(misma.regla).toBeNull();
  });

  test("cambiar la regla la reemplaza: una por comercio", async () => {
    const { id } = await registrar("lider/boleta-digital.txt");
    await crearReglaDeComercio(A, id, supermercado, prisma);
    await crearReglaDeComercio(A, id, transporte, prisma);
    expect(await prisma.reglaDeComercio.findMany({ select: { clave: true, categoriaId: true } })).toEqual([
      { clave: "lider", categoriaId: transporte },
    ]);
  });

  test("un aviso sin detalle no tiene regla", async () => {
    const { id } = await registrar("consorcio/cargo.txt");
    await expect(crearReglaDeComercio(A, id, supermercado, prisma)).rejects.toThrow(/comercio/);
  });
});

describe("cada hogar con lo suyo", () => {
  test("la bandeja de un hogar no ve lo del otro", async () => {
    await registrar("santander/transferencia-enviada.txt", A);
    expect((await bandeja(A)).porRevisar).toHaveLength(1);
    expect(await bandeja(B)).toEqual({ porRevisar: [], dejadosFuera: [], visible: false });
  });

  test("un movimiento de otro hogar no se confirma, ni se descarta, ni se deshace", async () => {
    const { id } = await registrar("santander/transferencia-enviada.txt", A);
    await expect(confirmarMovimiento(B, null, id, { como: "gasto", categoriaId: deB }, prisma)).rejects.toThrow(
      /ya no está por revisar/,
    );
    await expect(descartarMovimiento(B, id, prisma)).rejects.toThrow(/ya no está por revisar/);
    await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: transporte }, prisma);
    await expect(deshacerEnLaBandeja(B, "confirmacion", [id], prisma)).rejects.toThrow(/ya no está confirmado/);
    await expect(crearReglaDeComercio(B, id, deB, prisma)).rejects.toThrow(/ya no existe/);

    expect(await prisma.gasto.count({ where: { hogarId: B } })).toBe(0);
    expect(await movimiento(id)).toMatchObject({ estado: "CONFIRMADO", hogarId: A });
  });

  test("ni se paga una cuenta de otro hogar desde la bandeja", async () => {
    const ajena = await crearCuenta(
      B,
      { nombre: "Luz", monto: 48_350, mes: "2026-11", diaVencimiento: null, categoriaId: deB, mensual: false, nota: null },
      prisma,
    );
    const { id } = await registrar("santander/pago-de-cuenta.txt", A);
    await expect(confirmarMovimiento(A, miembro, id, { como: "pago-de-cuenta", cuentaId: ajena.id }, prisma)).rejects.toThrow();
    expect((await movimiento(id)).estado).toBe("POR_REVISAR");
    expect((await listarCuentasDelMes(B, "2026-11", prisma))[0]?.pagadaEn).toBeNull();
  });
});

describe("cuando se ve la bandeja", () => {
  test("sin movimientos no aparece, y despues de confirmar el ultimo sigue a la vista, al dia", async () => {
    expect((await bandeja()).visible).toBe(false);
    const { id } = await registrar("bsale/boleta.txt");
    expect((await bandeja()).visible).toBe(true);
    await confirmarMovimiento(A, miembro, id, { como: "gasto", categoriaId: supermercado }, prisma);
    expect(await bandeja()).toMatchObject({ porRevisar: [], visible: true });
  });

  test("lo mas reciente primero", async () => {
    const vieja = await registrar("bsale/boleta.txt");
    const nueva = await registrar("santander/transferencia-enviada.txt");
    expect((await bandeja()).porRevisar.map((m) => m.id)).toEqual([nueva.id, vieja.id]);
  });
});

describe("la copia a la nube", () => {
  test("lleva los movimientos, aunque el juntado sea mas antiguo que su principal", async () => {
    await limpiar(nube);
    const cargo = await registrar("consorcio/cargo.txt");
    const transferencia = await registrar("consorcio/transferencia-enviada.txt");
    await crearReglaDeComercio(A, transferencia.id, transporte, prisma);
    await prisma.cuentaBancaria.create({ data: { hogarId: A, banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" } });
    await confirmarMovimiento(A, miembro, transferencia.id, { como: "gasto", categoriaId: transporte }, prisma);
    expect(cargo.id < transferencia.id).toBe(true);

    const datos = await leerTodo(prisma);
    // De a una fila por INSERT: si el juntado fuera antes que su principal, fallaria.
    await copiarDatos(datos, nube, { lote: 1 });
    expect(await tablasDistintas(datos, nube)).toEqual([]);
    expect(await nube.movimiento.findUniqueOrThrow({ where: { id: cargo.id } })).toMatchObject({
      estado: "JUNTADO",
      juntadoConId: transferencia.id,
    });
  });
});

describe("la fecha de un movimiento", () => {
  test("vuelve como el mismo dia, sin correrse en Chile", async () => {
    for (const fecha of ["2026-11-01", "2026-11-30", "2027-01-01"]) {
      const { id } = await registrarLectura(avisoDeCompra({ fecha, monto: 1_000 + Number(fecha.slice(-2)) }), fecha);
      expect(isoDesdeFecha((await movimiento(id)).fecha)).toBe(fecha);
      expect((await movimiento(id)).fecha).toEqual(fechaDesdeISO(fecha));
    }
  });
});
