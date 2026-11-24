import { describe, expect, test, vi } from "vitest";
import { crearLector, pareceCartola, traeMontos } from "@/dominio/comprobantes/lector";
import { limpiarDatosPersonales } from "@/dominio/comprobantes/limpiar-datos-personales";
import {
  aplanar,
  decodificarEntidades,
  desenvolverReenvio,
  direccionDe,
  htmlATexto,
  limpiarAsunto,
  normalizarComprobante,
  normalizarTexto,
  sinCitas,
} from "@/dominio/comprobantes/normalizar";
import type { Comprobante, LecturaLeida } from "@/dominio/comprobantes/tipos";
import {
  fechaEnChile,
  leerFecha,
  leerMedioPago,
  leerMonto,
  pulirComercio,
  ultimosCuatro,
} from "@/dominio/comprobantes/valores";
import { cargarEjemplo } from "../fixtures/comprobantes/cargar";

/** Un comprobante armado a mano, para los casos que no necesitan un ejemplo entero. */
function comprobante(parcial: Partial<Comprobante> & Pick<Comprobante, "remitente" | "texto">): Comprobante {
  return {
    reenviadoPor: "camila@ejemplo.cl",
    asunto: "",
    recibido: new Date("2026-11-20T15:00:00Z"),
    ...parcial,
  };
}

describe("leerMonto: los montos como se escriben en Chile", () => {
  test("pesos con punto de miles, con o sin espacio despues del signo", () => {
    expect(leerMonto("$ 300.000")).toEqual({ monto: 300_000, moneda: "CLP" });
    expect(leerMonto("$152.604")).toEqual({ monto: 152_604, moneda: "CLP" });
    expect(leerMonto("$ 1.200.000")).toEqual({ monto: 1_200_000, moneda: "CLP" });
    expect(leerMonto("45990")).toEqual({ monto: 45_990, moneda: "CLP" });
    expect(leerMonto("Total: $34.990.-")).toEqual({ monto: 34_990, moneda: "CLP" });
  });

  test("Bsale escribe un decimal: $ 14.900,0 son 14900 pesos", () => {
    expect(leerMonto("$ 14.900,0")).toEqual({ monto: 14_900, moneda: "CLP" });
    expect(leerMonto("1.234,5")).toEqual({ monto: 1_235, moneda: "CLP" });
  });

  test("en dolares, centavos, escritos a la chilena o a la gringa", () => {
    expect(leerMonto("US$ 12,99")).toEqual({ monto: 1_299, moneda: "USD" });
    expect(leerMonto("USD 1,234.56")).toEqual({ monto: 123_456, moneda: "USD" });
    expect(leerMonto("12.99", "USD")).toEqual({ monto: 1_299, moneda: "USD" });
  });

  test("lo que no es un monto, el cero y lo que no cabe en la columna no se leen", () => {
    for (const malo of ["", "abc", "$ 0", "$ 3.000.000.000", "1.2.3"]) {
      expect(leerMonto(malo), malo).toBeNull();
    }
  });
});

describe("leerFecha: con el dia primero, como en Chile", () => {
  test("con numeros", () => {
    expect(leerFecha("20/11/2026")).toBe("2026-11-20");
    expect(leerFecha("16-10-2026")).toBe("2026-10-16");
    expect(leerFecha("29.10.26 15:53")).toBe("2026-10-29");
    expect(leerFecha("2026-11-20")).toBe("2026-11-20");
    expect(leerFecha("Fecha: 15/11/2026 Hora: 18:22:10")).toBe("2026-11-15");
  });

  test("con el mes en palabras, en espanol y como lo escribe Gmail en ingles", () => {
    expect(leerFecha("18 de noviembre de 2026")).toBe("2026-11-18");
    expect(leerFecha("martes, 18 de noviembre de 2026 20:41")).toBe("2026-11-18");
    expect(leerFecha("dom, 9 nov 2026, 16:05")).toBe("2026-11-09");
    expect(leerFecha("1 sept 2026")).toBe("2026-09-01");
    expect(leerFecha("Thu, Nov 20, 2026 at 8:41 PM")).toBe("2026-11-20");
    expect(leerFecha("November 12, 2026 at 10:05:12 AM GMT-3")).toBe("2026-11-12");
  });

  test("una fecha que no existe no es una fecha", () => {
    for (const mala of ["31/02/2026", "13/13/2026", "32 de enero de 2026", "sin fecha", "15/11/1999"]) {
      expect(leerFecha(mala), mala).toBeNull();
    }
  });

  test("el dia en Chile y no en UTC: a las 23:30 del 20 en Chile, en UTC ya es 21", () => {
    // Noviembre es horario de verano (UTC-3); julio, de invierno (UTC-4).
    expect(fechaEnChile(new Date("2026-11-21T02:30:00Z"))).toBe("2026-11-20");
    expect(fechaEnChile(new Date("2026-07-01T03:30:00Z"))).toBe("2026-06-30");
  });
});

