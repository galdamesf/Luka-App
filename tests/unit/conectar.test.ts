import { describe, expect, test } from "vitest";
import { crearLector } from "@/dominio/comprobantes/lector";
import type { LecturaLeida } from "@/dominio/comprobantes/tipos";
import {
  BANCOS,
  bancosDelHogar,
  cuentaQueSeAprende,
  cuentaDelMovimiento,
  nombreDeLaCuenta,
  remitentesParaLaRegla,
  TIPOS_QUE_SE_OFRECEN,
} from "@/dominio/bancos";
import {
  armarResumenDiario,
  enlaceDeGmail,
  enlaceParaCrearElFiltro,
  pasoParaConectar,
  pruebaQueLlega,
  textoDelFiltro,
  type DatosDelResumen,
} from "@/dominio/conectar";
import { revisionAutomatica, traeElSecreto, urlDeLuka } from "@/lib/automatico";
import { cargarEjemplo } from "../fixtures/comprobantes/cargar";

/*
  Conectar los correos (seccion E). Lo que tiene que cumplirse siempre:

    - Una persona nueva no escribe ningun numero de cuenta: Luka reconoce
      sus cuentas y tarjetas con los avisos, y solo cuando no hay dudas.
    - El filtro de su correo trae a todos sus bancos, aunque Luka todavia no
      tenga sus plantillas.
    - El resumen diario no se manda si no hay nada que contar.
*/

const leer = crearLector();

async function lecturaDe(ruta: string): Promise<LecturaLeida> {
  const lectura = await leer(cargarEjemplo(ruta));
  if (!lectura.ok) throw new Error(`No se leyo ${ruta}: ${lectura.motivo}`);
  return lectura;
}

describe("en que paso va el asistente", () => {
  const nada = { bancos: [], conCuentas: false, codigoDeGmail: null, yaLlegoAlgo: false };

  test("parte por los bancos", () => {
    expect(pasoParaConectar(nada, "GMAIL")).toBe("bancos");
    expect(pasoParaConectar(nada, "OUTLOOK")).toBe("bancos");
  });

  test("con los bancos marcados (o con cuentas suyas) sigue en Gmail, o en la regla de otro correo", () => {
    expect(pasoParaConectar({ ...nada, bancos: ["Santander"] }, "GMAIL")).toBe("reenvio");
    expect(pasoParaConectar({ ...nada, conCuentas: true }, "GMAIL")).toBe("reenvio");
    expect(pasoParaConectar({ ...nada, bancos: ["Santander"] }, "ICLOUD")).toBe("filtro");
  });

  test("si Gmail ya mando su codigo, vuelve al reenvio para escribirlo", () => {
    expect(pasoParaConectar({ ...nada, codigoDeGmail: "123456789" }, "GMAIL")).toBe("reenvio");
  });

  test("esta listo apenas llega algo reenviado de verdad", () => {
    expect(pasoParaConectar({ ...nada, codigoDeGmail: "123456789", yaLlegoAlgo: true }, "GMAIL")).toBe("listo");
    expect(pruebaQueLlega("NUEVO")).toBe(true);
    expect(pruebaQueLlega("NO_ES_COMPROBANTE")).toBe(true);
    expect(pruebaQueLlega("CARTOLA_SIN_CLAVE")).toBe(true);
    // Esto no prueba que el filtro funcione.
    expect(pruebaQueLlega("CONFIRMACION_DE_GMAIL")).toBe(false);
    expect(pruebaQueLlega("REENVIO_CONFIRMADO")).toBe(false);
    expect(pruebaQueLlega("SIN_CONFIRMAR")).toBe(false);
    expect(pruebaQueLlega("SIN_FIRMA")).toBe(false);
  });
});

