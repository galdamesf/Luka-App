import { describe, expect, test } from "vitest";
import { crearLector } from "@/dominio/comprobantes/lector";
import type { LecturaLeida } from "@/dominio/comprobantes/tipos";
import {
  buscarGastoParecido,
  buscarPagoPendiente,
  calzaConClave,
  claveDeComercio,
  cuentaPropiaDe,
  deLectura,
  elegirPareja,
  mismoBanco,
  motivoParaDejarFuera,
  propuestaDeDeuda,
  puedeAnotarseIgual,
  revisar,
  sonLaMismaCompra,
  sugerirCategoria,
  type CandidatoParaJuntar,
  type ContextoDeRevision,
  type CuentaDelHogar,
  type DatosDeMovimiento,
  type GastoParaComparar,
  type MovimientoParaJuntar,
} from "@/dominio/movimientos";
import { cargarEjemplo } from "../fixtures/comprobantes/cargar";

/*
  Las reglas de los movimientos, sin base de datos. Donde se puede, se parte
  de los ejemplos de comprobantes de la Seccion A leidos con el lector de
  verdad: asi lo que se prueba es lo que va a pasar con un correo real.
*/

const lector = crearLector();

async function leer(ruta: string): Promise<LecturaLeida> {
  const lectura = await lector(cargarEjemplo(ruta));
  if (!lectura.ok) throw new Error(`${ruta} no se leyo: ${lectura.motivo}`);
  return lectura;
}

function lectura(cambios: Partial<LecturaLeida> = {}): LecturaLeida {
  return {
    ok: true,
    tipo: "COMPRA",
    sentido: "gasto",
    monto: 23_480,
    moneda: "CLP",
    fecha: "2026-11-15",
    comercio: "LIDER EXPRESS LAS CONDES",
    fuente: "Aviso de Banco de Chile",
    via: "plantilla",
    plantilla: "bancochile/compra",
    ...cambios,
  };
}

const SANTANDER: CuentaDelHogar = { banco: "Santander", tipo: "CUENTA_CORRIENTE", ultimos4: "5678" };
const CONSORCIO: CuentaDelHogar = { banco: "Banco Consorcio", tipo: "CUENTA_VISTA", ultimos4: "2345" };
const TARJETA: CuentaDelHogar = { banco: "Santander", tipo: "TARJETA_CREDITO", ultimos4: "4821" };

function paraJuntar(datos: DatosDeMovimiento): MovimientoParaJuntar {
  return {
    estado: datos.estado,
    tipo: datos.tipo,
    sentido: datos.sentido,
    monto: datos.monto,
    moneda: datos.moneda,
    fecha: datos.fecha,
    ultimos4: datos.ultimos4,
    sinDetalle: datos.sinDetalle,
  };
}

function candidato(datos: DatosDeMovimiento, cambios: Partial<CandidatoParaJuntar> = {}): CandidatoParaJuntar {
  return { ...paraJuntar(datos), id: "m-1", tieneJuntado: false, ...cambios };
}

