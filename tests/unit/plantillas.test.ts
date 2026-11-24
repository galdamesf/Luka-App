import { describe, expect, test } from "vitest";
import { crearLector } from "@/dominio/comprobantes/lector";
import { normalizarComprobante } from "@/dominio/comprobantes/normalizar";
import type { Comprobante, Lectura, LecturaLeida } from "@/dominio/comprobantes/tipos";
import {
  PLANTILLAS,
  calzaRemitente,
  leerConPlantillas,
  type Plantilla,
  type PlantillaDeLectura,
} from "@/dominio/plantillas";
import { cargarEjemplo } from "../fixtures/comprobantes/cargar";

/** Sin IA: aqui se prueba solo lo que leen las plantillas. */
const leer = crearLector();

const TRANSFERENCIA_ENVIADA: LecturaLeida = {
  ok: true,
  tipo: "TRANSFERENCIA",
  sentido: "gasto",
  monto: 245_000,
  moneda: "CLP",
  fecha: "2026-11-18",
  comercio: "Pedro Muñoz Lagos",
  fuente: "Comprobante de Santander",
  via: "plantilla",
  plantilla: "santander/transferencia-enviada",
  medioPago: "TRANSFERENCIA",
  ultimos4: "5678",
  contraparte: { nombre: "Pedro Muñoz Lagos", banco: "Banco de Chile", ultimos4: "7890" },
};

const TRANSFERENCIA_DE_BANCOESTADO: LecturaLeida = {
  ok: true,
  tipo: "ABONO",
  sentido: "ingreso",
  monto: 175_500,
  moneda: "CLP",
  fecha: "2026-11-12",
  comercio: "COMERCIAL EL MAITEN LTDA.",
  fuente: "Aviso de BancoEstado",
  via: "plantilla",
  plantilla: "bancoestado/transferencia-recibida",
  medioPago: "TRANSFERENCIA",
  ultimos4: "5678",
  contraparte: { nombre: "COMERCIAL EL MAITEN LTDA." },
};

const TRANSFERENCIA_DESDE_CONSORCIO: LecturaLeida = {
  ok: true,
  tipo: "TRANSFERENCIA",
  sentido: "gasto",
  monto: 85_000,
  moneda: "CLP",
  fecha: "2026-11-16",
  comercio: "Pedro Muñoz Lagos",
  fuente: "Comprobante de Consorcio",
  via: "plantilla",
  plantilla: "consorcio/transferencia-enviada",
  medioPago: "TRANSFERENCIA",
  ultimos4: "2345",
  contraparte: { nombre: "Pedro Muñoz Lagos", banco: "BANCO ITAU", ultimos4: "8765" },
};

const CARGO_DE_CONSORCIO: LecturaLeida = {
  ok: true,
  tipo: "CARGO",
  sentido: "gasto",
  monto: 85_000,
  moneda: "CLP",
  fecha: "2026-11-16",
  comercio: "Cargo en cuenta Consorcio",
  fuente: "Aviso de cargo de Consorcio",
  via: "plantilla",
  plantilla: "consorcio/cargo",
  ultimos4: "2345",
  sinDetalle: true,
};

const BOLETA_DE_BSALE: LecturaLeida = {
  ok: true,
  tipo: "BOLETA",
  sentido: "gasto",
  monto: 23_990,
  moneda: "CLP",
  fecha: "2026-11-09",
  comercio: "COMERCIAL LOS AROMOS SPA",
  fuente: "Boleta electrónica (Bsale)",
  via: "plantilla",
  plantilla: "bsale/boleta",
};