describe("los botones de Gmail", () => {
  test("abren la pantalla del reenvio y la de los filtros, en la cuenta de ese correo", () => {
    expect(enlaceDeGmail("reenvio", " Camila.Rojas@Gmail.com ")).toBe(
      "https://mail.google.com/mail/?authuser=camila.rojas%40gmail.com#settings/fwdandpop",
    );
    expect(enlaceDeGmail("filtros", "camila@gmail.com")).toBe("https://mail.google.com/mail/?authuser=camila%40gmail.com#settings/filters");
  });

  test("el filtro se abre ya empezado, con los remitentes en «De»", () => {
    expect(enlaceParaCrearElFiltro(" Camila@Gmail.com ", ["mensajeria@santander.cl", "bci.cl"])).toBe(
      "https://mail.google.com/mail/?authuser=camila%40gmail.com#create-filter/from=mensajeria%40santander.cl+OR+bci.cl",
    );
  });

  test("el campo «De» va con OR en Gmail, y uno por linea en los demas", () => {
    const remitentes = ["mensajeria@santander.cl", "bci.cl"];
    expect(textoDelFiltro(remitentes, "GMAIL")).toBe("mensajeria@santander.cl OR bci.cl");
    expect(textoDelFiltro(remitentes, "OUTLOOK")).toBe("mensajeria@santander.cl\nbci.cl");
  });
});

describe("el filtro trae a todos los bancos", () => {
  test("de un banco sin plantillas van sus dominios, para que sus avisos lleguen y los lea la IA", () => {
    const remitentes = remitentesParaLaRegla(["BCI", "Banco de Chile"], []);
    expect(remitentes).toContain("bci.cl");
    expect(remitentes).toContain("bancochile.cl");
    // Y siempre las tiendas que Luka sabe leer.
    expect(remitentes.some((r) => r.includes("lider"))).toBe(true);
  });

  test("de un banco con plantillas, sus remitentes exactos y no todo su dominio", () => {
    const remitentes = remitentesParaLaRegla(["Santander"], []);
    expect(remitentes).toContain("mensajeria@santander.cl");
    expect(remitentes).not.toContain("santander.cl");
  });

  test("un remitente que ya toma el dominio no se repite", () => {
    const remitentes = remitentesParaLaRegla(["BCI"], [{ banco: "BCI", remitente: "Avisos@BCI.cl" }, { banco: "BCI", remitente: "otro@ejemplo.cl" }]);
    expect(remitentes.filter((r) => r.includes("bci.cl"))).toEqual(["bci.cl"]);
    expect(remitentes).toContain("otro@ejemplo.cl");
  });

  test("cada banco del catalogo tiene desde donde escribe", () => {
    for (const banco of BANCOS) expect(banco.dominios.length, banco.nombre).toBeGreaterThan(0);
  });

  test("un banco marcado sale en «Tus bancos» aunque todavia no tenga cuentas", () => {
    const cuenta = { id: "c1", banco: "Santander", tipo: "CUENTA" as const, ultimos4: "5678", miembroId: "m1", apodo: null };
    const grupos = bancosDelHogar([cuenta], [], ["BCI", "Banco Santander"]);
    expect(grupos.map((g) => [g.banco, g.cuentas.length])).toEqual([
      ["Santander", 1],
      ["BCI", 0],
    ]);
    expect(grupos[1]!.remitentes).toEqual(["bci.cl"]);
  });
});