describe("de la lectura al movimiento", () => {
  test("una transferencia a otra persona va a la bandeja, con todo lo que dice el comprobante", async () => {
    const datos = deLectura(await leer("santander/transferencia-enviada.txt"), [SANTANDER]);
    expect(datos).toMatchObject({
      estado: "POR_REVISAR",
      tipo: "TRANSFERENCIA",
      sentido: "GASTO",
      monto: 245_000,
      moneda: "CLP",
      fecha: "2026-11-18",
      comercio: "Pedro Muñoz Lagos",
      fuente: "Comprobante de Santander",
      plantilla: "santander/transferencia-enviada",
      confianza: null,
      medioPago: "TRANSFERENCIA",
      ultimos4: "5678",
      contraparteNombre: "Pedro Muñoz Lagos",
      contraparteBanco: "Banco de Chile",
      contraparteUltimos4: "7890",
      sinDetalle: false,
      reenviadoAMano: false,
    });
  });

  test("lo que entra queda fuera: un ingreso no es un gasto", async () => {
    const datos = deLectura(await leer("santander/transferencia-recibida.txt"), []);
    expect(datos).toMatchObject({ tipo: "ABONO", sentido: "INGRESO", estado: "IGNORADO" });
    expect(motivoParaDejarFuera(datos)).toBe("ingreso");
  });

  test("una transferencia a otra cuenta del hogar es un traspaso, y queda fuera", () => {
    const aMiConsorcio = lectura({
      tipo: "TRANSFERENCIA",
      comercio: "Camila Rojas Soto",
      contraparte: { nombre: "Camila Rojas Soto", banco: "BANCO CONSORCIO", ultimos4: "2345" },
    });
    const datos = deLectura(aMiConsorcio, [SANTANDER, CONSORCIO]);
    expect(datos).toMatchObject({ tipo: "TRASPASO_PROPIO", sentido: "GASTO", estado: "IGNORADO" });
    expect(motivoParaDejarFuera(datos)).toBe("traspaso");
  });

  test("y la plata que llega desde otra cuenta del hogar, tambien", () => {
    const desdeMiSantander = lectura({
      tipo: "ABONO",
      sentido: "ingreso",
      contraparte: { nombre: "Camila Rojas Soto", banco: "Banco Santander-Chile", ultimos4: "5678" },
    });
    expect(deLectura(desdeMiSantander, [SANTANDER])).toMatchObject({ tipo: "TRASPASO_PROPIO", estado: "IGNORADO" });
  });

  test("con los mismos 4 digitos pero de otro banco, no es propia: se pregunta", () => {
    const aOtroBanco = lectura({
      tipo: "TRANSFERENCIA",
      contraparte: { nombre: "Pedro Muñoz Lagos", banco: "Banco de Chile", ultimos4: "2345" },
    });
    expect(deLectura(aOtroBanco, [CONSORCIO])).toMatchObject({ tipo: "TRANSFERENCIA", estado: "POR_REVISAR" });
  });

  test("si el comprobante no dice el banco, bastan los 4 digitos", () => {
    const sinBanco = lectura({ tipo: "TRANSFERENCIA", contraparte: { ultimos4: "2345" } });
    expect(deLectura(sinBanco, [CONSORCIO]).tipo).toBe("TRASPASO_PROPIO");
  });

  test("una transferencia a la tarjeta de credito del hogar es su pago", () => {
    const aLaTarjeta = lectura({ tipo: "TRANSFERENCIA", contraparte: { banco: "Santander", ultimos4: "4821" } });
    const datos = deLectura(aLaTarjeta, [TARJETA]);
    expect(datos).toMatchObject({ tipo: "PAGO_TARJETA", estado: "IGNORADO" });
  });

  test("el pago de la tarjeta y el giro quedan fuera", () => {
    expect(deLectura(lectura({ tipo: "PAGO_TARJETA" }), []).estado).toBe("IGNORADO");
    expect(deLectura(lectura({ tipo: "GIRO" }), []).estado).toBe("IGNORADO");
  });

  test("las cuotas: una sola no es compra en cuotas, y un numero imposible se descarta", () => {
    expect(deLectura(lectura({ cuotas: 1 }), []).cuotas).toBeNull();
    expect(deLectura(lectura({ cuotas: 3 }), []).cuotas).toBe(3);
    expect(deLectura(lectura({ cuotas: 999 }), []).cuotas).toBeNull();
  });

  test("lo leido con IA no tiene plantilla y guarda su confianza, entre 0 y 1", () => {
    const datos = deLectura(lectura({ via: "ia", plantilla: undefined, confianza: 1.4 }), []);
    expect(datos.plantilla).toBeNull();
    expect(datos.confianza).toBe(1);
  });

  test("solo guarda 4 digitos de verdad, y recorta lo que no cabe en la base", () => {
    const datos = deLectura(lectura({ ultimos4: "48211", comercio: "x".repeat(200) }), []);
    expect(datos.ultimos4).toBeNull();
    expect(datos.comercio).toHaveLength(120);
  });

  test("un monto que no es entero positivo no se guarda", () => {
    expect(() => deLectura(lectura({ monto: 0 }), [])).toThrow(/monto invalido/i);
    expect(() => deLectura(lectura({ monto: 12.5 }), [])).toThrow(/monto invalido/i);
  });

  test("lo reenviado a mano queda marcado", async () => {
    expect(deLectura(await leer("reenvios/bsale-desde-gmail.txt"), []).reenviadoAMano).toBe(true);
  });
});

