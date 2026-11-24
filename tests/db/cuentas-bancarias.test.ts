import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import { agregarCuentas, editarCuenta, leerCuentasBancarias, leerLosBancosDelHogar, quitarCuenta } from "@/datos/bancos";
import { fechaDesdeISO } from "@/lib/fecha";

/*
  Las cuentas y tarjetas del hogar contra la base: se guardan con el nombre
  del catalogo y solo los ultimos 4 digitos, todas o ninguna, y cada hogar
  ve y cambia solo las suyas.
*/

let prisma: PrismaClient;
const OTRO = "hogar-de-ana";
let yo: string;
let ana: string;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  yo = await miembroDePrueba(prisma, { correo: "camila@gmail.com" });
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  ana = await miembroDePrueba(prisma, { hogarId: OTRO, correo: "ana@gmail.com" });
});

describe("agregar las cuentas de un banco", () => {
  test("se guardan con el nombre del catalogo, los 4 digitos limpios y de quien las agrego", async () => {
    const agregado = await agregarCuentas(
      HOGAR_INICIAL,
      yo,
      [
        { banco: "banco santander", tipo: "CUENTA_CORRIENTE", ultimos4: "•••• 5678", apodo: "  Cuenta   sueldo " },
        { banco: "banco santander", tipo: "TARJETA_CREDITO", ultimos4: "4821", apodo: "" },
      ],
      prisma,
    );
    expect(agregado).toEqual({ banco: "Santander", agregadas: 2 });
    expect(await leerCuentasBancarias(HOGAR_INICIAL, prisma)).toEqual([
      expect.objectContaining({ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678", apodo: "Cuenta sueldo", miembroId: yo }),
      expect.objectContaining({ banco: "Santander", tipo: "TARJETA_CREDITO", ultimos4: "4821", apodo: null, miembroId: yo }),
    ]);
  });

  test("un banco que no esta en el catalogo se guarda como se escribio", async () => {
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "  Caja   Los Andes ", tipo: "CUENTA_AHORRO", ultimos4: "1111" }], prisma);
    expect((await leerCuentasBancarias(HOGAR_INICIAL, prisma))[0]!.banco).toBe("Caja Los Andes");
  });

  test("nunca el numero completo: solo 4 numeros", async () => {
    await expect(
      agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "0-000-12-34567-8" }], prisma),
    ).rejects.toThrow(/4 números/);
    expect(await prisma.cuentaBancaria.count()).toBe(0);
  });

  test("si una ya estaba, no se agrega ninguna", async () => {
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" }], prisma);
    await expect(
      agregarCuentas(
        HOGAR_INICIAL,
        yo,
        [
          { banco: "Santander", tipo: "TARJETA_CREDITO", ultimos4: "4821" },
          { banco: "BANCO SANTANDER-CHILE", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" },
        ],
        prisma,
      ),
    ).rejects.toThrow("Esa ya está en el hogar: cuenta corriente de Santander terminada en 5678.");
    expect(await prisma.cuentaBancaria.count()).toBe(1);
  });

  test("la misma escrita dos veces de una vez tampoco", async () => {
    const misma = { banco: "Consorcio", tipo: "CUENTA_VISTA" as const, ultimos4: "2345" };
    await expect(agregarCuentas(HOGAR_INICIAL, yo, [misma, misma], prisma)).rejects.toThrow(/dos veces/);
  });

  test("otro hogar puede tener una igual: cada hogar tiene las suyas", async () => {
    const igual = { banco: "Santander", tipo: "CUENTA_CORRIENTE" as const, ultimos4: "5678" };
    await agregarCuentas(HOGAR_INICIAL, yo, [igual], prisma);
    await agregarCuentas(OTRO, ana, [igual], prisma);
    expect(await leerCuentasBancarias(OTRO, prisma)).toHaveLength(1);
    // Y nadie agrega cuentas en un hogar que no es el suyo.
    await expect(agregarCuentas(OTRO, yo, [igual], prisma)).rejects.toThrow(/Ya no eres parte/);
  });
});