describe("cuentas, medios de pago y comercios", () => {
  test("de una cuenta o tarjeta quedan solo los ultimos 4", () => {
    expect(ultimosCuatro("0-000-12-34567-8")).toBe("5678");
    expect(ultimosCuatro("*******5678")).toBe("5678");
    expect(ultimosCuatro("123")).toBeUndefined();
    expect(ultimosCuatro(undefined)).toBeUndefined();
  });

  test("el medio de pago, si se reconoce", () => {
    expect(leerMedioPago("TARJETA DE DEBITO")).toBe("DEBITO");
    expect(leerMedioPago("Tarjeta de crédito")).toBe("CREDITO");
    expect(leerMedioPago("************4821 DB")).toBe("DEBITO");
    expect(leerMedioPago("EFECTIVO")).toBe("EFECTIVO");
    expect(leerMedioPago("Webpay")).toBeUndefined();
  });

  test("el comercio queda parejo y cabe en la columna", () => {
    expect(pulirComercio("  ENEL   DISTRIBUCION ,")).toBe("ENEL DISTRIBUCION");
    expect(pulirComercio("COMERCIAL EL MAITEN LTDA.")).toBe("COMERCIAL EL MAITEN LTDA.");
    expect(pulirComercio("x".repeat(200))).toHaveLength(120);
    expect(pulirComercio(" , ")).toBeUndefined();
  });
});

describe("normalizar: HTML, entidades y espacios", () => {
  test("una tabla HTML queda una cosa por linea, sin estilos ni scripts", () => {
    const texto = htmlATexto(
      "<html><head><style>td{color:red}</style><script>alerta()</script></head><body>" +
        "<table><tr><td>Monto</td><td>$&nbsp;1.990</td></tr><tr><td>Operaci&oacute;n</td><td>N&ordm; 12</td></tr></table>" +
        "<p>Hola<br>chao</p></body></html>",
    );
    expect(texto.split("\n").filter(Boolean)).toEqual(["Monto", "$ 1.990", "Operación", "Nº 12", "Hola", "chao"]);
    expect(texto).not.toMatch(/alerta|color|</);
  });

  test("el HTML metido en la parte de texto (como manda BancoEstado) tambien se convierte", () => {
    const texto = normalizarTexto("Hola\n <tr><td>Monto</td><td><strong>$175.500</strong></td></tr>");
    expect(texto.split("\n").filter(Boolean)).toEqual(["Hola", "Monto", "$175.500"]);
  });

  test("el texto plano solo se empareja: espacios, saltos y caracteres invisibles", () => {
    expect(normalizarTexto("  Hola   mundo \r\n\r\n\r\n\r\nchao  ")).toBe("Hola mundo\n\nchao");
    expect(normalizarTexto("Mon​to $ 1.990")).toBe("Monto $ 1.990");
  });

  test("las entidades: con nombre, con numero, y las desconocidas se quedan", () => {
    expect(decodificarEntidades("&#36;&#x24;&amp;&oacute;&Ntilde;&desconocida;")).toBe("$$&óÑ&desconocida;");
  });

  test("aplanar saca los adornos de las tablas pero no las mascaras de las tarjetas", () => {
    expect(aplanar("| Monto | $ 1.990 |\n**Total**\n### Hola\n************0583 DB *23/10/2026*")).toBe(
      "Monto $ 1.990 Total Hola ************0583 DB 23/10/2026",
    );
  });

  test("del remitente queda la direccion, y del asunto se van los RV: y Fwd:", () => {
    expect(direccionDe("Banco Santander <Mensajeria@Santander.cl>")).toBe("mensajeria@santander.cl");
    expect(direccionDe("notificaciones@bsale.app")).toBe("notificaciones@bsale.app");
    expect(limpiarAsunto("RV: Fwd: RE: Comprobante de Pago")).toBe("Comprobante de Pago");
    expect(limpiarAsunto("TR: Aviso")).toBe("Aviso");
  });
});