describe("cada formato real, con datos inventados, se lee exacto", () => {
  const casos: [ruta: string, esperada: Lectura][] = [
    ["santander/transferencia-enviada.txt", TRANSFERENCIA_ENVIADA],
    [
      "santander/transferencia-recibida.txt",
      {
        ok: true,
        tipo: "ABONO",
        sentido: "ingreso",
        monto: 850_000,
        moneda: "CLP",
        fecha: "2026-11-14",
        comercio: "SERVICIOS DIGITALES ANDES SPA",
        fuente: "Aviso de Santander",
        via: "plantilla",
        plantilla: "santander/transferencia-recibida",
        medioPago: "TRANSFERENCIA",
        ultimos4: "5678",
        contraparte: { nombre: "SERVICIOS DIGITALES ANDES SPA", banco: "BANCO DE CREDITO E INVERSIONES" },
      },
    ],
    [
      "santander/pago-de-cuenta.txt",
      {
        ok: true,
        tipo: "PAGO",
        sentido: "gasto",
        monto: 48_350,
        moneda: "CLP",
        fecha: "2026-11-05",
        comercio: "ENEL DISTRIBUCION",
        fuente: "Botón de Pago de Santander",
        via: "plantilla",
        plantilla: "santander/pago-de-cuenta",
        ultimos4: "5678",
      },
    ],
    ["consorcio/transferencia-enviada.txt", TRANSFERENCIA_DESDE_CONSORCIO],
    [
      "consorcio/transferencia-recibida.txt",
      {
        ok: true,
        tipo: "ABONO",
        sentido: "ingreso",
        monto: 15_000,
        moneda: "CLP",
        fecha: "2026-11-10",
        comercio: "ANA DIAZ PEREZ",
        fuente: "Comprobante de Consorcio",
        via: "plantilla",
        plantilla: "consorcio/transferencia-recibida",
        medioPago: "TRANSFERENCIA",
        ultimos4: "5678",
        contraparte: { nombre: "ANA DIAZ PEREZ", banco: "BANCO CONSORCIO", ultimos4: "4321" },
      },
    ],
    [
      "consorcio/abono.txt",
      {
        ok: true,
        tipo: "ABONO",
        sentido: "ingreso",
        monto: 32_500,
        moneda: "CLP",
        fecha: "2026-11-18",
        comercio: "Abono en cuenta Consorcio",
        fuente: "Aviso de abono de Consorcio",
        via: "plantilla",
        plantilla: "consorcio/abono",
        ultimos4: "2345",
        sinDetalle: true,
      },
    ],
    ["consorcio/cargo.txt", CARGO_DE_CONSORCIO],
    ["bancoestado/transferencia-recibida.txt", TRANSFERENCIA_DE_BANCOESTADO],
    [
      "lider/boleta-digital.txt",
      {
        ok: true,
        tipo: "BOLETA",
        sentido: "gasto",
        monto: 6_170,
        moneda: "CLP",
        fecha: "2026-11-15",
        comercio: "Líder",
        fuente: "Boleta digital de Líder",
        via: "plantilla",
        plantilla: "lider/boleta-digital",
        medioPago: "CREDITO",
        ultimos4: "4821",
      },
    ],
    ["bsale/boleta.txt", BOLETA_DE_BSALE],
  ];

  test.each(casos)("%s", async (ruta, esperada) => {
    expect(await leer(cargarEjemplo(ruta))).toStrictEqual(esperada);
  });
});

describe("los mismos comprobantes reenviados a mano se leen igual, marcados", () => {
  test.each([
    ["reenvios/santander-desde-outlook.txt", TRANSFERENCIA_ENVIADA],
    ["reenvios/bancoestado-citado.txt", TRANSFERENCIA_DE_BANCOESTADO],
    ["reenvios/bsale-desde-gmail.txt", BOLETA_DE_BSALE],
  ] as const)("%s", async (ruta, esperada) => {
    expect(await leer(cargarEjemplo(ruta))).toStrictEqual({ ...esperada, reenviadoAMano: true });
  });
});

describe("lo que no es un gasto se descarta sin gastar IA", () => {
  test.each([
    ["santander/cartola.txt", "es-cartola", "La cartola del mes: se lee aparte, con su clave."],
    ["santander/publicidad.txt", "no-es-comprobante", "Publicidad de Santander."],
    ["santander/clave-digital.txt", "no-es-comprobante", "Aviso de seguridad o de la app, sin movimientos."],
    ["lider/pedido-recibido.txt", "no-es-comprobante", "Estado del pedido: el gasto llega con la boleta."],
    ["consorcio/cartola.txt", "es-cartola", "La cartola del mes: se lee aparte, con su clave."],
    ["consorcio/publicidad.txt", "no-es-comprobante", "Publicidad de Consorcio."],
    ["consorcio/clave-tu-pass.txt", "no-es-comprobante", "Aviso de seguridad o de la cuenta, sin movimientos."],
  ] as const)("%s", async (ruta, motivo, detalle) => {
    expect(await leer(cargarEjemplo(ruta))).toStrictEqual({ ok: false, motivo, detalle });
  });
});

describe("Consorcio avisa el cargo y ademas manda el comprobante de la transferencia", () => {
  test("los dos se leen, con el mismo monto, dia y cuenta, y el aviso queda marcado sin detalle", async () => {
    const cargo = await leer(cargarEjemplo("consorcio/cargo.txt"));
    const transferencia = await leer(cargarEjemplo("consorcio/transferencia-enviada.txt"));
    expect(cargo).toMatchObject({ ok: true, sinDetalle: true });
    expect(transferencia).not.toHaveProperty("sinDetalle");
    // Con esto las reglas de los movimientos los juntan en uno solo.
    for (const campo of ["monto", "fecha", "ultimos4"] as const) {
      expect(cargo.ok && transferencia.ok && cargo[campo] === transferencia[campo], campo).toBe(true);
    }
  });

  test("el asunto de los avisos llega con la o rota, y se reconocen igual", () => {
    expect(cargarEjemplo("consorcio/cargo.txt").asunto).toContain("�");
  });
});

