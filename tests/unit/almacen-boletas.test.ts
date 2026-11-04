import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  almacenDelEntorno,
  almacenEnBlob,
  almacenEnDisco,
  guardarBoletaDelHogar,
  rutaEnBlob,
  type AlmacenDeBoletas,
  type SdkDeBlob,
} from "@/lib/almacen-boletas";

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...new Array(24).fill(0)]);
const archivo = (bytes: Uint8Array, type = "image/jpeg") => ({
  type,
  size: bytes.length,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
});
const NOMBRE = `${"a".repeat(32)}.jpg`;

/** Un Vercel Blob de mentira, en memoria, con lo que Luka usa del SDK. */
function blobEnMemoria() {
  const guardados = new Map<string, { bytes: Uint8Array; tipo: string; access: string }>();
  const llamadas: string[] = [];
  const sdk = {
    async put(ruta: string, cuerpo: Buffer, opciones: { access: string; contentType?: string; allowOverwrite?: boolean; addRandomSuffix?: boolean }) {
      llamadas.push(`put ${ruta} ${opciones.access} sufijo=${opciones.addRandomSuffix} pisar=${opciones.allowOverwrite}`);
      if (guardados.has(ruta) && !opciones.allowOverwrite) throw new Error("ya existe");
      guardados.set(ruta, { bytes: new Uint8Array(cuerpo), tipo: opciones.contentType ?? "", access: opciones.access });
      return { pathname: ruta } as never;
    },
    async get(ruta: string, opciones: { access: string }) {
      llamadas.push(`get ${ruta} ${opciones.access}`);
      const g = guardados.get(ruta);
      if (!g) return null;
      return { statusCode: 200, stream: new Response(new Uint8Array(g.bytes)).body!, headers: new Headers(), blob: {} } as never;
    },
    async list(opciones: { prefix: string; cursor?: string; limit?: number }) {
      llamadas.push(`list ${opciones.prefix} ${opciones.cursor ?? "-"}`);
      // De a 2, para probar que sigue las paginas.
      const todas = [...guardados.keys()].filter((k) => k.startsWith(opciones.prefix)).sort();
      const desde = Number(opciones.cursor ?? 0);
      const pagina = todas.slice(desde, desde + 2);
      const hasMore = desde + 2 < todas.length;
      return { blobs: pagina.map((pathname) => ({ pathname })), hasMore, cursor: hasMore ? String(desde + 2) : undefined } as never;
    },
    async del(rutas: string[] | string) {
      for (const r of [rutas].flat()) {
        llamadas.push(`del ${r}`);
        guardados.delete(r);
      }
    },
  };
  return { sdk: sdk as unknown as SdkDeBlob, guardados, llamadas };
}

let raiz: string;
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "almacen-"));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

/** Lo mismo se tiene que cumplir en los dos almacenes. */
describe.each<[string, () => AlmacenDeBoletas]>([
  ["disco", () => almacenEnDisco(raiz)],
  ["blob", () => almacenEnBlob(blobEnMemoria().sdk)],
])("el almacen en %s", (_nombre, crear) => {
  test("guarda y lee una boleta en su hogar", async () => {
    const almacen = crear();
    await almacen.escribir("h1", NOMBRE, JPG, "image/jpeg");
    expect(await almacen.leer("h1", NOMBRE)).toEqual(JPG);
  });

  test("la boleta de otro hogar no existe aqui, aunque se sepa su nombre", async () => {
    const almacen = crear();
    await almacen.escribir("h1", NOMBRE, JPG, "image/jpeg");
    expect(await almacen.leer("h2", NOMBRE)).toBeNull();
    expect(await almacen.leer("h1", `${"b".repeat(32)}.jpg`)).toBeNull();
  });

  test("no pisa una boleta que ya existe", async () => {
    const almacen = crear();
    await almacen.escribir("h1", NOMBRE, JPG, "image/jpeg");
    await expect(almacen.escribir("h1", NOMBRE, new Uint8Array([1, 2, 3]), "image/jpeg")).rejects.toThrow();
    expect(await almacen.leer("h1", NOMBRE)).toEqual(JPG);
  });

  test("borrar un hogar borra todas sus boletas y ninguna de otro", async () => {
    const almacen = crear();
    const nombres = ["a", "b", "c", "d", "e"].map((l) => `${l.repeat(32)}.jpg`);
    for (const n of nombres) await almacen.escribir("h1", n, JPG, "image/jpeg");
    await almacen.escribir("h2", NOMBRE, JPG, "image/jpeg");

    await almacen.borrarDelHogar("h1");

    for (const n of nombres) expect(await almacen.leer("h1", n)).toBeNull();
    expect(await almacen.leer("h2", NOMBRE)).toEqual(JPG);
  });

  test("un hogar o un nombre sin forma de id no se vuelven ruta", async () => {
    const almacen = crear();
    await expect(almacen.escribir("../otro", NOMBRE, JPG, "image/jpeg")).rejects.toThrow(/no valido/);
    await expect(almacen.escribir("h1", "../../x.jpg", JPG, "image/jpeg")).rejects.toThrow();
    await expect(almacen.borrarDelHogar("a/b")).rejects.toThrow(/no valido/);
  });
});