describe("los reenvios a mano: el correo del banco viene adentro", () => {
  test("Gmail: el remitente, el asunto y la fecha del original, sin la nota de quien reenvia", () => {
    const n = normalizarComprobante(cargarEjemplo("reenvios/bsale-desde-gmail.txt"));
    expect(n.remitente).toBe("notificaciones@bsale.app");
    expect(n.reenviadoPor).toBe("camila@ejemplo.cl");
    expect(n.asunto).toBe("COMERCIAL LOS AROMOS SPA: BOLETA ELECTRÓNICA T Nº 4521");
    expect(n.fechaOriginal).toBe("2026-11-09");
    expect(n.reenviadoAMano).toBe(true);
    expect(n.texto).not.toContain("Te mando esta boleta");
  });

  test("Outlook, que deja lineas en blanco entre los encabezados", () => {
    const n = normalizarComprobante(cargarEjemplo("reenvios/santander-desde-outlook.txt"));
    expect(n.remitente).toBe("mensajeria@santander.cl");
    expect(n.asunto).toBe("Comprobante Transferencia de fondos");
    expect(n.fechaOriginal).toBe("2026-11-18");
    expect(n.texto).not.toContain("Para el arriendo");
  });

  test("Apple Mail en ingles y con cada linea citada con >", () => {
    const n = normalizarComprobante(cargarEjemplo("reenvios/bancoestado-citado.txt"));
    expect(n.remitente).toBe("notificaciones@correo.bancoestado.cl");
    expect(n.fechaOriginal).toBe("2026-11-12");
    expect(n.texto.startsWith("Estimado(a)")).toBe(true);
    expect(n.texto).not.toMatch(/^>/m);
  });

  test("un correo que llego directo no se toca", () => {
    const n = normalizarComprobante(cargarEjemplo("santander/transferencia-enviada.txt"));
    expect(n.remitente).toBe("mensajeria@santander.cl");
    expect(n.reenviadoAMano).toBe(false);
    expect(n.fechaOriginal).toBeUndefined();
  });

  test("unas lineas De/Para/Asunto sin direccion de correo no son un reenvio", () => {
    expect(desenvolverReenvio("De: Juan Perez\nPara: Camila\nAsunto: arriendo\nMonto: $5.000")).toBeNull();
  });

  test("un reenvio de un reenvio llega al original", () => {
    const n = normalizarComprobante(
      comprobante({
        remitente: "pedro@ejemplo.cl",
        asunto: "Fwd: Fwd: Comprobante de Pago",
        texto: [
          "---------- Forwarded message ---------",
          "From: Camila <camila@ejemplo.cl>",
          "Subject: Fwd: Comprobante de Pago",
          "",
          "---------- Mensaje reenviado ----------",
          "De: Boton de Pago <bdp@santander.cl>",
          "Fecha: 5 nov 2026",
          "Asunto: Comprobante de Pago",
          "",
          "Con fecha 05-11-2026 hemos procedido a realizar el pago",
        ].join("\n"),
      }),
    );
    expect(n.remitente).toBe("bdp@santander.cl");
    expect(n.asunto).toBe("Comprobante de Pago");
    expect(n.fechaOriginal).toBe("2026-11-05");
    expect(n.texto).toBe("Con fecha 05-11-2026 hemos procedido a realizar el pago");
  });

  test("las citas se sacan solo si la mayoria de las lineas viene citada", () => {
    expect(sinCitas("> uno\n> dos\ntres")).toBe("uno\ndos\ntres");
    expect(sinCitas("uno\ndos\n> tres")).toBe("uno\ndos\n> tres");
  });
});

