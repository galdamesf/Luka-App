import { describe, expect, test } from "vitest";
import {
  CODIGO_DE_CORREO,
  PASOS,
  PROVEEDORES,
  codigoDeCorreoEquivocado,
  limpiarCodigoDeCorreo,
  limpiarCorreo,
  proveedorDe,
  proveedorPorDominio,
  proveedorPorMx,
  revisarCodigoDeCorreo,
  segundosParaOtroCodigo,
} from "@/dominio/correos-registrados";
import { correoDeCodigoDeCorreo } from "@/dominio/correos";
import { huellaDelCodigo, huellaDelCodigoDeCorreo, claveDeBuzonAlAzar } from "@/lib/codigos";
import { esClaveDeBuzon } from "@/dominio/buzon";

/*
  Los correos que cada persona registra, sin base: como se escriben, de que
  proveedor son, las reglas del codigo y los pasos de cada proveedor.
*/

describe("como se escribe un correo", () => {
  test.each([
    ["  Camila.Rojas@Hotmail.com ", "camila.rojas@hotmail.com"],
    ["ana@empresa.cl", "ana@empresa.cl"],
    ["camila@", null],
    ["camila@localhost", null],
    ["sin arroba", null],
    ["dos espacios@ej emplo.cl", null],
    [`${"x".repeat(65)}@ejemplo.cl`, null],
  ])("%s -> %s", (texto, esperado) => {
    expect(limpiarCorreo(texto)).toBe(esperado);
  });
});

describe("de que proveedor es", () => {
  test.each([
    ["gmail.com", "GMAIL"],
    ["googlemail.com", "GMAIL"],
    ["hotmail.com", "OUTLOOK"],
    ["outlook.cl", "OUTLOOK"],
    ["live.cl", "OUTLOOK"],
    ["icloud.com", "ICLOUD"],
    ["me.com", "ICLOUD"],
    ["yahoo.es", "YAHOO"],
    ["ymail.com", "YAHOO"],
    ["empresa.cl", null],
  ])("%s por su dominio es %s", (dominio, esperado) => {
    expect(proveedorPorDominio(dominio)).toBe(esperado);
  });

  test.each([
    [["aspmx.l.google.com", "alt1.aspmx.l.google.com"], "GMAIL"],
    [["smtp.google.com."], "GMAIL"],
    [["empresa-cl.mail.protection.outlook.com"], "OUTLOOK"],
    [["mx01.mail.icloud.com"], "ICLOUD"],
    [["mta5.am0.yahoodns.net"], "YAHOO"],
    [["mx.zoho.com"], "OTRO"],
    [[], "OTRO"],
  ])("un dominio propio con MX %j es %s", (servidores, esperado) => {
    expect(proveedorPorMx(servidores)).toBe(esperado);
  });

  test("el dominio publico manda, aunque el MX diga otra cosa", () => {
    expect(proveedorDe("ana@hotmail.com", ["aspmx.l.google.com"])).toBe("OUTLOOK");
    expect(proveedorDe("ana@empresa.cl", ["aspmx.l.google.com"])).toBe("GMAIL");
  });
});

