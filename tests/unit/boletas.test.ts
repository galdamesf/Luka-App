import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  eliminarBoleta,
  firmaCorresponde,
  guardarBoleta,
  leerBoleta,
  nombreValido,
  rutaDeBoleta,
  TAMANO_MAXIMO,
  tipoDeBoleta,
} from "@/lib/boletas";

let carpeta: string;

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), "boletas-"));
});

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true });
});

/** Archivos minimos con la firma correcta y relleno hasta pasar los 12 bytes. */
function bytesDe(tipo: "jpg" | "png" | "webp" | "pdf" | "heic"): Uint8Array {
  const relleno = new Array(24).fill(0x00);
  const cabeceras: Record<string, number[]> = {
    jpg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01],
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d],
    webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
    pdf: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00],
    // ....ftypheic
    heic: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
  };
  return new Uint8Array([...(cabeceras[tipo] as number[]), ...relleno]);
}

/** Imita lo justo de un File del navegador. */
function archivoFalso(bytes: Uint8Array, type: string, name = "boleta.jpg") {
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

describe("guardar una boleta valida", () => {
  test("guarda y devuelve un nombre generado", async () => {
    const r = await guardarBoleta(archivoFalso(bytesDe("jpg"), "image/jpeg"), carpeta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.archivo).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(await readdir(carpeta)).toEqual([r.archivo]);
  });

  test("acepta los cinco tipos permitidos", async () => {
    const casos = [
      ["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"],
      ["heic", "image/heic"], ["pdf", "application/pdf"],
    ] as const;
    for (const [ext, mime] of casos) {
      const r = await guardarBoleta(archivoFalso(bytesDe(ext), mime), carpeta);
      expect(r.ok, `fallo con ${mime}`).toBe(true);
      if (r.ok) expect(r.archivo.endsWith(`.${ext}`)).toBe(true);
    }
  });

  test("dos archivos iguales no se pisan", async () => {
    const a = await guardarBoleta(archivoFalso(bytesDe("png"), "image/png"), carpeta);
    const b = await guardarBoleta(archivoFalso(bytesDe("png"), "image/png"), carpeta);
    expect(a.ok && b.ok && a.archivo !== b.archivo).toBe(true);
    expect(await readdir(carpeta)).toHaveLength(2);
  });

  test("lo guardado se puede leer de vuelta igual", async () => {
    const original = bytesDe("png");
    const r = await guardarBoleta(archivoFalso(original, "image/png"), carpeta);
    if (!r.ok) throw new Error("no se guardo");
    expect(Array.from(await leerBoleta(r.archivo, carpeta))).toEqual(Array.from(original));
  });
});

describe("el nombre del navegador NO llega al disco", () => {
  test("un nombre con ruta no se usa para nada", async () => {
    const r = await guardarBoleta(
      archivoFalso(bytesDe("jpg"), "image/jpeg", "../../../.ssh/id_rsa"),
      carpeta,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.archivo).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(r.archivo).not.toContain("..");
    expect(r.archivo).not.toContain("/");
    expect(r.archivo).not.toContain("id_rsa");
    // Y solo aparecio un archivo, dentro de la carpeta.
    expect(await readdir(carpeta)).toEqual([r.archivo]);
  });

  test("tampoco se usa la extension que venga en el nombre", async () => {
    const r = await guardarBoleta(
      archivoFalso(bytesDe("png"), "image/png", "cosa.php"),
      carpeta,
    );
    expect(r.ok && r.archivo.endsWith(".png")).toBe(true);
  });
});

describe("archivos que mienten sobre lo que son", () => {
  test("rechaza un ejecutable disfrazado de JPG", async () => {
    // Firma de ELF, tipo declarado image/jpeg.
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, ...new Array(24).fill(0)]);
    const r = await guardarBoleta(archivoFalso(elf, "image/jpeg"), carpeta);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/no parece ser del tipo/i);
    expect(await readdir(carpeta)).toEqual([]);
  });

  test("rechaza un PNG declarado como PDF", async () => {
    const r = await guardarBoleta(archivoFalso(bytesDe("png"), "application/pdf"), carpeta);
    expect(r.ok).toBe(false);
  });

  test("rechaza un tipo que no esta en la lista", async () => {
    const r = await guardarBoleta(archivoFalso(bytesDe("jpg"), "image/svg+xml"), carpeta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/JPG, PNG, WEBP, HEIC/i);
  });

  test("rechaza algo demasiado corto para tener firma", async () => {
    const r = await guardarBoleta(archivoFalso(new Uint8Array([0xff, 0xd8]), "image/jpeg"), carpeta);
    expect(r.ok).toBe(false);
  });
});