describe("cuando el correo no trae lo que la plantilla espera, no se inventa nada", () => {
  test("la boleta de Lider sin el texto del PDF no tiene monto ni fecha", async () => {
    const boleta = cargarEjemplo("lider/boleta-digital.txt");
    const sinTexto: Comprobante = { ...boleta, adjuntos: [{ nombre: "boleta.pdf", tipo: "application/pdf" }] };
    expect(await leer(sinTexto)).toStrictEqual({
      ok: false,
      motivo: "no-se-pudo-leer",
      detalle: "La plantilla lider/boleta-digital no encontró: monto, fecha.",
    });
  });

  test("un correo que imita a Bsale desde otro dominio no usa la plantilla de Bsale", async () => {
    const boleta = cargarEjemplo("bsale/boleta.txt");
    const falso = { ...boleta, remitente: "notificaciones@bsale-pagos.com" };
    expect(leerConPlantillas(normalizarComprobante(falso), PLANTILLAS)).toEqual({ estado: "sin-plantilla" });
  });
});

describe("el motor de plantillas", () => {
  test("los remitentes: exactos, o un dominio con sus subdominios, y nada que solo se parezca", () => {
    expect(calzaRemitente("MensajeriA@Santander.CL", ["mensajeria@santander.cl"])).toBe(true);
    expect(calzaRemitente("otra@santander.cl", ["mensajeria@santander.cl"])).toBe(false);
    expect(calzaRemitente("contacto@info.lider.cl", ["@lider.cl"])).toBe(true);
    expect(calzaRemitente("x@lider.cl", ["@lider.cl"])).toBe(true);
    expect(calzaRemitente("x@falsolider.cl", ["@lider.cl"])).toBe(false);
    expect(calzaRemitente("x@lider.cl.ejemplo.com", ["@lider.cl"])).toBe(false);
    expect(calzaRemitente("sin-arroba", ["@lider.cl"])).toBe(false);
  });

  const base: Comprobante = {
    remitente: "avisos@tienda-ejemplo.cl",
    reenviadoPor: "camila@ejemplo.cl",
    asunto: "Tu compra",
    // A las 23:30 del 20 en Chile; en UTC ya es el 21.
    recibido: new Date("2026-11-21T02:30:00Z"),
    texto: "Compra aprobada. TOTAL 1.000 ... TOTAL 2.000",
  };
  const lectora = (cambios: Partial<PlantillaDeLectura["campos"]> = {}): Plantilla => ({
    id: "prueba/compra",
    remitentes: ["@tienda-ejemplo.cl"],
    fuente: "Prueba",
    tipo: "COMPRA",
    sentido: "gasto",
    campos: { monto: { patron: /TOTAL\s+([\d.]+)/ }, comercio: { fijo: "Tienda" }, ...cambios },
  });

  test("la primera plantilla que calza decide", () => {
    const descarta: Plantilla = {
      id: "prueba/descarte",
      remitentes: ["@tienda-ejemplo.cl"],
      descartar: "no-es-comprobante",
      porque: "Prueba.",
    };
    const n = normalizarComprobante(base);
    expect(leerConPlantillas(n, [descarta, lectora()])).toMatchObject({ estado: "descartado", plantilla: "prueba/descarte" });
    expect(leerConPlantillas(n, [lectora(), descarta])).toMatchObject({ estado: "leido" });
  });

  test("sin campo de fecha, vale el dia en Chile en que llego el correo", () => {
    const resultado = leerConPlantillas(normalizarComprobante(base), [lectora()]);
    expect(resultado).toMatchObject({ estado: "leido", lectura: { fecha: "2026-11-20", monto: 1_000 } });
  });

  test("con campo de fecha, si no aparece es porque falta", () => {
    const resultado = leerConPlantillas(normalizarComprobante(base), [lectora({ fecha: { patron: /Fecha:\s*(\S+)/ } })]);
    expect(resultado).toEqual({ estado: "incompleto", plantilla: "prueba/compra", faltan: ["fecha"] });
  });

  test("«ultima» toma la ultima coincidencia, y se puede usar dos veces seguidas", () => {
    const plantilla = lectora({ monto: { patron: /TOTAL\s+([\d.]+)/, ultima: true } });
    const n = normalizarComprobante(base);
    expect(leerConPlantillas(n, [plantilla])).toMatchObject({ lectura: { monto: 2_000 } });
    expect(leerConPlantillas(n, [plantilla])).toMatchObject({ lectura: { monto: 2_000 } });
  });

  test("las plantillas escritas: ids unicos, con remitente, y ningun patron con g o y", () => {
    const ids = PLANTILLAS.map((plantilla) => plantilla.id);
    expect(new Set(ids).size).toBe(ids.length);

    const patrones: RegExp[] = [];
    const juntar = (valor: unknown): void => {
      if (valor instanceof RegExp) patrones.push(valor);
      else if (valor && typeof valor === "object") Object.values(valor).forEach(juntar);
    };
    for (const plantilla of PLANTILLAS) {
      expect(plantilla.id, plantilla.id).toMatch(/^[a-z]+\/[a-z-]+$/);
      expect(plantilla.remitentes.length, plantilla.id).toBeGreaterThan(0);
      juntar(plantilla);
    }
    expect(patrones.length).toBeGreaterThan(20);
    for (const patron of patrones) expect(patron.flags, patron.source).not.toMatch(/[gy]/);
  });
});
