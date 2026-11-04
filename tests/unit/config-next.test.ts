import { describe, expect, test } from "vitest";
import config from "../../next.config";

describe("next.config", () => {
  test("los formularios aceptan hasta 4,5 MB: una foto de celular pasa el tope de 1 MB de Next", () => {
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("4.5mb");
  });

  test("todas las paginas llevan las cabeceras de seguridad", async () => {
    const reglas = await config.headers!();
    expect(reglas).toHaveLength(1);
    expect(reglas[0]!.source).toBe("/:path*");
    const cabeceras = Object.fromEntries(reglas[0]!.headers.map((h) => [h.key, h.value]));
    expect(cabeceras["X-Frame-Options"]).toBe("DENY");
    expect(cabeceras["X-Content-Type-Options"]).toBe("nosniff");
    expect(cabeceras["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    expect(cabeceras["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(cabeceras["Content-Security-Policy"]).toContain("form-action 'self' https://accounts.google.com");
    expect(config.poweredByHeader).toBe(false);
  });
});
