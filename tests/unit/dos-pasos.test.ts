import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  ALFABETO_DE_RESPALDO,
  DOS_PASOS,
  agruparClave,
  enlaceDeLaApp,
  estaBloqueado,
  estadoDeAcceso,
  formatearCodigoDeRespaldo,
  limpiarCodigoDeApp,
  limpiarCodigoDeRespaldo,
  mensajeDeBloqueo,
  mensajeDeFallo,
  nombreEnLaApp,
  trasUnFallo,
} from "@/dominio/dos-pasos";
import {
  FaltaClaveDosPasos,
  aBase32,
  cifrarClaveDeApp,
  claveMaestra,
  codigoDeApp,
  deBase32,
  descifrarClaveDeApp,
  huellaDeRespaldo,
  nuevaClaveDeApp,
  nuevosCodigosDeRespaldo,
  pasoDe,
  revisarCodigoDeApp,
} from "@/lib/dos-pasos";
import { qrEnSvg } from "@/lib/qr";

const MAESTRA = randomBytes(32);
const en = (segundos: number) => new Date(segundos * 1000);

describe("base32 (RFC 4648, sin relleno)", () => {
  // Los vectores del RFC 4648, seccion 10.
  const VECTORES: [string, string][] = [
    ["", ""],
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ];

  test.each(VECTORES)("«%s» ↔ «%s»", (texto, base32) => {
    expect(aBase32(new TextEncoder().encode(texto))).toBe(base32);
    expect(new TextDecoder().decode(deBase32(base32))).toBe(texto);
  });

  test("lee la clave como la escribe la gente: minusculas, espacios y relleno", () => {
    expect(new TextDecoder().decode(deBase32("mzxw 6ytb oi======"))).toBe("foobar");
  });

  test("ida y vuelta con claves de 20 bytes al azar", () => {
    for (let i = 0; i < 50; i++) {
      const clave = nuevaClaveDeApp();
      expect(clave).toHaveLength(20);
      expect(aBase32(clave)).toHaveLength(32);
      expect(deBase32(aBase32(clave))).toEqual(clave);
    }
  });

  test("rechaza lo que no es base32", () => {
    expect(() => deBase32("ABC1")).toThrow(/base32/);
  });
});

describe("el codigo de la app (TOTP, RFC 6238)", () => {
  // Apendice B del RFC 6238, con SHA1 y la clave "12345678901234567890".
  const CLAVE = new TextEncoder().encode("12345678901234567890");
  const VECTORES: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  test.each(VECTORES)("a los %i segundos: %s", (segundos, esperado) => {
    expect(codigoDeApp(CLAVE, pasoDe(en(segundos)), 8)).toBe(esperado);
    // Con 6 digitos, los ultimos 6 del mismo numero.
    expect(codigoDeApp(CLAVE, pasoDe(en(segundos)))).toBe(esperado.slice(-6));
  });

  test("un paso dura 30 segundos", () => {
    expect(pasoDe(en(0))).toBe(0);
    expect(pasoDe(en(29))).toBe(0);
    expect(pasoDe(en(30))).toBe(1);
  });

  test("acepta el codigo de ahora, el de antes y el de despues; no los de mas lejos", () => {
    const ahora = en(1_800_000_000);
    const paso = pasoDe(ahora);
    for (const corrimiento of [-1, 0, 1]) {
      expect(revisarCodigoDeApp(CLAVE, codigoDeApp(CLAVE, paso + corrimiento), ahora, null)).toEqual({
        ok: true,
        paso: paso + corrimiento,
      });
    }
    for (const corrimiento of [-3, -2, 2, 3]) {
      expect(revisarCodigoDeApp(CLAVE, codigoDeApp(CLAVE, paso + corrimiento), ahora, null).ok).toBe(false);
    }
  });

  test("el mismo codigo no sirve dos veces, ni uno anterior al ultimo usado", () => {
    const ahora = en(1_800_000_000);
    const paso = pasoDe(ahora);
    const codigo = codigoDeApp(CLAVE, paso);
    const primero = revisarCodigoDeApp(CLAVE, codigo, ahora, null);
    expect(primero).toEqual({ ok: true, paso });
    expect(revisarCodigoDeApp(CLAVE, codigo, ahora, paso).ok).toBe(false);
    expect(revisarCodigoDeApp(CLAVE, codigoDeApp(CLAVE, paso - 1), ahora, paso).ok).toBe(false);
    // El siguiente si.
    expect(revisarCodigoDeApp(CLAVE, codigoDeApp(CLAVE, paso + 1), ahora, paso)).toEqual({ ok: true, paso: paso + 1 });
  });

  test("con otra clave, el codigo no sirve", () => {
    const ahora = en(1_800_000_000);
    const otra = nuevaClaveDeApp();
    expect(revisarCodigoDeApp(otra, codigoDeApp(CLAVE, pasoDe(ahora)), ahora, null).ok).toBe(false);
  });
});