describe("el codigo", () => {
  test("son 6 numeros, con o sin espacios ni guiones", () => {
    expect(limpiarCodigoDeCorreo(" 123 456 ")).toBe("123456");
    expect(limpiarCodigoDeCorreo("123-456")).toBe("123456");
    expect(limpiarCodigoDeCorreo("12345")).toBeNull();
    expect(limpiarCodigoDeCorreo("12345a")).toBeNull();
  });

  test("vale media hora, cinco intentos, y uno por minuto", () => {
    expect(CODIGO_DE_CORREO).toEqual({ digitos: 6, minutosDeVigencia: 30, intentos: 5, segundosParaReenviar: 60 });
    const pedido = new Date("2026-11-20T15:00:00Z");
    expect(segundosParaOtroCodigo(pedido, new Date("2026-11-20T15:00:20Z"))).toBe(40);
    expect(segundosParaOtroCodigo(pedido, new Date("2026-11-20T15:01:00Z"))).toBe(0);
    expect(segundosParaOtroCodigo(null, pedido)).toBe(0);
  });

  test("antes de comparar: que haya codigo, que siga vigente y que queden intentos", () => {
    const ahora = new Date("2026-11-20T15:00:00Z");
    const vence = new Date("2026-11-20T15:30:00Z");
    expect(revisarCodigoDeCorreo({ hayCodigo: false, venceEn: null, intentos: 0 }, ahora)).toMatch(/Primero pide el código/);
    expect(revisarCodigoDeCorreo({ hayCodigo: true, venceEn: vence, intentos: 0 }, ahora)).toBeNull();
    expect(revisarCodigoDeCorreo({ hayCodigo: true, venceEn: vence, intentos: 5 }, ahora)).toMatch(/Se acabaron/);
    expect(revisarCodigoDeCorreo({ hayCodigo: true, venceEn: ahora, intentos: 0 }, ahora)).toMatch(/venció/);
    expect(codigoDeCorreoEquivocado(1)).toBe("Ese código no es. Te quedan 4 intentos.");
    expect(codigoDeCorreoEquivocado(4)).toBe("Ese código no es. Te queda 1 intento.");
    expect(codigoDeCorreoEquivocado(5)).toMatch(/se acabaron/);
  });

  test("su huella es otra que la del codigo para borrar el hogar, y otra para cada correo", () => {
    const secreto = "s";
    expect(huellaDelCodigoDeCorreo("123456", "correo-1", secreto)).not.toBe(huellaDelCodigoDeCorreo("123456", "correo-2", secreto));
    expect(huellaDelCodigoDeCorreo("123456", "x", secreto)).not.toBe(huellaDelCodigo("123456", "x", secreto));
  });

  test("el correo que lo lleva escapa lo que va en el HTML y no trae enlaces", () => {
    const correo = correoDeCodigoDeCorreo({ nombre: "Ana", direccion: "a<b>@ejemplo.cl", codigo: "004217" });
    expect(correo.asunto).toBe("Tu código para conectar este correo con Luka");
    expect(correo.texto).toContain("    004217");
    expect(correo.texto.startsWith("Hola, Ana:")).toBe(true);
    expect(correo.html).toContain("a&lt;b&gt;@ejemplo.cl");
    expect(correo.html).not.toMatch(/<a\s/i);
    expect(correoDeCodigoDeCorreo({ nombre: null, direccion: "x@y.cl", codigo: "1" }).texto.startsWith("Hola:")).toBe(true);
  });
});

describe("la clave de cada buzon", () => {
  test("diez letras y numeros que no se confunden, distinta cada vez", () => {
    const claves = new Set(Array.from({ length: 50 }, () => claveDeBuzonAlAzar()));
    expect(claves.size).toBe(50);
    for (const clave of claves) {
      expect(clave).toMatch(/^[a-hjkmnp-z2-9]{10}$/);
      expect(esClaveDeBuzon(clave)).toBe(true);
    }
  });
});

describe("los pasos de cada proveedor", () => {
  test("estan todos, y cada uno dice como reenviar", () => {
    expect(Object.keys(PASOS).sort()).toEqual([...PROVEEDORES].sort());
    for (const proveedor of PROVEEDORES) expect(PASOS[proveedor].pasos.length).toBeGreaterThanOrEqual(3);
  });

  test("en Gmail, un filtro y nunca reenviar todo el correo", () => {
    expect(PASOS.GMAIL.pasos.join(" ")).toMatch(/Crear un filtro/);
    expect(PASOS.GMAIL.nota).toMatch(/No actives «Reenviar una copia del correo entrante»/);
  });

  test("en Outlook, redirigir y no reenviar, para que llegue con el remitente del banco", () => {
    expect(PASOS.OUTLOOK.pasos.join(" ")).toMatch(/Redirigir a/);
  });

  test("Yahoo no reenvia solo sin pagar: se dice", () => {
    expect(PASOS.YAHOO.reenviaSolo).toBe(false);
    expect(PASOS.YAHOO.pasos.join(" ")).toMatch(/a mano/);
  });
});
