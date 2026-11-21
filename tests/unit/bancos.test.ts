import { describe, expect, test } from "vitest";
import {
  bancoConocido,
  bancoDelComprobante,
  bancosDelHogar,
  cuentaDelMovimiento,
  limpiarUltimos4,
  mismoBanco,
  nombreDeLaCuenta,
  remitentesConocidos,
  remitentesParaLaRegla,
  type CuentaBancariaDelHogar,
  type CuentaParaElegir,
} from "@/dominio/bancos";

/*
  Los bancos y las cuentas del hogar, sin base: como se reconoce un banco con
  cualquier nombre, de que banco es un comprobante y a que cuenta o tarjeta
  va cada movimiento. Todos los digitos son inventados.
*/

describe("el catalogo de bancos", () => {
  test.each([
    ["Santander", "Santander"],
    ["BANCO SANTANDER-CHILE", "Santander"],
    ["bancoestado", "BancoEstado"],
    ["Banco del Estado de Chile", "BancoEstado"],
    ["Banco de Crédito e Inversiones", "BCI"],
    ["BANCO DE CHILE", "Banco de Chile"],
    ["Banco Edwards", "Banco de Chile"],
    ["BANCO ITAU", "Itaú"],
    ["Banco Consorcio", "Consorcio"],
    ["CMR Falabella", "Banco Falabella"],
    ["coopeuch", "Coopeuch"],
  ])("%s es %s", (nombre, esperado) => {
    expect(bancoConocido(nombre)?.nombre).toBe(esperado);
  });

  test("un banco que no esta en el catalogo, o un nombre vacio, no es ninguno", () => {
    expect(bancoConocido("Caja Los Andes")).toBeNull();
    expect(bancoConocido("   ")).toBeNull();
  });

  test.each([
    ["BCI", "Banco de Crédito e Inversiones", true],
    ["Banco Edwards", "Banco de Chile", true],
    ["Itaú Corpbanca", "BANCO ITAU", true],
    ["Banco Falabella", "CMR Falabella", true],
    ["Banco de Chile", "BancoEstado", false],
    ["MACH", "Mercado Pago", false],
    ["Caja Los Andes", "caja los andes", true],
  ])("%s y %s: el mismo banco es %s", (a, b, igual) => {
    expect(mismoBanco(a, b)).toBe(igual);
  });
});

describe("los remitentes que Luka ya conoce", () => {
  test("de Santander, los de sus comprobantes y no los de publicidad", () => {
    const santander = remitentesConocidos("santander");
    expect(santander).toEqual(["mensajeria@santander.cl", "bdp@santander.cl"]);
    expect(santander).not.toContain("comunicaciones.santander.cl");
  });

  test("de Consorcio, los avisos y la cartola, pero no los avisos de seguridad", () => {
    const consorcio = remitentesConocidos("consorcio");
    expect(consorcio).toContain("mensajes@bancoconsorcio.cl");
    expect(consorcio).toContain("bancoconsorcio@bancoconsorcio.cl");
    expect(consorcio).not.toContain("clave@consorcio.cl");
    expect(consorcio).not.toContain("info.consorcio.cl");
  });

  test("de las tiendas, el dominio tal como va en la regla", () => {
    expect(remitentesConocidos("lider")).toEqual(["lider.cl"]);
    expect(remitentesConocidos("bsale")).toEqual(["bsale.app", "bsale.cl"]);
  });

  test("de un banco sin plantillas, ninguno: los aprende con el primer comprobante", () => {
    expect(remitentesConocidos("bci")).toEqual([]);
  });

  test("la regla junta los de tus bancos, los aprendidos y los de las tiendas, sin repetir", () => {
    const lista = remitentesParaLaRegla(
      ["Santander", "Banco Consorcio", "BCI"],
      [
        { banco: "BCI", remitente: "Notificaciones@BCI.cl" },
        { banco: "Santander", remitente: "mensajeria@santander.cl" },
        { banco: "Itaú", remitente: "avisos@itau.cl" },
      ],
    );
    expect(lista).toEqual([
      "mensajeria@santander.cl",
      "bdp@santander.cl",
      "bancoconsorcio@bancoconsorcio.cl",
      "mensajes@bancoconsorcio.cl",
      "notificaciones@bci.cl",
      "lider.cl",
      "bsale.app",
      "bsale.cl",
    ]);
  });
});