describe("CLAVE_DOS_PASOS", () => {
  test("se lee en base64 y tiene que tener al menos 32 bytes", () => {
    const clave = randomBytes(32).toString("base64");
    expect(claveMaestra({ CLAVE_DOS_PASOS: clave })).toHaveLength(32);
    expect(claveMaestra({ CLAVE_DOS_PASOS: ` ${clave}\n` })).toHaveLength(32);
  });

  test("sin ella, o corta, no se sigue: la puerta queda cerrada", () => {
    expect(() => claveMaestra({})).toThrow(FaltaClaveDosPasos);
    expect(() => claveMaestra({ CLAVE_DOS_PASOS: "  " })).toThrow(FaltaClaveDosPasos);
    expect(() => claveMaestra({ CLAVE_DOS_PASOS: randomBytes(16).toString("base64") })).toThrow(/openssl rand -base64 32/);
  });
});

describe("la clave de la app, cifrada", () => {
  test("ida y vuelta, y nunca queda a la vista", () => {
    const clave = nuevaClaveDeApp();
    const cifrada = cifrarClaveDeApp(clave, "m1", MAESTRA);
    expect(cifrada.startsWith("v1.")).toBe(true);
    expect(cifrada).not.toContain(aBase32(clave));
    expect(cifrada).not.toContain(Buffer.from(clave).toString("base64url"));
    expect(descifrarClaveDeApp(cifrada, "m1", MAESTRA)).toEqual(clave);
  });

  test("cifrar dos veces lo mismo da textos distintos", () => {
    const clave = nuevaClaveDeApp();
    expect(cifrarClaveDeApp(clave, "m1", MAESTRA)).not.toBe(cifrarClaveDeApp(clave, "m1", MAESTRA));
  });

  test("no se descifra con otro miembro, con otra clave maestra ni si se toco", () => {
    const cifrada = cifrarClaveDeApp(nuevaClaveDeApp(), "m1", MAESTRA);
    expect(() => descifrarClaveDeApp(cifrada, "m2", MAESTRA)).toThrow();
    expect(() => descifrarClaveDeApp(cifrada, "m1", randomBytes(32))).toThrow();
    const partes = cifrada.split(".");
    const tocado = Buffer.from(partes[2]!, "base64url");
    tocado[0]! ^= 1;
    partes[2] = tocado.toString("base64url");
    expect(() => descifrarClaveDeApp(partes.join("."), "m1", MAESTRA)).toThrow();
    expect(() => descifrarClaveDeApp("v2.a.b.c", "m1", MAESTRA)).toThrow(/formato/);
  });
});

