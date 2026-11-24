import { describe, expect, test } from "vitest";
import {
  claveDelBuzon,
  confirmacionDeGmail,
  direccionDelBuzon,
  esDelBuzon,
  firmadoPor,
  leerAutenticacion,
  mismaDireccion,
  quienLoReenvio,
  type DatosDeLlegada,
} from "@/dominio/buzon";
import { crearLector } from "@/dominio/comprobantes/lector";
import { comprobanteDelCorreo, correoAdjunto, datosDeLlegada, leerCorreo, textoDelPdf } from "@/lib/correo-entrante";
import { armarCorreo, correoDelEjemplo, firmaDe, pdfConTexto, reenvioDeGmail } from "../fixtures/correos/armar";

/*
  Los correos que llegan al buzon, sin base ni red: para que direccion de
  Luka son, quien los reenvio, si traen su firma y como se abren (MIME,
  codificaciones, PDF y correos adjuntos). Todo inventado.
*/

const BASE = "luka.prueba@gmail.com";
const MIA = "luka.prueba+k7q2m9xa4p@gmail.com";

describe("la direccion de Luka", () => {
  test("se arma con la clave, aunque la base ya traiga una", () => {
    expect(direccionDelBuzon(BASE, "k7q2m9xa4p")).toBe(MIA);
    expect(direccionDelBuzon("luka.prueba+vieja@gmail.com", "nueva2345")).toBe("luka.prueba+nueva2345@gmail.com");
  });

  test("la clave sale de la primera direccion que es del buzon", () => {
    expect(claveDelBuzon(["camila@ejemplo.cl", MIA], BASE)).toBe("k7q2m9xa4p");
    expect(claveDelBuzon([BASE], BASE)).toBeNull();
    expect(claveDelBuzon(["otra.persona+k7q2m9xa4p@gmail.com"], BASE)).toBeNull();
    // Una etiqueta que no puede ser una clave (muy corta, con simbolos) no es una clave.
    expect(claveDelBuzon(["luka.prueba+abc@gmail.com", "luka.prueba+no_es@gmail.com"], BASE)).toBeNull();
  });

  test("en Gmail no cuentan los puntos, las mayusculas ni googlemail.com", () => {
    expect(claveDelBuzon(["LukaPrueba+K7Q2M9XA4P@GoogleMail.com"], BASE)).toBe("k7q2m9xa4p");
    expect(mismaDireccion("camila.rojas@gmail.com", "CamilaRojas@googlemail.com")).toBe(true);
    // Fuera de Gmail los puntos si cuentan.
    expect(mismaDireccion("camila.rojas@ejemplo.cl", "camilarojas@ejemplo.cl")).toBe(false);
    expect(esDelBuzon("lukaprueba+loquesea@gmail.com", BASE)).toBe(true);
    expect(esDelBuzon("camila@gmail.com", BASE)).toBe(false);
  });
});

describe("las firmas", () => {
  test("lee el Authentication-Results de Gmail, con sus comentarios", () => {
    const autenticacion = leerAutenticacion(firmaDe("santander.cl").replace(/\r\n/g, ""));
    expect(autenticacion?.servidor).toBe("mx.google.com");
    expect(autenticacion?.resultados.map((r) => [r.metodo, r.resultado])).toEqual([
      ["dkim", "pass"],
      ["spf", "pass"],
      ["dmarc", "pass"],
    ]);
    expect(autenticacion?.resultados[0]?.propiedades["header.i"]).toBe("@santander.cl");
  });

  test("firmado por el dominio del remitente, o por uno suyo", () => {
    const de = (texto: string) => leerAutenticacion(texto);
    expect(firmadoPor(de(firmaDe("santander.cl")), "santander.cl")).toBe(true);
    expect(firmadoPor(de("mx.google.com; dkim=pass header.d=mail.santander.cl"), "santander.cl")).toBe(true);
    expect(firmadoPor(de("mx.google.com; dkim=pass header.d=santander.cl"), "mail.santander.cl")).toBe(true);
    // La firma de otro dominio no es la del remitente.
    expect(firmadoPor(de("mx.google.com; dkim=pass header.d=sendgrid.net; dmarc=fail header.from=santander.cl"), "santander.cl")).toBe(false);
    expect(firmadoPor(de("mx.google.com; dkim=fail header.d=santander.cl"), "santander.cl")).toBe(false);
    expect(firmadoPor(null, "santander.cl")).toBe(false);
    expect(leerAutenticacion("dkim=pass header.d=x.cl")).toBeNull();
  });
});