describe("tamano", () => {
  test("rechaza el vacio", async () => {
    const r = await guardarBoleta(archivoFalso(new Uint8Array(0), "image/jpeg"), carpeta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/vac/i);
  });

  test("rechaza lo que pasa el tope sin leerlo siquiera", async () => {
    const gigante = {
      name: "grande.jpg",
      type: "image/jpeg",
      size: TAMANO_MAXIMO + 1,
      arrayBuffer: async () => {
        throw new Error("no deberia leerse un archivo que ya sabemos que no cabe");
      },
    };
    const r = await guardarBoleta(gigante, carpeta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/10 MB/);
  });
});

describe("nombreValido", () => {
  test("acepta lo que generamos nosotros", () => {
    expect(nombreValido("a".repeat(32).replace(/a/g, "0") + ".jpg")).toBe(true);
    expect(nombreValido("0123456789abcdef0123456789abcdef.pdf")).toBe(true);
  });

  test("rechaza intentos de salirse de la carpeta", () => {
    for (const malo of [
      "../../../etc/passwd",
      "..%2F..%2Fetc%2Fpasswd",
      "/etc/passwd",
      "subcarpeta/0123456789abcdef0123456789abcdef.jpg",
      "0123456789abcdef0123456789abcdef.jpg/../../x",
    ]) {
      expect(nombreValido(malo), `acepto "${malo}"`).toBe(false);
    }
  });

  test("rechaza extensiones y largos que no son los nuestros", () => {
    for (const malo of [
      "0123456789abcdef0123456789abcdef.exe",
      "0123456789abcdef0123456789abcdef.php",
      "corto.jpg",
      "0123456789ABCDEF0123456789ABCDEF.jpg", // mayusculas
      "0123456789abcdef0123456789abcdef",     // sin extension
      "",
    ]) {
      expect(nombreValido(malo), `acepto "${malo}"`).toBe(false);
    }
  });
});

describe("rutaDeBoleta", () => {
  test("arma la ruta dentro de la carpeta", () => {
    const nombre = "0123456789abcdef0123456789abcdef.jpg";
    expect(rutaDeBoleta(nombre, carpeta)).toBe(join(carpeta, nombre));
  });

  test("lanza con cualquier nombre que no sea nuestro", () => {
    for (const malo of ["../x.jpg", "/etc/passwd", "x.exe"]) {
      expect(() => rutaDeBoleta(malo, carpeta), `no lanzo con "${malo}"`).toThrow(/no valido/i);
    }
  });
});

describe("eliminarBoleta", () => {
  test("borra la que existe", async () => {
    const r = await guardarBoleta(archivoFalso(bytesDe("jpg"), "image/jpeg"), carpeta);
    if (!r.ok) throw new Error("no se guardo");
    await eliminarBoleta(r.archivo, carpeta);
    expect(await readdir(carpeta)).toEqual([]);
  });

  test("no reclama si ya no esta", async () => {
    await expect(
      eliminarBoleta("0123456789abcdef0123456789abcdef.jpg", carpeta),
    ).resolves.toBeUndefined();
  });

  test("un nombre invalido no borra nada ni explota", async () => {
    await writeFile(join(carpeta, "importante.txt"), "no me borres");
    await eliminarBoleta("../importante.txt", carpeta);
    await eliminarBoleta("importante.txt", carpeta);
    expect(await readdir(carpeta)).toContain("importante.txt");
  });
});

describe("firmaCorresponde y tipoDeBoleta", () => {
  test("cada firma reconoce lo suyo y rechaza lo ajeno", () => {
    expect(firmaCorresponde(bytesDe("jpg"), "jpg")).toBe(true);
    expect(firmaCorresponde(bytesDe("png"), "jpg")).toBe(false);
    expect(firmaCorresponde(bytesDe("pdf"), "pdf")).toBe(true);
    expect(firmaCorresponde(bytesDe("webp"), "webp")).toBe(true);
    expect(firmaCorresponde(bytesDe("heic"), "heic")).toBe(true);
  });

  test("devuelve el MIME que corresponde servir", () => {
    expect(tipoDeBoleta("0123456789abcdef0123456789abcdef.jpg")).toBe("image/jpeg");
    expect(tipoDeBoleta("0123456789abcdef0123456789abcdef.pdf")).toBe("application/pdf");
    expect(tipoDeBoleta("cosa.rara")).toBe("application/octet-stream");
  });
});