describe("el almacen en Vercel Blob", () => {
  test("es privado, con la ruta boletas/<hogar>/<nombre> y sin sufijos al azar", async () => {
    const { sdk, guardados, llamadas } = blobEnMemoria();
    await almacenEnBlob(sdk).escribir("h1", NOMBRE, JPG, "image/jpeg");
    expect(rutaEnBlob("h1", NOMBRE)).toBe(`boletas/h1/${NOMBRE}`);
    expect(guardados.get(`boletas/h1/${NOMBRE}`)).toMatchObject({ tipo: "image/jpeg", access: "private" });
    expect(llamadas[0]).toBe(`put boletas/h1/${NOMBRE} private sufijo=false pisar=false`);
  });

  test("lee siempre en privado", async () => {
    const { sdk, llamadas } = blobEnMemoria();
    await almacenEnBlob(sdk).leer("h1", NOMBRE);
    expect(llamadas).toEqual([`get boletas/h1/${NOMBRE} private`]);
  });

  test("al borrar un hogar recorre todas las paginas de la lista", async () => {
    const { sdk, llamadas } = blobEnMemoria();
    const almacen = almacenEnBlob(sdk);
    for (const l of ["a", "b", "c", "d", "e"]) await almacen.escribir("h1", `${l.repeat(32)}.jpg`, JPG, "image/jpeg");
    await almacen.borrarDelHogar("h1");
    expect(llamadas.filter((l) => l.startsWith("list"))).toEqual(["list boletas/h1/ -", "list boletas/h1/ 2", "list boletas/h1/ 4"]);
    expect(llamadas.filter((l) => l.startsWith("del"))).toHaveLength(5);
  });
});

describe("almacenDelEntorno", () => {
  test("con un Blob conectado, Blob; si no, el disco", () => {
    expect(almacenDelEntorno({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" }).tipo).toBe("blob");
    expect(almacenDelEntorno({ BLOB_STORE_ID: "store_x" }).tipo).toBe("blob");
    expect(almacenDelEntorno({}).tipo).toBe("disco");
    expect(almacenDelEntorno({ BLOB_READ_WRITE_TOKEN: "  " }).tipo).toBe("disco");
  });

  test("en Vercel sin Blob falla claro, en vez de guardar en un disco que se pierde", () => {
    expect(() => almacenDelEntorno({ VERCEL: "1" })).toThrow(/Vercel Blob/);
  });
});

describe("guardarBoletaDelHogar", () => {
  test("valida, le da nombre y la guarda en el hogar", async () => {
    const almacen = almacenEnDisco(raiz);
    const r = await guardarBoletaDelHogar(archivo(JPG), "h1", almacen);
    if (!r.ok) throw new Error(r.motivo);
    expect(await readdir(join(raiz, "h1"))).toEqual([r.archivo]);
    expect(await almacen.leer("h1", r.archivo)).toEqual(JPG);
  });

  test("lo que no pasa la validacion no llega al almacen", async () => {
    const { sdk, llamadas } = blobEnMemoria();
    const r = await guardarBoletaDelHogar(archivo(new Uint8Array([1, 2, 3, ...new Array(20).fill(0)])), "h1", almacenEnBlob(sdk));
    expect(r).toMatchObject({ ok: false });
    expect(llamadas).toEqual([]);
  });

  test("si el almacen falla, lo dice en vez de reventar", async () => {
    const roto: AlmacenDeBoletas = {
      tipo: "blob",
      escribir: async () => {
        throw new Error("sin red");
      },
      leer: async () => null,
      borrarDelHogar: async () => {},
    };
    expect(await guardarBoletaDelHogar(archivo(JPG), "h1", roto)).toEqual({
      ok: false,
      motivo: "No se pudo guardar el archivo. Intenta de nuevo.",
    });
  });
});