describe("quien lo reenvio", () => {
  const llegada = (datos: Partial<DatosDeLlegada>): DatosDeLlegada => ({
    de: "mensajeria@santander.cl",
    destinatarios: [],
    rastros: [],
    autenticacion: leerAutenticacion(firmaDe("santander.cl")),
    ...datos,
  });
  const confirmados = ["camila@gmail.com", "camila@hotmail.com"];

  test("reenviado solo: por el X-Forwarded-For de Gmail, o por a quien se lo mando el banco", () => {
    expect(quienLoReenvio(llegada({ rastros: ["camila.@gmail.com", "camila@gmail.com"] }), confirmados)).toEqual({
      tipo: "automatico",
      reenviadoPor: "camila@gmail.com",
    });
    expect(quienLoReenvio(llegada({ destinatarios: ["Camila@Hotmail.com"] }), confirmados)).toEqual({
      tipo: "automatico",
      reenviadoPor: "camila@hotmail.com",
    });
  });

  test("reenviado a mano: desde un correo confirmado y con su firma", () => {
    expect(quienLoReenvio(llegada({ de: "camila@gmail.com", autenticacion: leerAutenticacion(firmaDe("gmail.com")) }), confirmados)).toEqual({
      tipo: "a-mano",
      reenviadoPor: "camila@gmail.com",
    });
  });

  test("con el From de un correo confirmado pero sin su firma, no", () => {
    expect(quienLoReenvio(llegada({ de: "camila@gmail.com", rastros: ["camila@gmail.com"] }), confirmados)).toEqual({
      tipo: "sin-firma",
      desde: "camila@gmail.com",
    });
  });

  test("sin ningun correo confirmado, se dice desde donde llego", () => {
    expect(quienLoReenvio(llegada({ rastros: ["otra@hotmail.com"], destinatarios: ["otra@hotmail.com"] }), confirmados)).toEqual({
      tipo: "sin-confirmar",
      desde: "otra@hotmail.com",
    });
    expect(quienLoReenvio(llegada({}), confirmados)).toEqual({ tipo: "sin-confirmar", desde: "mensajeria@santander.cl" });
  });
});

describe("la confirmacion de reenvio de Gmail", () => {
  const esDeLuka = (d: string) => esDelBuzon(d, BASE);
  const firmaDeGoogle = leerAutenticacion(firmaDe("google.com"));

  test("saca el codigo del asunto, en ingles o en castellano, y quien la pidio", () => {
    expect(
      confirmacionDeGmail(
        {
          de: "forwarding-noreply@google.com",
          asunto: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from camila@gmail.com",
          texto: `camila@gmail.com has requested to automatically forward mail to your email address ${MIA}.`,
          autenticacion: firmaDeGoogle,
        },
        esDeLuka,
      ),
    ).toEqual({ codigo: "123456789", solicitante: "camila@gmail.com" });

    expect(
      confirmacionDeGmail(
        {
          de: "Forwarding-NoReply@google.com",
          asunto: "Confirmación de reenvío de Gmail: recibir correo de ana@empresa.cl",
          texto: `ana@empresa.cl solicitó reenviar los correos a ${MIA}.\nCódigo de confirmación: 556677889`,
          autenticacion: firmaDeGoogle,
        },
        esDeLuka,
      ),
    ).toEqual({ codigo: "556677889", solicitante: "ana@empresa.cl" });
  });

  test("sin la firma de Google, o de otro remitente, no es una confirmacion", () => {
    const correo = { asunto: "(#123456789) Gmail Forwarding Confirmation", texto: "", autenticacion: firmaDeGoogle };
    expect(confirmacionDeGmail({ ...correo, de: "forwarding-noreply@google.com", autenticacion: null }, esDeLuka)).toBeNull();
    expect(confirmacionDeGmail({ ...correo, de: "forwarding-noreply@goog1e.com" }, esDeLuka)).toBeNull();
  });
});