describe("cambiar y quitar", () => {
  test("se cambian el tipo, los digitos y el nombre", async () => {
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" }], prisma);
    const [cuenta] = await leerCuentasBancarias(HOGAR_INICIAL, prisma);
    await editarCuenta(HOGAR_INICIAL, cuenta!.id, { tipo: "CUENTA_VISTA", ultimos4: "8765", apodo: "La vista" }, prisma);
    expect((await leerCuentasBancarias(HOGAR_INICIAL, prisma))[0]).toMatchObject({ tipo: "CUENTA_VISTA", ultimos4: "8765", apodo: "La vista" });
  });

  test("la cuenta de otro hogar no se cambia ni se quita", async () => {
    await agregarCuentas(OTRO, ana, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" }], prisma);
    const [deAna] = await leerCuentasBancarias(OTRO, prisma);
    await expect(editarCuenta(HOGAR_INICIAL, deAna!.id, { tipo: "CUENTA_VISTA", ultimos4: "1111" }, prisma)).rejects.toThrow(/ya no está/);
    await expect(quitarCuenta(HOGAR_INICIAL, deAna!.id, prisma)).rejects.toThrow(/ya no está/);
    expect((await leerCuentasBancarias(OTRO, prisma))[0]).toMatchObject({ tipo: "CUENTA_CORRIENTE", ultimos4: "5678" });
  });

  test("al quitar una cuenta, lo que ya llego se queda, sin cuenta", async () => {
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" }], prisma);
    const [cuenta] = await leerCuentasBancarias(HOGAR_INICIAL, prisma);
    const movimiento = await prisma.movimiento.create({
      data: {
        hogarId: HOGAR_INICIAL,
        huella: "c".repeat(64),
        tipo: "TRANSFERENCIA",
        sentido: "GASTO",
        monto: 10_000,
        fecha: fechaDesdeISO("2026-11-18"),
        comercio: "Pedro",
        fuente: "Comprobante de Santander",
        recibidoEn: new Date(),
        cuentaBancariaId: cuenta!.id,
      },
    });
    await quitarCuenta(HOGAR_INICIAL, cuenta!.id, prisma);
    expect(await prisma.movimiento.findUniqueOrThrow({ where: { id: movimiento.id } })).toMatchObject({ cuentaBancariaId: null });
  });
});

describe("lo que se muestra de cada banco", () => {
  test("cada banco con sus cuentas, su ultimo comprobante y sus remitentes, y la lista para la regla", async () => {
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" }], prisma);
    await agregarCuentas(HOGAR_INICIAL, yo, [{ banco: "BCI", tipo: "TARJETA_CREDITO", ultimos4: "4444" }], prisma);
    const [, bci] = await leerCuentasBancarias(HOGAR_INICIAL, prisma);
    const base = { hogarId: HOGAR_INICIAL, sentido: "GASTO" as const, monto: 5_000, comercio: "X", recibidoEn: new Date() };
    // Uno de BCI leido con IA (sin plantilla) y en su tarjeta, desde una
    // direccion que el dominio de BCI no toma: Luka aprende su remitente.
    await prisma.movimiento.create({
      data: { ...base, huella: "d".repeat(64), tipo: "COMPRA", fecha: fechaDesdeISO("2026-11-17"), fuente: "Aviso de compra BCI", remitente: "notificaciones@bcimail.cl", cuentaBancariaId: bci!.id },
    });
    // Uno de Santander, leido con su plantilla.
    await prisma.movimiento.create({
      data: { ...base, huella: "e".repeat(64), tipo: "TRANSFERENCIA", fecha: fechaDesdeISO("2026-11-18"), fuente: "Comprobante de Santander", plantilla: "santander/transferencia-enviada", remitente: "mensajeria@santander.cl" },
    });
    // Uno de hace mucho no cuenta.
    await prisma.movimiento.create({
      data: { ...base, huella: "f".repeat(64), tipo: "COMPRA", fecha: fechaDesdeISO("2026-05-01"), fuente: "Aviso viejo de BCI", remitente: "viejo@bci.cl", cuentaBancariaId: bci!.id },
    });

    const { bancos, remitentes } = await leerLosBancosDelHogar(HOGAR_INICIAL, { db: prisma, hoy: "2026-11-20" });
    expect(bancos.map((b) => ({ banco: b.banco, conPlantillas: b.conPlantillas, ultimo: b.ultimo, remitentes: b.remitentes }))).toEqual([
      {
        banco: "Santander",
        conPlantillas: true,
        ultimo: { fecha: "2026-11-18", fuente: "Comprobante de Santander" },
        remitentes: ["mensajeria@santander.cl", "bdp@santander.cl"],
      },
      {
        banco: "BCI",
        conPlantillas: false,
        ultimo: { fecha: "2026-11-17", fuente: "Aviso de compra BCI" },
        remitentes: ["bci.cl", "notificaciones@bcimail.cl"],
      },
    ]);
    expect(remitentes).toEqual([
      "mensajeria@santander.cl",
      "bdp@santander.cl",
      "bci.cl",
      "notificaciones@bcimail.cl",
      "lider.cl",
      "bsale.app",
      "bsale.cl",
    ]);
  });
});
