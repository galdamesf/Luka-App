import { describe, expect, test } from "vitest";
import { darPermisoDeGmail } from "@/lib/permiso-de-gmail";

/*
  Luka abre el enlace con que Gmail pide aceptar el reenvio, como lo haria
  la persona. Sin red: la respuesta de Google es de mentira.
*/

const ENLACE = "https://mail-settings.google.com/mail/vf-%5BANGjdJ9x2Qa7%5D-Zq8w3Lk1mN0pR5tY";

function respondeCon(cuerpo: string, estado = 200) {
  const pedidos: string[] = [];
  const buscar = (async (url: string | URL | Request) => {
    pedidos.push(String(url));
    return new Response(cuerpo, { status: estado });
  }) as typeof fetch;
  return { buscar, pedidos };
}

describe("dar el permiso de Gmail", () => {
  test("abre el enlace una vez, y queda dado si Gmail dice que se acepto", async () => {
    const { buscar, pedidos } = respondeCon("<h1>¡Confirmación exitosa!</h1> camila@gmail.com ahora puede reenviar mensajes a luka");
    expect(await darPermisoDeGmail(ENLACE, { buscar })).toBe(true);
    expect(pedidos).toEqual([ENLACE]);
    expect(await darPermisoDeGmail(ENLACE, { buscar: respondeCon("<h1>Confirmation Success!</h1>").buscar })).toBe(true);
  });

  test("con otra pagina, un error o sin respuesta, no queda dado", async () => {
    expect(await darPermisoDeGmail(ENLACE, { buscar: respondeCon("<h1>Iniciar sesión</h1>").buscar })).toBe(false);
    expect(await darPermisoDeGmail(ENLACE, { buscar: respondeCon("Confirmación exitosa", 404).buscar })).toBe(false);
    const caido = (async () => {
      throw new Error("sin red");
    }) as typeof fetch;
    expect(await darPermisoDeGmail(ENLACE, { buscar: caido })).toBe(false);
  });

  test("un enlace que no es el de aceptar de Google ni se abre", async () => {
    for (const malo of ["https://mail-settings.google.com/mail/uf-%5Babc%5D", "https://evil.cl/mail/vf-abc", "http://mail.google.com/mail/vf-abc"]) {
      const { buscar, pedidos } = respondeCon("Confirmación exitosa");
      expect(await darPermisoDeGmail(malo, { buscar })).toBe(false);
      expect(pedidos).toEqual([]);
    }
  });
});