describe("los codigos de respaldo", () => {
  test("son 10, distintos, de 10 caracteres del alfabeto sin I, O, 0 ni 1", () => {
    const codigos = nuevosCodigosDeRespaldo();
    expect(codigos).toHaveLength(DOS_PASOS.codigosDeRespaldo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(limpiarCodigoDeRespaldo(c)).toBe(c);
    }
    expect(ALFABETO_DE_RESPALDO).toHaveLength(32);
    expect(ALFABETO_DE_RESPALDO).not.toMatch(/[IO01]/);
  });

  test("se muestran con un guion y se leen como sea que los escriban", () => {
    expect(formatearCodigoDeRespaldo("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
    expect(limpiarCodigoDeRespaldo(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(limpiarCodigoDeRespaldo("ABCDE FGHJK")).toBe("ABCDEFGHJK");
    expect(limpiarCodigoDeRespaldo("ABCDEFGHJ")).toBeNull();
    expect(limpiarCodigoDeRespaldo("ABCDEFGHJ0")).toBeNull();
  });

  test("la huella es la misma para el mismo codigo y miembro, y distinta si cambia algo", () => {
    const h = huellaDeRespaldo("ABCDEFGHJK", "m1", MAESTRA);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaDeRespaldo("ABCDEFGHJK", "m1", MAESTRA)).toBe(h);
    expect(huellaDeRespaldo("ABCDEFGHJL", "m1", MAESTRA)).not.toBe(h);
    expect(huellaDeRespaldo("ABCDEFGHJK", "m2", MAESTRA)).not.toBe(h);
    expect(huellaDeRespaldo("ABCDEFGHJK", "m1", randomBytes(32))).not.toBe(h);
  });
});

describe("estadoDeAcceso", () => {
  test("sin hogar no hay nada; sin app, configurar; con app, verificar hasta poner el codigo", () => {
    expect(estadoDeAcceso({ conHogar: false, appConfigurada: true, sesionVerificada: true })).toBe("sin-sesion");
    expect(estadoDeAcceso({ conHogar: true, appConfigurada: false, sesionVerificada: false })).toBe("configurar");
    expect(estadoDeAcceso({ conHogar: true, appConfigurada: true, sesionVerificada: false })).toBe("verificar");
    expect(estadoDeAcceso({ conHogar: true, appConfigurada: true, sesionVerificada: true })).toBe("listo");
  });

  test("si se quito la app (otro celular), hay que configurarla aunque la sesion estuviera verificada", () => {
    expect(estadoDeAcceso({ conHogar: true, appConfigurada: false, sesionVerificada: true })).toBe("configurar");
  });
});

describe("intentos y bloqueo", () => {
  const AHORA = new Date("2026-11-04T15:00:00Z");

  test("cuenta los fallos y al quinto bloquea 15 minutos", () => {
    let estado = { intentos: 0, bloqueadoHasta: null as Date | null };
    for (let i = 1; i < DOS_PASOS.intentos; i++) {
      estado = trasUnFallo(estado.intentos, AHORA);
      expect(estado).toEqual({ intentos: i, bloqueadoHasta: null });
    }
    estado = trasUnFallo(estado.intentos, AHORA);
    expect(estado.intentos).toBe(0);
    expect(estado.bloqueadoHasta).toEqual(new Date("2026-11-04T15:15:00Z"));
    expect(estaBloqueado(estado.bloqueadoHasta, AHORA)).toBe(true);
    expect(estaBloqueado(estado.bloqueadoHasta, new Date("2026-11-04T15:15:00Z"))).toBe(false);
    expect(estaBloqueado(null, AHORA)).toBe(false);
  });

  test("los mensajes dicen cuanto queda", () => {
    expect(mensajeDeFallo({ intentos: 1, bloqueadoHasta: null }, AHORA)).toBe("Ese código no es. Te quedan 4 intentos.");
    expect(mensajeDeFallo({ intentos: 4, bloqueadoHasta: null }, AHORA)).toBe("Ese código no es. Te queda 1 intento.");
    expect(mensajeDeFallo({ intentos: 0, bloqueadoHasta: new Date("2026-11-04T15:15:00Z") }, AHORA)).toBe(
      "Demasiados intentos. Espera 15 minutos y prueba de nuevo.",
    );
    expect(mensajeDeBloqueo(new Date("2026-11-04T15:00:20Z"), AHORA)).toBe(
      "Demasiados intentos. Espera 1 minuto y prueba de nuevo.",
    );
  });
});

describe("como se escribe y se escanea", () => {
  test("el codigo de la app se acepta con espacios; si no son 6 digitos, no", () => {
    expect(limpiarCodigoDeApp("123 456")).toBe("123456");
    expect(limpiarCodigoDeApp(" 123456 ")).toBe("123456");
    expect(limpiarCodigoDeApp("12345")).toBeNull();
    expect(limpiarCodigoDeApp("12345a")).toBeNull();
  });

  test("la clave para escribir a mano va de a 4", () => {
    expect(agruparClave("ABCDEFGHIJKLMNOP")).toBe("ABCD EFGH IJKL MNOP");
    expect(agruparClave("ABCDEF")).toBe("ABCD EF");
  });

  test("en la nube se llama Luka; en tu Mac, Luka (local)", () => {
    expect(nombreEnLaApp({ VERCEL_ENV: "production" })).toBe("Luka");
    expect(nombreEnLaApp({})).toBe("Luka (local)");
    expect(nombreEnLaApp({ VERCEL_ENV: "preview" })).toBe("Luka (local)");
  });

  test("el enlace del QR tiene el formato de Google Authenticator", () => {
    const enlace = enlaceDeLaApp({ emisor: "Luka (local)", correo: "yo+luka@gmail.com", clave: "JBSWY3DPEHPK3PXP" });
    expect(enlace).toBe(
      "otpauth://totp/Luka%20(local):yo%2Bluka%40gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Luka%20(local)&algorithm=SHA1&digits=6&period=30",
    );
    const url = new URL(enlace);
    expect(url.protocol).toBe("otpauth:");
    expect(url.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(url.searchParams.get("issuer")).toBe("Luka (local)");
  });

  test("el QR sale como SVG, negro sobre blanco", () => {
    const svg = qrEnSvg("otpauth://totp/Luka:yo%40gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Luka");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain("#FFFFFF");
    expect(svg).toContain("#000000");
  });
});