describe("el mismo banco con otro nombre", () => {
  test.each([
    ["BANCO SANTANDER-CHILE", "Santander", true],
    ["BancoEstado", "Banco del Estado de Chile", true],
    ["BANCO ITAU", "Itaú", true],
    ["Banco de Chile", "BANCO DE CHILE", true],
    ["Banco de Chile", "Santander", false],
    ["BANCO CONSORCIO", "Banco Consorcio", true],
    ["Scotiabank", "BCI", false],
  ])("%s y %s: %s", (a, b, igual) => {
    expect(mismoBanco(a, b)).toBe(igual);
  });

  test("la cuenta propia se busca por los 4 digitos y el banco", () => {
    expect(cuentaPropiaDe({ ultimos4: "2345", banco: "Consorcio" }, [SANTANDER, CONSORCIO])).toBe(CONSORCIO);
    expect(cuentaPropiaDe({ ultimos4: null, banco: "Consorcio" }, [CONSORCIO])).toBeNull();
  });
});

describe("lo que se puede anotar igual", () => {
  test("lo que salio de tu cuenta si; lo que entro, no", () => {
    expect(puedeAnotarseIgual({ tipo: "TRASPASO_PROPIO", sentido: "GASTO" })).toBe(true);
    expect(puedeAnotarseIgual({ tipo: "PAGO_TARJETA", sentido: "GASTO" })).toBe(true);
    expect(puedeAnotarseIgual({ tipo: "GIRO", sentido: "GASTO" })).toBe(true);
    expect(puedeAnotarseIgual({ tipo: "ABONO", sentido: "INGRESO" })).toBe(false);
    expect(puedeAnotarseIgual({ tipo: "TRASPASO_PROPIO", sentido: "INGRESO" })).toBe(false);
    expect(puedeAnotarseIgual({ tipo: "COMPRA", sentido: "GASTO" })).toBe(false);
  });
});

