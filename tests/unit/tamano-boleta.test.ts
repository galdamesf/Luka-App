import { describe, expect, test } from "vitest";
import {
  ACHICAR_DESDE,
  megas,
  nombreAchicado,
  queHacerConLaBoleta,
  TAMANO_MAXIMO_BOLETA,
} from "@/dominio/tamano-boleta";
import { TAMANO_MAXIMO } from "@/lib/boletas";

const MB = 1024 * 1024;

describe("cuanto puede pesar una boleta", () => {
  test("el tope es 4 MB, bajo los 4,5 MB que acepta Vercel, y el servidor usa el mismo", () => {
    expect(TAMANO_MAXIMO_BOLETA).toBe(4 * MB);
    expect(TAMANO_MAXIMO).toBe(TAMANO_MAXIMO_BOLETA);
    expect(ACHICAR_DESDE).toBeLessThan(TAMANO_MAXIMO_BOLETA);
  });

  test("hasta 3 MB se sube tal cual, sea foto o PDF", () => {
    expect(queHacerConLaBoleta("image/jpeg", 3 * MB)).toBe("subir");
    expect(queHacerConLaBoleta("application/pdf", 1 * MB)).toBe("subir");
  });

  test("una foto de mas de 3 MB se achica, aunque pese 12", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(queHacerConLaBoleta(tipo, 3 * MB + 1), tipo).toBe("achicar");
      expect(queHacerConLaBoleta(tipo, 12 * MB), tipo).toBe("achicar");
    }
  });

  test("un PDF no se puede achicar: hasta 4 MB pasa, mas se rechaza", () => {
    expect(queHacerConLaBoleta("application/pdf", 3.5 * MB)).toBe("subir");
    expect(queHacerConLaBoleta("application/pdf", 4 * MB + 1)).toBe("rechazar");
  });

  test("megas y el nombre de la foto achicada", () => {
    expect(megas(3.2 * MB)).toBe("3,2 MB");
    expect(megas(4 * MB)).toBe("4 MB");
    expect(megas(11.73 * MB)).toBe("11,7 MB");
    expect(nombreAchicado("IMG_1234.HEIC")).toBe("IMG_1234.jpg");
    expect(nombreAchicado("boleta.png")).toBe("boleta.jpg");
    expect(nombreAchicado(".png")).toBe("boleta.jpg");
  });
});