describe("abrir un correo", () => {
  test("los encabezados del camino: el primer Authentication-Results, a donde se entrego y quien lo reenvio", async () => {
    const crudo = await correoDelEjemplo("santander/transferencia-enviada.txt", {
      idDelMensaje: "<comprobante-0001@santander.cl>",
      arriba: reenvioDeGmail("camila@gmail.com", MIA, "santander.cl"),
    });
    const correo = await leerCorreo(crudo);
    expect(correo).toMatchObject({
      idDelMensaje: "comprobante-0001@santander.cl",
      de: "mensajeria@santander.cl",
      asunto: "Comprobante Transferencia de fondos",
      destinatarios: ["camila@ejemplo.cl"],
      entregadoA: [MIA, "camila@gmail.com", MIA],
      reenviadoPor: ["camila@gmail.com"],
    });
    expect(correo.autenticacion).toMatch(/^mx\.google\.com;/);
    expect(correo.html).toMatch(/Monto transferido/);

    const datos = datosDeLlegada(correo, (d) => esDelBuzon(d, BASE));
    expect(datos.rastros).toEqual(["camila@gmail.com", "camila@gmail.com"]);
    expect(firmadoPor(datos.autenticacion, "santander.cl")).toBe(true);
  });

  test("decodifica quoted-printable, base64 y otro juego de caracteres", async () => {
    const latin1 = Buffer.from(
      [
        "From: Banco <avisos@banco.cl>",
        "To: camila@ejemplo.cl",
        "Subject: =?ISO-8859-1?Q?Notificaci=F3n_de_cargo?=",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=ISO-8859-1",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "Se realiz=F3 un cargo por $ 85.000 en tu cuenta. Gracias por preferirnos, =",
        "se=F1or.",
        "",
      ].join("\r\n"),
      "latin1",
    );
    const correo = await leerCorreo(latin1);
    expect(correo.asunto).toBe("Notificación de cargo");
    expect(correo.texto).toContain("Se realizó un cargo por $ 85.000");
    expect(correo.texto).toContain("preferirnos, señor.");

    const enBase64 = await leerCorreo(await armarCorreo({ de: "a@b.cl", asunto: "Ñandú", texto: "Compra por $ 12.990 en ÑUÑOA", codificacion: "base64" }));
    expect(enBase64.asunto).toBe("Ñandú");
    expect(enBase64.texto).toContain("$ 12.990 en ÑUÑOA");
  });

  test("el texto de un PDF adjunto; un PDF con clave o roto, sin texto", async () => {
    expect(await textoDelPdf(new Uint8Array(await pdfConTexto("Fecha: 15/11/2026\nTOTAL 6.170")))).toMatch(/Fecha: 15\/11\/2026\s+TOTAL 6\.170/);
    expect(await textoDelPdf(new TextEncoder().encode("%PDF-1.4 esto no es un pdf"))).toBeUndefined();
    expect(await textoDelPdf(new Uint8Array())).toBeUndefined();
  });

  test("el comprobante lleva el HTML, el texto de sus PDF y nada de imagenes", async () => {
    const correo = await leerCorreo(
      await correoDelEjemplo("lider/boleta-digital.txt", {
        adjuntos: [
          { nombre: "boleta.pdf", tipo: "application/pdf", contenido: await pdfConTexto("Fecha: 15/11/2026\nTOTAL 6.170\n************4821 CR") },
          { nombre: "logo.png", tipo: "image/png", contenido: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
        ],
      }),
    );
    const comprobante = await comprobanteDelCorreo(correo, "camila@gmail.com");
    expect(comprobante).toMatchObject({ remitente: "contacto@info.lider.cl", reenviadoPor: "camila@gmail.com", asunto: "Boleta digital de tu compra en Lider" });
    expect(comprobante.adjuntos).toEqual([{ nombre: "boleta.pdf", tipo: "application/pdf", texto: expect.stringMatching(/TOTAL 6\.170/) }]);
    // Y el lector de la Seccion A lo lee entero desde el PDF.
    expect(await crearLector()(comprobante)).toMatchObject({ ok: true, monto: 6_170, ultimos4: "4821", fecha: "2026-11-15" });
  });

  test("un correo reenviado como archivo adjunto se abre aparte", async () => {
    const original = await correoDelEjemplo("santander/transferencia-enviada.txt", { idDelMensaje: "<original@santander.cl>" });
    const reenvio = await leerCorreo(
      await armarCorreo({
        de: "camila@gmail.com",
        para: MIA,
        asunto: "Fwd: comprobante",
        texto: "Va adjunto",
        adjuntos: [{ nombre: "comprobante.eml", tipo: "message/rfc822", contenido: original }],
      }),
    );
    const adentro = await correoAdjunto(reenvio);
    expect(adentro).toMatchObject({ idDelMensaje: "original@santander.cl", de: "mensajeria@santander.cl" });
    expect(await correoAdjunto(await leerCorreo(original))).toBeNull();
  });
});