describe("la boleta y el aviso de la misma compra", () => {
  test("el cargo de Consorcio y el comprobante de su transferencia son el mismo movimiento", async () => {
    const cargo = deLectura(await leer("consorcio/cargo.txt"), []);
    const transferencia = deLectura(await leer("consorcio/transferencia-enviada.txt"), []);
    expect(sonLaMismaCompra(paraJuntar(cargo), paraJuntar(transferencia))).toBe(true);
  });

  test("la compra de Consorcio y el cargo de la cuenta por lo mismo son uno, y queda a la vista la compra", async () => {
    const compra = deLectura(await leer("consorcio/compra.txt"), []);
    const cargo = deLectura(lectura({ tipo: "CARGO", monto: 12_990, fecha: "2026-11-23", ultimos4: "2345", sinDetalle: true }), []);
    expect(sonLaMismaCompra(paraJuntar(compra), paraJuntar(cargo))).toBe(true);
    expect(elegirPareja(paraJuntar(cargo), [candidato(compra)])?.principal).toBe("candidato");
    expect(elegirPareja(paraJuntar(compra), [candidato(cargo)])?.principal).toBe("nuevo");
  });

  test("llegue primero el que llegue, queda a la vista el que dice con quien", async () => {
    const cargo = deLectura(await leer("consorcio/cargo.txt"), []);
    const transferencia = deLectura(await leer("consorcio/transferencia-enviada.txt"), []);

    expect(elegirPareja(paraJuntar(transferencia), [candidato(cargo)])?.principal).toBe("nuevo");
    expect(elegirPareja(paraJuntar(cargo), [candidato(transferencia)])?.principal).toBe("candidato");
  });

  test("la boleta de la tienda y el aviso del banco, de la misma tarjeta, se juntan y manda la boleta", async () => {
    const boleta = deLectura(await leer("lider/boleta-digital.txt"), []);
    const aviso = deLectura(lectura({ monto: 6_170, fecha: "2026-11-16", ultimos4: "4821" }), []);
    expect(elegirPareja(paraJuntar(aviso), [candidato(boleta)])).toMatchObject({ principal: "candidato" });
    expect(elegirPareja(paraJuntar(boleta), [candidato(aviso)])).toMatchObject({ principal: "nuevo" });
  });

  test("con otra tarjeta, a dos dias o por otro monto, son compras distintas", async () => {
    const boleta = paraJuntar(deLectura(await leer("lider/boleta-digital.txt"), []));
    const aviso = paraJuntar(deLectura(lectura({ monto: 6_170, fecha: "2026-11-15", ultimos4: "4821" }), []));
    expect(sonLaMismaCompra(boleta, aviso)).toBe(true);
    expect(sonLaMismaCompra(boleta, { ...aviso, ultimos4: "1111" })).toBe(false);
    expect(sonLaMismaCompra(boleta, { ...aviso, fecha: "2026-11-17" })).toBe(false);
    expect(sonLaMismaCompra(boleta, { ...aviso, monto: 6_171 })).toBe(false);
  });

  test("un aviso sin detalle no compara los 4 digitos: trae los de la cuenta, no los de la tarjeta", async () => {
    const boleta = paraJuntar(deLectura(await leer("lider/boleta-digital.txt"), []));
    const cargo = paraJuntar(deLectura(lectura({ tipo: "CARGO", monto: 6_170, ultimos4: "2345", sinDetalle: true }), []));
    expect(sonLaMismaCompra(boleta, cargo)).toBe(true);
  });

  test("dos transferencias iguales el mismo dia pueden ser dos pagos: no se juntan", async () => {
    const una = paraJuntar(deLectura(await leer("santander/transferencia-enviada.txt"), []));
    expect(sonLaMismaCompra(una, { ...una })).toBe(false);
  });

  test("lo que entra no se junta con lo que sale", async () => {
    const abono = paraJuntar(deLectura(lectura({ tipo: "ABONO", sentido: "ingreso", sinDetalle: true }), []));
    const compra = paraJuntar(deLectura(lectura(), []));
    expect(sonLaMismaCompra(abono, compra)).toBe(false);
  });

  test("si el que ya estaba se confirmo, manda el, aunque diga menos", async () => {
    const cargo = deLectura(await leer("consorcio/cargo.txt"), []);
    const transferencia = deLectura(await leer("consorcio/transferencia-enviada.txt"), []);
    const pareja = elegirPareja(paraJuntar(transferencia), [candidato(cargo, { estado: "CONFIRMADO" })]);
    expect(pareja?.principal).toBe("candidato");
  });

  test("lo descartado y lo que ya tiene pareja no se junta", async () => {
    const cargo = deLectura(await leer("consorcio/cargo.txt"), []);
    const transferencia = paraJuntar(deLectura(await leer("consorcio/transferencia-enviada.txt"), []));
    expect(elegirPareja(transferencia, [candidato(cargo, { estado: "DESCARTADO" })])).toBeNull();
    expect(elegirPareja(transferencia, [candidato(cargo, { tieneJuntado: true })])).toBeNull();
    expect(elegirPareja(transferencia, [candidato(cargo, { estado: "JUNTADO" })])).toBeNull();
  });

  test("un traspaso que quedo fuera tambien se lleva su aviso de cargo", async () => {
    const traspaso = deLectura(
      lectura({ tipo: "TRANSFERENCIA", monto: 85_000, fecha: "2026-11-16", contraparte: { ultimos4: "5678" } }),
      [SANTANDER],
    );
    expect(traspaso.estado).toBe("IGNORADO");
    const cargo = paraJuntar(deLectura(await leer("consorcio/cargo.txt"), []));
    expect(elegirPareja(cargo, [candidato(traspaso)])?.principal).toBe("candidato");
  });

  test("de varios posibles, el de fecha mas cercana", async () => {
    const cargo = deLectura(await leer("consorcio/cargo.txt"), []);
    const transferencia = paraJuntar(deLectura(await leer("consorcio/transferencia-enviada.txt"), []));
    const pareja = elegirPareja(transferencia, [
      candidato(cargo, { id: "lejos", fecha: "2026-11-15" }),
      candidato(cargo, { id: "cerca", fecha: "2026-11-16" }),
    ]);
    expect(pareja?.candidato.id).toBe("cerca");
  });
});