describe("limpiarDatosPersonales: lo que nunca le llega a la IA", () => {
  test("los RUT, con puntos, sin puntos y con etiqueta", () => {
    const limpio = limpiarDatosPersonales("RUT 11.111.111-1, rut 22222222-2, R.U.T.: 7.654.321-K");
    expect(limpio).toBe("RUT [RUT], rut [RUT], R.U.T.: [RUT]");
  });

  test("de las cuentas y tarjetas quedan los ultimos 4, ya vengan completas o enmascaradas", () => {
    const limpio = limpiarDatosPersonales(
      "Cuenta 0-000-12-34567-8, tarjeta 4111 1111 1111 1111, ************0583, XXXX-XXXX-XXXX-1234, *******5678",
    );
    expect(limpio).toBe("Cuenta ••••5678, tarjeta ••••1111, ••••0583, ••••1234, ••••5678");
  });

  test("los montos, las fechas y los numeros cortos se quedan", () => {
    const texto = "$ 1.200.000 el 16-10-2026, $1234567, boleta Nº 13415, el 18/11/2026 a las 21:30";
    expect(limpiarDatosPersonales(texto)).toBe(texto);
  });

  test("correos, telefonos y enlaces", () => {
    expect(
      limpiarDatosPersonales("Escribe a camila@ejemplo.cl o al +56 9 8765 4321, o entra a https://banco.cl/x?id=1 hoy"),
    ).toBe("Escribe a [correo] o al [teléfono], o entra a [enlace] hoy");
  });

  test("los nombres de los saludos, en cualquier formato", () => {
    for (const saludo of [
      "Estimado(a) Sr(a). Camila rojas",
      "Hola, Camila:",
      "Estimado (a): CAMILA ANDREA ROJAS SOTO",
      "### Estimado: ROJAS SOTO CAMILA ANDREA",
      "* Estimada Camila Rojas Soto:*",
    ]) {
      const limpio = limpiarDatosPersonales(saludo);
      expect(limpio, saludo).toContain("[nombre]");
      expect(limpio, saludo).not.toMatch(/camila|rojas/i);
    }
  });

  test("lo que parece saludo pero no trae un nombre se queda", () => {
    for (const texto of ["Hola, gracias por tu compra", "Estimado cliente:", "Compra en Don Pollo", "DONDE QUIERAS"]) {
      expect(limpiarDatosPersonales(texto), texto).toBe(texto);
    }
  });

  test("los campos con nombre o direccion, en la misma linea o en la siguiente", () => {
    const limpio = limpiarDatosPersonales(
      [
        "Nombre Destinatario",
        "Pedro Muñoz",
        "Nombre: Juan Soto",
        "| Titular | Ana Díaz |",
        "Para: Pedro Muñoz",
        "Dirección de despacho",
        "Av. Siempre Viva 742",
        "Nombre del comercio: Farmacia del Barrio",
        "Para consultas, llama a la sucursal",
      ].join("\n"),
    );
    expect(limpio).not.toMatch(/Pedro|Juan|Ana Díaz|Siempre Viva/);
    expect(limpio).toContain("Farmacia del Barrio");
    expect(limpio).toContain("Para consultas, llama a la sucursal");
  });

  test("los nombres del hogar, con o sin tildes y en cualquier orden", () => {
    expect(
      limpiarDatosPersonales("Pago de MUNOZ LAGOS PEDRO y de Angela", { nombres: ["Pedro Muñoz Lagos", "Ángela"] }),
    ).toBe("Pago de [nombre] [nombre] [nombre] y de [nombre]");
    // Ángel no es Ángeles.
    expect(limpiarDatosPersonales("Sucursal Los Ángeles", { nombres: ["Ángel"] })).toBe("Sucursal Los Ángeles");
  });
});

