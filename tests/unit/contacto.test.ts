import { describe, expect, test } from "vitest";
import { ARCHIVO_DEL_CONTACTO, tarjetaDeContacto, trozosDeLaDireccion } from "@/dominio/contacto";

describe("la direccion en el celular", () => {
  test("se corta despues del «+» y antes de la «@», y juntos los trozos son la direccion", () => {
    expect(trozosDeLaDireccion("luka.buzon+k7m2x9q4ab@gmail.com")).toEqual(["luka.buzon+", "k7m2x9q4ab", "@gmail.com"]);
    expect(trozosDeLaDireccion("luka@gmail.com")).toEqual(["luka", "@gmail.com"]);
    expect(trozosDeLaDireccion("a@b+c.cl")).toEqual(["a", "@b+c.cl"]);
    expect(trozosDeLaDireccion("sin-arroba")).toEqual(["sin-arroba"]);
    for (const d of ["luka.buzon+k7m2x9q4ab@gmail.com", "x+@y.cl", "@solo.cl"]) {
      expect(trozosDeLaDireccion(d).join("")).toBe(d);
    }
  });
});

describe("el contacto «Luka» para el celular", () => {
  test("es una vCard 3.0 llamada Luka con la direccion de la persona, en lineas CRLF", () => {
    const tarjeta = tarjetaDeContacto("  luka.buzon+k7m2x9q4ab@gmail.com ");
    expect(tarjeta.split("\r\n")).toEqual([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:;Luka;;;",
      "FN:Luka",
      "EMAIL;TYPE=INTERNET:luka.buzon+k7m2x9q4ab@gmail.com",
      "NOTE:Reenvíale los avisos de tu banco y Luka anota tus gastos.",
      "END:VCARD",
      "",
    ]);
    expect(tarjeta).not.toMatch(/[^\r]\n/);
    expect(ARCHIVO_DEL_CONTACTO).toBe("Luka.vcf");
  });

  test("una direccion que podria romper la tarjeta no se escribe", () => {
    for (const mala of ["", "sin-arroba", "a@b", "luka@gmail.com\r\nTEL:123", "a;b@gmail.com", "uno@gmail.com,dos@gmail.com"]) {
      expect(() => tarjetaDeContacto(mala), mala).toThrow(/no es válida/);
    }
  });
});