describe("las cuentas que Luka reconoce sola", () => {
  test("del comprobante de una transferencia de Santander: su cuenta, sin saber de que tipo", async () => {
    const lectura = await lecturaDe("santander/transferencia-enviada.txt");
    expect(cuentaQueSeAprende(lectura, "Santander", [])).toEqual({ banco: "Santander", tipo: "CUENTA", ultimos4: "5678" });
  });

  test("de un cargo de Consorcio, tambien", async () => {
    const lectura = await lecturaDe("consorcio/cargo.txt");
    expect(cuentaQueSeAprende(lectura, "Consorcio", [])).toMatchObject({ banco: "Consorcio", tipo: "CUENTA" });
  });

  test("no del aviso de BancoEstado a quien recibe: esa cuenta es de otro banco", async () => {
    const lectura = await lecturaDe("bancoestado/transferencia-recibida.txt");
    expect(lectura.ultimos4).toBe("5678");
    expect(cuentaQueSeAprende(lectura, "BancoEstado", [])).toBeNull();
  });

  test("no si la leyo la IA, ni si no se sabe el banco, ni sin sus 4 digitos", async () => {
    const lectura = await lecturaDe("santander/transferencia-enviada.txt");
    expect(cuentaQueSeAprende({ ...lectura, via: "ia" }, "Santander", [])).toBeNull();
    expect(cuentaQueSeAprende(lectura, null, [])).toBeNull();
    expect(cuentaQueSeAprende({ ...lectura, ultimos4: undefined }, "Santander", [])).toBeNull();
    expect(cuentaQueSeAprende({ ...lectura, plantilla: "santander/no-existe" }, "Santander", [])).toBeNull();
  });

  test("no si el hogar ya tiene una de ese banco con esos 4 digitos, aunque sea de otro tipo", async () => {
    const lectura = await lecturaDe("santander/transferencia-enviada.txt");
    expect(cuentaQueSeAprende(lectura, "Santander", [{ banco: "Banco Santander", ultimos4: "5678" }])).toBeNull();
    // La misma terminacion en otro banco es otra cuenta.
    expect(cuentaQueSeAprende(lectura, "Santander", [{ banco: "BCI", ultimos4: "5678" }])).not.toBeNull();
  });

  test("una compra con credito es de una tarjeta de credito, y una con debito, de una de debito", async () => {
    const base = await lecturaDe("santander/transferencia-enviada.txt");
    const compra = { ...base, tipo: "COMPRA" as const };
    expect(cuentaQueSeAprende({ ...compra, medioPago: "CREDITO" }, "Santander", [])?.tipo).toBe("TARJETA_CREDITO");
    expect(cuentaQueSeAprende({ ...compra, medioPago: "DEBITO" }, "Santander", [])?.tipo).toBe("TARJETA_DEBITO");
  });

  test("«Cuenta» se muestra asi, no se ofrece al agregar una a mano, y recibe transferencias", () => {
    expect(nombreDeLaCuenta({ apodo: null, tipo: "CUENTA", ultimos4: "5678" })).toBe("Cuenta •••• 5678");
    expect(TIPOS_QUE_SE_OFRECEN).not.toContain("CUENTA");
    const cuentas = [{ id: "c1", banco: "Santander", tipo: "CUENTA" as const, ultimos4: "5678", miembroId: null }];
    expect(cuentaDelMovimiento({ tipo: "TRANSFERENCIA", medioPago: "TRANSFERENCIA", ultimos4: "5678" }, "Santander", cuentas, null)).toBe("c1");
  });
});