describe("de que banco es un comprobante", () => {
  test("por la plantilla que lo leyo", () => {
    expect(bancoDelComprobante({ plantilla: "santander/transferencia-enviada", remitente: null, fuente: null })).toBe("Santander");
    expect(bancoDelComprobante({ plantilla: "consorcio/cargo", remitente: null, fuente: null })).toBe("Consorcio");
  });

  test("una boleta de tienda no es de ningun banco", () => {
    expect(bancoDelComprobante({ plantilla: "lider/boleta-digital", remitente: "contacto@info.lider.cl", fuente: "Boleta" })).toBeNull();
  });

  test("sin plantilla, por el remitente que Luka conoce", () => {
    expect(bancoDelComprobante({ plantilla: null, remitente: "notificaciones@correo.bancoestado.cl", fuente: null })).toBe("BancoEstado");
  });

  test("leido con IA, por la fuente", () => {
    const fuente = (texto: string) => bancoDelComprobante({ plantilla: null, remitente: "alertas@banco-nuevo.cl", fuente: texto });
    expect(fuente("Comprobante de transferencia del Banco de Chile")).toBe("Banco de Chile");
    expect(fuente("Aviso de compra BCI")).toBe("BCI");
    expect(fuente("Comprobante de Banco del Estado de Chile")).toBe("BancoEstado");
    expect(fuente("Boleta de la farmacia")).toBeNull();
  });
});

describe("a que cuenta o tarjeta va cada movimiento", () => {
  const cuenta = (datos: Partial<CuentaParaElegir> & Pick<CuentaParaElegir, "id">): CuentaParaElegir => ({
    banco: "Santander",
    tipo: "CUENTA_CORRIENTE",
    ultimos4: "5678",
    miembroId: "yo",
    ...datos,
  });
  const transferencia = { tipo: "TRANSFERENCIA" as const, medioPago: "TRANSFERENCIA" as const, ultimos4: "5678" };

  test("por los 4 digitos y el banco, aunque otra cuenta termine igual en otro banco", () => {
    const cuentas = [cuenta({ id: "consorcio", banco: "Consorcio" }), cuenta({ id: "santander" })];
    expect(cuentaDelMovimiento(transferencia, "Santander", cuentas, "yo")).toBe("santander");
    expect(cuentaDelMovimiento(transferencia, "BANCO CONSORCIO", cuentas, "yo")).toBe("consorcio");
  });

  test("sin los 4 digitos, o si no calzan, no se elige ninguna", () => {
    const cuentas = [cuenta({ id: "santander" })];
    expect(cuentaDelMovimiento({ ...transferencia, ultimos4: null }, "Santander", cuentas, "yo")).toBeNull();
    expect(cuentaDelMovimiento({ ...transferencia, ultimos4: "1111" }, "Santander", cuentas, "yo")).toBeNull();
    expect(cuentaDelMovimiento(transferencia, "BCI", cuentas, "yo")).toBeNull();
  });

  test("una boleta de tienda va a la tarjeta con que se pago, no a una cuenta que termina igual", () => {
    const cuentas = [
      cuenta({ id: "vista", banco: "Consorcio", tipo: "CUENTA_VISTA", ultimos4: "4821" }),
      cuenta({ id: "visa", tipo: "TARJETA_CREDITO", ultimos4: "4821" }),
    ];
    const boleta = { tipo: "BOLETA" as const, medioPago: "CREDITO" as const, ultimos4: "4821" };
    expect(cuentaDelMovimiento(boleta, null, cuentas, "yo")).toBe("visa");
    // Con debito no puede ser la tarjeta de credito.
    expect(cuentaDelMovimiento({ ...boleta, medioPago: "DEBITO" }, null, cuentas, "yo")).toBe("vista");
  });

  test("si dos del hogar tienen una que termina igual, gana la de quien lo reenvio", () => {
    const cuentas = [cuenta({ id: "mia" }), cuenta({ id: "de-ana", tipo: "CUENTA_VISTA", miembroId: "ana" })];
    expect(cuentaDelMovimiento(transferencia, "Santander", cuentas, "yo")).toBe("mia");
    expect(cuentaDelMovimiento(transferencia, "Santander", cuentas, "ana")).toBe("de-ana");
    // Si lo reenvio alguien que no tiene ninguna de las dos, no se adivina.
    expect(cuentaDelMovimiento(transferencia, "Santander", cuentas, "otro")).toBeNull();
  });

  test("el pago de la tarjeta sale de una cuenta, no de la tarjeta", () => {
    const cuentas = [cuenta({ id: "corriente" }), cuenta({ id: "visa", tipo: "TARJETA_CREDITO" })];
    const pago = { tipo: "PAGO_TARJETA" as const, medioPago: null, ultimos4: "5678" };
    expect(cuentaDelMovimiento(pago, "Santander", cuentas, "yo")).toBe("corriente");
  });
});

