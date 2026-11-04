import { describe, expect, test } from "vitest";
import { configuracionDeCorreo, enviarCorreoDelEntorno } from "@/lib/correo";
import { correoDeCodigoDeBorrado, escaparHtml } from "@/dominio/correos";

describe("configuracionDeCorreo (el .env)", () => {
  test("sin correo o sin clave, no hay correo", () => {
    expect(configuracionDeCorreo({})).toBeNull();
    expect(configuracionDeCorreo({ CORREO_SMTP_USUARIO: "luka@gmail.com" })).toBeNull();
    expect(configuracionDeCorreo({ CORREO_SMTP_CLAVE: "abcd efgh ijkl mnop" })).toBeNull();
    expect(configuracionDeCorreo({ CORREO_SMTP_USUARIO: " ", CORREO_SMTP_CLAVE: " " })).toBeNull();
    expect(enviarCorreoDelEntorno({})).toBeNull();
  });

  test("con Gmail basta el correo y la clave, pegada con o sin espacios", () => {
    expect(configuracionDeCorreo({ CORREO_SMTP_USUARIO: " luka@gmail.com ", CORREO_SMTP_CLAVE: "abcd efgh ijkl mnop" })).toEqual({
      servidor: "smtp.gmail.com",
      puerto: 465,
      usuario: "luka@gmail.com",
      clave: "abcdefghijklmnop",
    });
  });

  test("otro servidor y otro puerto, si se dicen; un puerto raro vuelve al 465", () => {
    const base = { CORREO_SMTP_USUARIO: "a@b.cl", CORREO_SMTP_CLAVE: "x" };
    expect(configuracionDeCorreo({ ...base, CORREO_SMTP_SERVIDOR: "smtp.b.cl", CORREO_SMTP_PUERTO: "587" })).toMatchObject({
      servidor: "smtp.b.cl",
      puerto: 587,
    });
    for (const malo of ["abc", "0", "70000", "46.5"]) {
      expect(configuracionDeCorreo({ ...base, CORREO_SMTP_PUERTO: malo })?.puerto, malo).toBe(465);
    }
  });
});

describe("el correo con el codigo para borrar el hogar", () => {
  const correo = correoDeCodigoDeBorrado({ nombreDelHogar: "Casa de Ana", nombre: "Ana", codigo: "004217" });

  test("trae el codigo, el hogar y cuanto dura, en texto y en HTML", () => {
    for (const parte of [correo.texto, correo.html]) {
      expect(parte).toContain("004217");
      expect(parte).toContain("Casa de Ana");
      expect(parte).toContain("10 minutos");
    }
    expect(correo.texto.startsWith("Hola, Ana:")).toBe(true);
  });

  test("el asunto no lleva el codigo: no queda a la vista en las notificaciones", () => {
    expect(correo.asunto).toBe("Código para borrar «Casa de Ana» en Luka");
    expect(correo.asunto).not.toContain("004217");
  });

  test("lo que escribio una persona no mete etiquetas en el HTML", () => {
    const malo = correoDeCodigoDeBorrado({ nombreDelHogar: '<a href="x">Gana</a>', nombre: "<b>", codigo: "123456" });
    expect(malo.html).not.toMatch(/<a |<b>/);
    expect(malo.html).toContain("&lt;a href=&quot;x&quot;&gt;Gana&lt;/a&gt;");
    expect(escaparHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  test("sin nombre, saluda igual", () => {
    expect(correoDeCodigoDeBorrado({ nombreDelHogar: "X", nombre: null, codigo: "1" }).texto.startsWith("Hola:")).toBe(true);
  });
});