describe("el comercio y sus reglas", () => {
  test.each([
    ["LIDER EXPRESS LAS CONDES", "COMPRA", "lider", "LIDER"],
    ["Líder", "BOLETA", "lider", "Líder"],
    ["COMERCIAL LOS AROMOS SPA", "BOLETA", "comercial los aromos", "COMERCIAL LOS AROMOS"],
    ["COPEC Av. Matta", "COMPRA", "copec", "COPEC"],
    ["UBER *TRIP", "COMPRA", "uber", "UBER"],
    ["PARIS.CL", "COMPRA", "paris", "PARIS"],
    ["MERPAGO*TIENDA XYZ", "COMPRA", "merpago tienda xyz", "MERPAGO TIENDA XYZ"],
    ["ENEL DISTRIBUCION", "PAGO", "enel", "ENEL"],
    ["Pedro Muñoz Lagos", "TRANSFERENCIA", "pedro munoz lagos", "Pedro Muñoz Lagos"],
  ] as const)("%s (%s) → %s", (comercio, tipo, clave, etiqueta) => {
    expect(claveDeComercio(comercio, tipo, false)).toEqual({ clave, etiqueta });
  });

  test("un aviso sin detalle, un ingreso o un traspaso no tienen regla", () => {
    expect(claveDeComercio("Cargo en cuenta Consorcio", "CARGO", true)).toBeNull();
    expect(claveDeComercio("ANA DIAZ PEREZ", "ABONO", false)).toBeNull();
    expect(claveDeComercio("Camila Rojas", "TRASPASO_PROPIO", false)).toBeNull();
    expect(claveDeComercio("  ", "COMPRA", false)).toBeNull();
  });

  test("calza todo lo que empieza con las palabras de la regla", () => {
    expect(calzaConClave("LIDER EXPRESS LAS CONDES", "lider")).toBe(true);
    expect(calzaConClave("Líder", "lider")).toBe(true);
    expect(calzaConClave("Supermercado Líder", "lider")).toBe(false);
    expect(calzaConClave("Pedro Muñoz", "pedro munoz lagos")).toBe(false);
    expect(calzaConClave("Pedro Muñoz Lagos", "pedro munoz lagos")).toBe(true);
  });
});

describe("la categoria que se propone", () => {
  const ACTIVAS = new Set(["super", "bencina", "hogar", "deudas"]);
  const gasto = (cambios: Partial<GastoParaComparar>): GastoParaComparar => ({
    id: "g",
    fecha: "2026-11-01",
    descripcion: "Líder",
    monto: 10_000,
    categoriaId: "super",
    pagoDe: null,
    fuentes: [],
    ...cambios,
  });
  const compraEnLider = { comercio: "LIDER EXPRESS LAS CONDES", tipo: "COMPRA" as const, sinDetalle: false };

  test("primero la regla del hogar", () => {
    const sugerida = sugerirCategoria(
      compraEnLider,
      [{ clave: "lider", etiqueta: "Líder", categoriaId: "hogar" }],
      [gasto({ categoriaId: "super" })],
      ACTIVAS,
    );
    expect(sugerida).toEqual({ categoriaId: "hogar", porque: "regla", de: "Líder" });
  });

  test("de dos reglas que calzan, la mas especifica", () => {
    const sugerida = sugerirCategoria(
      compraEnLider,
      [
        { clave: "lider", etiqueta: "Líder", categoriaId: "super" },
        { clave: "lider express", etiqueta: "Líder Express", categoriaId: "hogar" },
      ],
      [],
      ACTIVAS,
    );
    expect(sugerida?.categoriaId).toBe("hogar");
  });

  test("sin regla, la del ultimo gasto que empieza igual", () => {
    const sugerida = sugerirCategoria(
      compraEnLider,
      [],
      [gasto({ id: "viejo", fecha: "2026-10-01", categoriaId: "hogar" }), gasto({ id: "nuevo", fecha: "2026-11-10", categoriaId: "super" })],
      ACTIVAS,
    );
    expect(sugerida).toEqual({ categoriaId: "super", porque: "historial", de: "Líder" });
  });

  test("no propone una categoria desactivada ni la de las cuotas", () => {
    expect(
      sugerirCategoria(compraEnLider, [{ clave: "lider", etiqueta: "Líder", categoriaId: "vieja" }], [], ACTIVAS),
    ).toBeNull();
    expect(
      sugerirCategoria(compraEnLider, [], [gasto({ categoriaId: "deudas", pagoDe: { tipo: "cuota", nombre: "Líder" } })], ACTIVAS),
    ).toBeNull();
  });

  test("un aviso sin detalle no tiene de donde sacar categoria", () => {
    expect(
      sugerirCategoria(
        { comercio: "Cargo en cuenta Consorcio", tipo: "CARGO", sinDetalle: true },
        [],
        [gasto({ descripcion: "Cargo en cuenta Consorcio" })],
        ACTIVAS,
      ),
    ).toBeNull();
  });
});