describe("crearLector: plantillas primero, despues la IA", () => {
  const leidoPorLaIA: LecturaLeida = {
    ok: true,
    tipo: "COMPRA",
    sentido: "gasto",
    monto: 12_990,
    moneda: "CLP",
    fecha: "2026-11-17",
    comercio: "  Farmacia   del Barrio ",
    fuente: "Correo de farmaciadelbarrio-ejemplo.cl",
    via: "ia",
    confianza: 0.9,
  };

  test("lo que tiene plantilla no llama a la IA", async () => {
    const ia = vi.fn();
    const lectura = await crearLector({ leerConIA: ia })(cargarEjemplo("bsale/boleta.txt"));
    expect(lectura).toMatchObject({ ok: true, via: "plantilla", plantilla: "bsale/boleta" });
    expect(ia).not.toHaveBeenCalled();
  });

  test("lo descartado por una plantilla tampoco: publicidad, avisos, pedidos y cartolas", async () => {
    const ia = vi.fn();
    const leer = crearLector({ leerConIA: ia });
    for (const ruta of ["santander/publicidad.txt", "santander/clave-digital.txt", "lider/pedido-recibido.txt"]) {
      expect(await leer(cargarEjemplo(ruta)), ruta).toMatchObject({ ok: false, motivo: "no-es-comprobante" });
    }
    expect(await leer(cargarEjemplo("santander/cartola.txt"))).toMatchObject({ ok: false, motivo: "es-cartola" });
    expect(ia).not.toHaveBeenCalled();
  });

  test("la cartola de un banco sin plantilla igual se aparta", async () => {
    const cartola = comprobante({
      remitente: "avisos@bancoejemplo.cl",
      asunto: "Tu estado de cuenta de noviembre",
      texto: "Adjuntamos tu estado de cuenta. Total facturado $ 412.300.",
      adjuntos: [{ nombre: "estado.pdf", tipo: "application/pdf" }],
    });
    const ia = vi.fn();
    expect(pareceCartola(normalizarComprobante(cartola))).toBe(true);
    expect(await crearLector({ leerConIA: ia })(cartola)).toMatchObject({ ok: false, motivo: "es-cartola" });
    expect(ia).not.toHaveBeenCalled();
  });

  test("un correo sin ningun monto no es comprobante, y no gasta IA", async () => {
    const bienvenida = comprobante({ remitente: "hola@tienda-ejemplo.cl", texto: "Bienvenida a nuestra tienda." });
    const ia = vi.fn();
    expect(traeMontos(normalizarComprobante(bienvenida))).toBe(false);
    expect(await crearLector({ leerConIA: ia })(bienvenida)).toEqual({
      ok: false,
      motivo: "no-es-comprobante",
      detalle: "No trae ningún monto.",
    });
    expect(ia).not.toHaveBeenCalled();
  });

  test("sin plantilla y con montos va a la IA, ya normalizado, y el comercio sale parejo", async () => {
    const ia = vi.fn().mockResolvedValue(leidoPorLaIA);
    const lectura = await crearLector({ leerConIA: ia })(cargarEjemplo("otros/farmacia-compra.txt"));
    expect(ia).toHaveBeenCalledTimes(1);
    const recibido = ia.mock.calls[0]![0];
    expect(recibido.remitente).toBe("avisos@farmaciadelbarrio-ejemplo.cl");
    expect(recibido.texto).not.toContain("<");
    expect(lectura).toEqual({ ...leidoPorLaIA, comercio: "Farmacia del Barrio" });
  });

  test("sin IA, lo que no tiene plantilla queda «no se pudo leer», con el motivo", async () => {
    expect(await crearLector()(cargarEjemplo("otros/farmacia-compra.txt"))).toEqual({
      ok: false,
      motivo: "no-se-pudo-leer",
      detalle: "Ninguna plantilla sirve y la lectura con IA no está configurada.",
    });
  });

  test("si el banco cambio el formato se dice cual plantilla fallo; con IA, lo lee la IA", async () => {
    const formatoNuevo = cargarEjemplo("santander/transferencia-formato-nuevo.txt");
    expect(await crearLector()(formatoNuevo)).toEqual({
      ok: false,
      motivo: "no-se-pudo-leer",
      detalle: "La plantilla santander/transferencia-enviada no encontró: monto, fecha, comercio.",
    });

    const ia = vi.fn().mockResolvedValue({ ...leidoPorLaIA, tipo: "TRANSFERENCIA" });
    expect(await crearLector({ leerConIA: ia })(formatoNuevo)).toMatchObject({ ok: true, via: "ia" });
    expect(ia).toHaveBeenCalledTimes(1);
  });

  test("lo que la IA no pudo leer se devuelve tal cual", async () => {
    const ia = vi.fn().mockResolvedValue({ ok: false, motivo: "no-es-comprobante", detalle: "Según la IA, no es un comprobante." });
    expect(await crearLector({ leerConIA: ia })(cargarEjemplo("otros/farmacia-compra.txt"))).toEqual({
      ok: false,
      motivo: "no-es-comprobante",
      detalle: "Según la IA, no es un comprobante.",
    });
  });

  test("un error de la IA sube tal cual, para que el buzon lo reintente", async () => {
    const ia = vi.fn().mockRejectedValue(new Error("sin red"));
    await expect(crearLector({ leerConIA: ia })(cargarEjemplo("otros/farmacia-compra.txt"))).rejects.toThrow("sin red");
  });

  test("lo reenviado a mano queda marcado, aunque lo haya leido la IA", async () => {
    const reenviado = comprobante({
      remitente: "camila@ejemplo.cl",
      asunto: "Fwd: Tu compra",
      texto: [
        "---------- Forwarded message ---------",
        "De: Farmacia del Barrio <avisos@farmaciadelbarrio-ejemplo.cl>",
        "Subject: Tu compra",
        "",
        "Total pagado $ 12.990",
      ].join("\n"),
    });
    const ia = vi.fn().mockResolvedValue(leidoPorLaIA);
    expect(await crearLector({ leerConIA: ia })(reenviado)).toMatchObject({ ok: true, reenviadoAMano: true });
  });
});