describe("como se escriben y se muestran", () => {
  test("los ultimos 4 digitos, sin adornos", () => {
    expect(limpiarUltimos4("•••• 1234")).toBe("1234");
    expect(limpiarUltimos4("**** 0583")).toBe("0583");
    expect(limpiarUltimos4("12345")).toBeNull();
    expect(limpiarUltimos4("12a4")).toBeNull();
  });

  test("el nombre de una cuenta, con su apodo o con su tipo", () => {
    expect(nombreDeLaCuenta({ apodo: "Cuenta sueldo", tipo: "CUENTA_CORRIENTE", ultimos4: "1234" })).toBe("Cuenta sueldo · •••• 1234");
    expect(nombreDeLaCuenta({ apodo: null, tipo: "TARJETA_CREDITO", ultimos4: "4821" })).toBe("Tarjeta de crédito •••• 4821");
    expect(nombreDeLaCuenta({ apodo: "  ", tipo: "TARJETA_PREPAGO", ultimos4: "9090" })).toBe("Tarjeta de prepago •••• 9090");
  });
});

describe("los bancos del hogar en la pantalla", () => {
  const cuenta = (datos: Partial<CuentaBancariaDelHogar> & Pick<CuentaBancariaDelHogar, "id" | "banco">): CuentaBancariaDelHogar => ({
    tipo: "CUENTA_CORRIENTE",
    ultimos4: "1234",
    miembroId: "yo",
    apodo: null,
    ...datos,
  });

  test("las cuentas del mismo banco van juntas aunque el nombre se escriba distinto", () => {
    const grupos = bancosDelHogar(
      [
        cuenta({ id: "a", banco: "Santander" }),
        cuenta({ id: "b", banco: "Consorcio" }),
        cuenta({ id: "c", banco: "BANCO SANTANDER-CHILE", tipo: "TARJETA_CREDITO", ultimos4: "4821" }),
      ],
      [],
    );
    expect(grupos.map((g) => [g.banco, g.cuentas.map((c) => c.id)])).toEqual([
      ["Santander", ["a", "c"]],
      ["Consorcio", ["b"]],
    ]);
    expect(grupos[0]!.conPlantillas).toBe(true);
    expect(grupos[0]!.ultimo).toBeNull();
  });

  test("cada banco muestra su ultimo comprobante y aprende los remitentes nuevos", () => {
    const [bci] = bancosDelHogar(
      [cuenta({ id: "a", banco: "BCI" })],
      [
        { banco: "BCI", fecha: "2026-11-10", fuente: "Aviso de BCI", remitente: "Notificaciones@bci.cl" },
        { banco: "BCI", fecha: "2026-11-18", fuente: "Comprobante de BCI", remitente: "notificaciones@bci.cl" },
        { banco: "Itaú", fecha: "2026-11-19", fuente: "Itaú", remitente: "avisos@itau.cl" },
      ],
    );
    expect(bci!.conPlantillas).toBe(false);
    expect(bci!.ultimo).toEqual({ fecha: "2026-11-18", fuente: "Comprobante de BCI" });
    expect(bci!.remitentes).toEqual(["notificaciones@bci.cl"]);
  });
});