describe("lo que ya estaba anotado", () => {
  const farmacia = { monto: 12_990, moneda: "CLP" as const, fecha: "2026-11-19", sentido: "GASTO" as const, fuente: "Boleta electrónica (Bsale)" };
  const gasto = (cambios: Partial<GastoParaComparar>): GastoParaComparar => ({
    id: "g",
    fecha: "2026-11-18",
    descripcion: "Farmacia",
    monto: 12_990,
    categoriaId: "salud",
    pagoDe: null,
    fuentes: [],
    ...cambios,
  });

  test("un gasto con el mismo monto hasta dos dias antes o despues: se pregunta si es el mismo", () => {
    expect(buscarGastoParecido(farmacia, [gasto({ fecha: "2026-11-21" })])?.id).toBe("g");
    expect(buscarGastoParecido(farmacia, [gasto({ fecha: "2026-11-17" })])?.id).toBe("g");
  });

  test("a tres dias, o con otro monto, no", () => {
    expect(buscarGastoParecido(farmacia, [gasto({ fecha: "2026-11-16" })])).toBeNull();
    expect(buscarGastoParecido(farmacia, [gasto({ monto: 12_991 })])).toBeNull();
  });

  test("el mas cercano, si hay varios", () => {
    const parecido = buscarGastoParecido(farmacia, [
      gasto({ id: "lejos", fecha: "2026-11-17" }),
      gasto({ id: "cerca", fecha: "2026-11-19" }),
    ]);
    expect(parecido?.id).toBe("cerca");
  });

  test("dos avisos del mismo banco por el mismo monto son dos compras: no se pregunta", () => {
    expect(buscarGastoParecido(farmacia, [gasto({ fuentes: ["Boleta electrónica (Bsale)"] })])).toBeNull();
    expect(buscarGastoParecido(farmacia, [gasto({ fuentes: ["Aviso de Santander"] })])?.id).toBe("g");
  });

  test("en dolares o lo que entra, no se compara", () => {
    expect(buscarGastoParecido({ ...farmacia, moneda: "USD" }, [gasto({})])).toBeNull();
    expect(buscarGastoParecido({ ...farmacia, sentido: "INGRESO" }, [gasto({})])).toBeNull();
  });
});