describe("el resumen diario por correo", () => {
  const datos: DatosDelResumen = {
    nombre: "Camila",
    ayer: "2026-11-23",
    gastosDeAyer: [],
    totalDelMes: 430_130,
    nombreDelMes: "noviembre",
    porRevisar: 0,
    cuentasPorVencer: [],
    url: "https://lukaapp.cl",
  };

  test("sin nada que contar, no se manda", () => {
    expect(armarResumenDiario(datos)).toBeNull();
  });

  test("cuenta lo de ayer, el mes, lo que espera y lo que vence, con el enlace a Luka", () => {
    const correo = armarResumenDiario({
      ...datos,
      gastosDeAyer: [
        { descripcion: "Líder", monto: 17_500 },
        { descripcion: "Pan", monto: 1_200 },
      ],
      porRevisar: 3,
      cuentasPorVencer: [{ nombre: "Luz", monto: 32_000, venceHoy: true }],
    })!;
    expect(correo.asunto).toBe("Ayer: $18.700 · 3 por revisar · 1 cuenta por vencer");
    expect(correo.texto).toContain("Hola, Camila:");
    expect(correo.texto).toContain("El lunes 23 se anotaron $18.700 en 2 gastos:");
    expect(correo.texto).toContain("  - Líder: $17.500");
    expect(correo.texto).toContain("En noviembre van $430.130.");
    expect(correo.texto).toContain("Te esperan 3 movimientos en «Por revisar»");
    expect(correo.texto).toContain("  - Luz: $32.000, vence hoy");
    expect(correo.texto).toContain("Ver en Luka: https://lukaapp.cl");
    expect(correo.html).toContain('href="https://lukaapp.cl"');
  });

  test("nombra los cinco gastos mas grandes y dice cuantos mas hubo", () => {
    const gastosDeAyer = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ descripcion: `Gasto ${n}`, monto: n * 1_000 }));
    const correo = armarResumenDiario({ ...datos, gastosDeAyer })!;
    expect(correo.texto).toContain("  - Gasto 7: $7.000");
    expect(correo.texto).not.toContain("Gasto 2:");
    expect(correo.texto).toContain("  - y 2 más.");
  });

  test("lo que escribio alguien no se cuela como HTML", () => {
    const correo = armarResumenDiario({ ...datos, gastosDeAyer: [{ descripcion: '<img src=x onerror="alert(1)">', monto: 1_000 }] })!;
    expect(correo.html).not.toContain("<img");
    expect(correo.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("con una sola cosa que contar, en singular y sin nombre", () => {
    const correo = armarResumenDiario({ ...datos, nombre: null, porRevisar: 1 })!;
    expect(correo.asunto).toBe("1 por revisar");
    expect(correo.texto.startsWith("Hola:")).toBe(true);
    expect(correo.texto).toContain("Te espera 1 movimiento en «Por revisar»");
  });
});

describe("lo que Luka hace sola", () => {
  test("revisa el buzon sola en la version publicada, y en tu computador solo si se lo pides", () => {
    expect(revisionAutomatica({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(true);
    expect(revisionAutomatica({})).toBe(false);
    expect(revisionAutomatica({ BUZON_AUTOMATICO: "1" })).toBe(true);
    expect(revisionAutomatica({ BUZON_AUTOMATICO: "si" })).toBe(true);
    expect(revisionAutomatica({ VERCEL: "1", VERCEL_ENV: "production", BUZON_AUTOMATICO: "0" })).toBe(false);
  });

  test("una vista previa de Vercel no revisa el buzon sola: se llevaria los correos de la version publicada", () => {
    expect(revisionAutomatica({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
    expect(revisionAutomatica({ VERCEL: "1" })).toBe(false);
    expect(revisionAutomatica({ VERCEL: "1", VERCEL_ENV: "preview", BUZON_AUTOMATICO: "1" })).toBe(true);
  });

  test("los enlaces de los correos van a LUKA_URL, o al dominio de Vercel, o a localhost", () => {
    expect(urlDeLuka({ LUKA_URL: "https://lukaapp.cl/" })).toBe("https://lukaapp.cl");
    expect(urlDeLuka({ VERCEL_PROJECT_PRODUCTION_URL: "lukaapp.cl" })).toBe("https://lukaapp.cl");
    expect(urlDeLuka({})).toBe("http://localhost:3000");
  });

  test("la tarea programada pasa solo con el secreto, y sin CRON_SECRET no pasa nadie", () => {
    const entorno = { CRON_SECRET: "s3cr3to-largo" };
    expect(traeElSecreto("Bearer s3cr3to-largo", entorno)).toBe(true);
    expect(traeElSecreto("Bearer otro", entorno)).toBe(false);
    expect(traeElSecreto("s3cr3to-largo", entorno)).toBe(false);
    expect(traeElSecreto(null, entorno)).toBe(false);
    expect(traeElSecreto("Bearer ", {})).toBe(false);
    expect(traeElSecreto("Bearer undefined", {})).toBe(false);
  });
});