describe("lo que falta pagar", () => {
  const pagoEnel = { monto: 48_350, moneda: "CLP" as const, sentido: "GASTO" as const, tipo: "PAGO" as const, comercio: "ENEL DISTRIBUCION" };
  const luz = { id: "luz", nombre: "Luz", monto: 48_350, mes: "2026-11" };
  const agua = { id: "agua", nombre: "Agua", monto: 21_000, mes: "2026-11" };
  const credito = { deudaId: "d", nombre: "Crédito de consumo", mes: "2026-11", numero: 4, de: 12, monto: 89_000 };

  test("la cuenta del mismo monto exacto", () => {
    expect(buscarPagoPendiente(pagoEnel, [luz, agua], [])).toEqual({ tipo: "cuenta", cuenta: luz });
  });

  test("o la que comparte el nombre, aunque el monto haya cambiado", () => {
    const enel = { ...luz, nombre: "Luz (Enel)", monto: 45_000 };
    expect(buscarPagoPendiente(pagoEnel, [enel, agua], [])).toEqual({ tipo: "cuenta", cuenta: enel });
  });

  test("si dos calzan, la que cumple las dos cosas; si no, ninguna", () => {
    const gas = { id: "gas", nombre: "Gas", monto: 48_350, mes: "2026-11" };
    expect(buscarPagoPendiente(pagoEnel, [luz, gas], [])).toBeNull();
    const enel = { ...luz, nombre: "Enel" };
    expect(buscarPagoPendiente(pagoEnel, [enel, gas], [])).toEqual({ tipo: "cuenta", cuenta: enel });
  });

  test("tambien la cuota de una deuda", () => {
    const transferencia = { ...pagoEnel, tipo: "TRANSFERENCIA" as const, monto: 89_000, comercio: "Banco Ripley" };
    expect(buscarPagoPendiente(transferencia, [luz], [credito])).toEqual({ tipo: "cuota", cuota: credito });
  });

  test("una boleta o lo que entra no paga nada", () => {
    expect(buscarPagoPendiente({ ...pagoEnel, tipo: "BOLETA" }, [luz], [])).toBeNull();
    expect(buscarPagoPendiente({ ...pagoEnel, sentido: "INGRESO" }, [luz], [])).toBeNull();
  });
});

describe("una compra en cuotas", () => {
  test("se propone como deuda: la cuota redondeada al peso y la primera el mes siguiente", () => {
    const deuda = propuestaDeDeuda({ comercio: "PARIS.CL", monto: 89_970, cuotas: 3, fecha: "2026-11-18" });
    expect(deuda).toEqual({ nombre: "PARIS.CL", cuotas: 3, montoCuota: 29_990, primeraCuota: "2026-12" });
    expect(propuestaDeDeuda({ comercio: "X", monto: 100_000, cuotas: 3, fecha: "2026-11-18" }).montoCuota).toBe(33_333);
  });

  test("con el mes que parte el 27, una compra del 28 de noviembre es de diciembre y su primera cuota de enero", () => {
    expect(propuestaDeDeuda({ comercio: "X", monto: 60_000, cuotas: 2, fecha: "2026-11-28" }, 27).primeraCuota).toBe("2027-01");
    expect(propuestaDeDeuda({ comercio: "X", monto: 60_000, cuotas: 2, fecha: "2026-11-20" }, 27).primeraCuota).toBe("2026-12");
  });
});

describe("la revision de cada movimiento", () => {
  const contexto = (cambios: Partial<ContextoDeRevision> = {}): ContextoDeRevision => ({
    reglas: [{ clave: "lider", etiqueta: "Líder", categoriaId: "super" }],
    gastos: [],
    categoriasActivas: new Set(["super", "luz"]),
    pendientes: [],
    diaInicioMes: 1,
    ...cambios,
  });
  const compra = (cambios: Partial<DatosDeMovimiento> = {}) => ({ ...deLectura(lectura(), []), ...cambios });

  test("con su regla y sin preguntas, queda lista para confirmar con las demas", () => {
    const revision = revisar(compra(), contexto());
    expect(revision).toMatchObject({
      propuesta: { como: "gasto" },
      categoria: { categoriaId: "super", porque: "regla" },
      clave: { clave: "lider" },
      lista: true,
      avisos: [],
    });
  });

  test("sin categoria no esta lista: hay que elegirla", () => {
    expect(revisar(compra({ comercio: "UBER *TRIP" }), contexto()).lista).toBe(false);
  });

  test("lo leido con IA, en dolares o sin detalle se mira uno por uno", () => {
    const ia = revisar(compra({ plantilla: null }), contexto());
    expect(ia).toMatchObject({ lista: false, avisos: ["ia"] });
    expect(revisar(compra({ moneda: "USD" }), contexto()).avisos).toEqual(["dolares"]);
    expect(revisar(compra({ sinDetalle: true }), contexto()).avisos).toEqual(["sin-detalle"]);
  });

  test("reenviado a mano se avisa, pero sigue lista", () => {
    expect(revisar(compra({ reenviadoAMano: true }), contexto())).toMatchObject({ lista: true, avisos: ["reenviado-a-mano"] });
  });

  test("lo que Luka habia dejado fuera y se volvio a la bandeja lo dice", () => {
    expect(revisar(compra({ tipo: "TRASPASO_PROPIO" }), contexto()).avisos).toContain("estaba-fuera");
  });

  test("una compra en cuotas va como deuda, antes que todo", () => {
    const gastoIgual: GastoParaComparar = {
      id: "g", fecha: "2026-11-15", descripcion: "Paris", monto: 23_480, categoriaId: "super", pagoDe: null, fuentes: [],
    };
    const revision = revisar(compra({ cuotas: 3 }), contexto({ gastos: [gastoIgual] }));
    expect(revision.propuesta).toMatchObject({ como: "deuda", deuda: { cuotas: 3, montoCuota: 7_827, primeraCuota: "2026-12" } });
    expect(revision.lista).toBe(false);
  });

  test("si ya hay un gasto igual, se pregunta si es el mismo antes de proponer pagar una cuenta", () => {
    const gastoIgual: GastoParaComparar = {
      id: "g", fecha: "2026-11-14", descripcion: "Feria", monto: 23_480, categoriaId: "super", pagoDe: null, fuentes: [],
    };
    const cuenta = { id: "c", nombre: "Feria", monto: 23_480, mes: "2026-11" };
    const revision = revisar(compra(), contexto({ gastos: [gastoIgual], pendientes: [{ cuentas: [cuenta], cuotas: [] }] }));
    expect(revision.propuesta).toEqual({ como: "mismo-gasto", gasto: gastoIgual });
    expect(revision.lista).toBe(false);
  });

  test("si calza con una cuenta por pagar, se propone pagarla", async () => {
    const pago = deLectura(await leer("santander/pago-de-cuenta.txt"), []);
    const luz = { id: "luz", nombre: "Luz", monto: 48_350, mes: "2026-11" };
    const revision = revisar(pago, contexto({ pendientes: [{ cuentas: [luz], cuotas: [] }] }));
    expect(revision.propuesta).toEqual({ como: "pago-de-cuenta", cuenta: luz });
    expect(revision.lista).toBe(false);
  });

  test("primero lo de su mes; si ahi no calza nada, lo del mes anterior (una cuenta pagada tarde)", async () => {
    const pago = deLectura(await leer("santander/pago-de-cuenta.txt"), []);
    const deNoviembre = { id: "nov", nombre: "Luz", monto: 48_350, mes: "2026-11" };
    const deOctubre = { id: "oct", nombre: "Luz", monto: 48_350, mes: "2026-10" };
    const sinNada = { cuentas: [], cuotas: [] };
    expect(
      revisar(pago, contexto({ pendientes: [{ cuentas: [deNoviembre], cuotas: [] }, { cuentas: [deOctubre], cuotas: [] }] })).propuesta,
    ).toEqual({ como: "pago-de-cuenta", cuenta: deNoviembre });
    expect(revisar(pago, contexto({ pendientes: [sinNada, { cuentas: [deOctubre], cuotas: [] }] })).propuesta).toEqual({
      como: "pago-de-cuenta",
      cuenta: deOctubre,
    });
  });

  test("y una cuota por pagar, igual", () => {
    const cuota = { deudaId: "d", nombre: "Crédito", mes: "2026-11", numero: 2, de: 6, monto: 23_480 };
    expect(revisar(compra({ tipo: "TRANSFERENCIA" }), contexto({ pendientes: [{ cuentas: [], cuotas: [cuota] }] })).propuesta).toEqual({
      como: "pago-de-cuota",
      cuota,
    });
  });
});
