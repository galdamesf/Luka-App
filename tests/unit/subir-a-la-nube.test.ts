import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  TABLAS,
  boletasEnUso,
  compararMigraciones,
  contar,
  credencialesDeBlob,
  llavePrimaria,
  loQueSePierde,
  nadaSePierde,
  ordenarFilas,
  urlDeLaNube,
  type Datos,
  type Fila,
  type Tabla,
} from "@/dominio/subir-a-la-nube";
import {
  boletasEnElBlob,
  boletasQueNoCalzan,
  planDeBoletas,
  subirBoletas,
  type BoletaLocal,
} from "@/lib/boletas-a-la-nube";
import type { SdkDeBlob } from "@/lib/almacen-boletas";

function vacio(): Datos {
  return Object.fromEntries(TABLAS.map((t) => [t, []])) as unknown as Datos;
}

function con(parcial: Partial<Record<Tabla, Fila[]>>): Datos {
  return { ...vacio(), ...parcial };
}

describe("el orden de las tablas", () => {
  // A que apunta cada una con sus llaves foraneas (prisma/schema.prisma).
  const APUNTA_A: Record<Tabla, Tabla[]> = {
    hogar: [],
    miembro: ["hogar"],
    categoria: ["hogar"],
    deuda: ["hogar"],
    sueldo: ["hogar"],
    ahorro: ["hogar"],
    ajustes: ["hogar"],
    gasto: ["hogar", "categoria", "miembro"],
    cuenta: ["hogar", "categoria", "gasto"],
    cuotaPagada: ["deuda", "gasto"],
    presupuesto: ["hogar", "categoria"],
  };

  test("cada tabla va despues de las que apunta, asi se puede insertar en orden", () => {
    for (const tabla of TABLAS) {
      for (const apuntada of APUNTA_A[tabla]) {
        expect(TABLAS.indexOf(apuntada), `${tabla} → ${apuntada}`).toBeLessThan(TABLAS.indexOf(tabla));
      }
    }
  });

  test("estan todas las del esquema que guardan datos, una vez cada una", () => {
    expect([...TABLAS].sort()).toEqual(Object.keys(APUNTA_A).sort());
    expect(new Set(TABLAS).size).toBe(TABLAS.length);
  });
});

describe("la llave y el orden de las filas", () => {
  test("la llave es el id, salvo en ajustes, que es el hogar", () => {
    expect(llavePrimaria("gasto", { id: "g1", hogarId: "h1" })).toBe("g1");
    expect(llavePrimaria("ajustes", { hogarId: "h1", diaInicioMes: 27 })).toBe("h1");
  });

  test("ordena caracter a caracter, igual en cualquier base", () => {
    // En es_CL, Postgres ignora el guion y pondria "hogar-inicial" despues de "hogara".
    const filas = [{ id: "hogara" }, { id: "hogar-inicial" }, { id: "Z" }, { id: "cmw1" }];
    expect(ordenarFilas("hogar", filas).map((f) => f.id)).toEqual(["Z", "cmw1", "hogar-inicial", "hogara"]);
  });

  test("no cambia la lista que recibe", () => {
    const filas = [{ id: "b" }, { id: "a" }];
    ordenarFilas("hogar", filas);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
  });

  test("contar da las filas de cada tabla", () => {
    const conteo = contar(con({ gasto: [{ id: "1" }, { id: "2" }], hogar: [{ id: "h" }] }));
    expect(conteo.gasto).toBe(2);
    expect(conteo.hogar).toBe(1);
    expect(conteo.cuenta).toBe(0);
  });
});

describe("compararMigraciones", () => {
  test("iguales aunque vengan en otro orden", () => {
    expect(compararMigraciones(["b", "a"], ["a", "b"])).toEqual({ iguales: true, soloEnOrigen: [], soloEnDestino: [] });
  });

  test("dice cuales faltan en cada lado", () => {
    const r = compararMigraciones(["a", "b", "c"], ["a", "d"]);
    expect(r.iguales).toBe(false);
    expect(r.soloEnOrigen).toEqual(["b", "c"]);
    expect(r.soloEnDestino).toEqual(["d"]);
  });
});

describe("loQueSePierde", () => {
  const mac = con({
    hogar: [{ id: "hogar-inicial" }],
    miembro: [{ id: "m-mac", correo: "yo@gmail.com", hogarId: "hogar-inicial" }],
    gasto: [{ id: "g1" }],
    ajustes: [{ hogarId: "hogar-inicial" }],
  });

  test("la nube recien creada no pierde nada: el hogar inicial y tu correo estan en tu Mac", () => {
    // Al entrar a la nube se te creo otro id, pero el correo es el mismo.
    const nube = con({
      hogar: [{ id: "hogar-inicial" }],
      miembro: [{ id: "m-nube", correo: "yo@gmail.com", hogarId: "hogar-inicial" }],
    });
    const perdida = loQueSePierde(mac, nube);
    expect(perdida).toEqual({ filas: [], correos: [] });
    expect(nadaSePierde(perdida)).toBe(true);
  });

  test("otra persona que ya entro a la nube, con su hogar y sus gastos, se perderia", () => {
    const nube = con({
      hogar: [{ id: "hogar-inicial" }, { id: "h-otro" }],
      miembro: [
        { id: "m-nube", correo: "yo@gmail.com", hogarId: "hogar-inicial" },
        { id: "m-otro", correo: "otra@gmail.com", hogarId: "h-otro" },
      ],
      gasto: [{ id: "g1" }, { id: "g-otro" }],
    });
    const perdida = loQueSePierde(mac, nube);
    expect(perdida.filas).toEqual([
      { tabla: "hogar", cuantas: 1 },
      { tabla: "miembro", cuantas: 1 },
      { tabla: "gasto", cuantas: 1 },
    ]);
    expect(perdida.correos).toEqual(["otra@gmail.com"]);
    expect(nadaSePierde(perdida)).toBe(false);
  });

  test("un gasto anotado en la nube que no esta en tu Mac tambien se perderia", () => {
    const nube = con({ hogar: [{ id: "hogar-inicial" }], gasto: [{ id: "g-nuevo" }] });
    expect(loQueSePierde(mac, nube).filas).toEqual([{ tabla: "gasto", cuantas: 1 }]);
  });
});

describe("urlDeLaNube", () => {
  const LOCAL = "postgresql://gastos:gastos_local@localhost:5433/control_gastos?schema=public";
  const NEON = "postgresql://usuario:clave@ep-algo.sa-east-1.aws.neon.tech/neondb?sslmode=require";
  const NEON_POOL = "postgresql://usuario:clave@ep-algo-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

  test("prefiere la conexion directa (UNPOOLED) a la del pool", () => {
    const variables = new Map([
      ["DATABASE_URL", NEON_POOL],
      ["DATABASE_URL_UNPOOLED", NEON],
    ]);
    expect(urlDeLaNube(variables, LOCAL)).toBe(NEON);
  });

  test("acepta NUBE_DATABASE_URL o, a falta de otra, DATABASE_URL", () => {
    expect(urlDeLaNube(new Map([["NUBE_DATABASE_URL", NEON]]), LOCAL)).toBe(NEON);
    expect(urlDeLaNube(new Map([["DATABASE_URL", NEON_POOL]]), LOCAL)).toBe(NEON_POOL);
  });

  test("sin ninguna, dice que linea pegar", () => {
    expect(() => urlDeLaNube(new Map(), LOCAL)).toThrow(/DATABASE_URL_UNPOOLED/);
    expect(() => urlDeLaNube(new Map([["DATABASE_URL_UNPOOLED", "  "]]), LOCAL)).toThrow(/DATABASE_URL_UNPOOLED/);
  });

  test("NUNCA acepta tu propio computador: copiaria tu Mac sobre tu Mac", () => {
    for (const host of ["localhost:5433", "127.0.0.1:5433", "[::1]:5433"]) {
      const url = `postgresql://gastos:x@${host}/control_gastos`;
      expect(() => urlDeLaNube(new Map([["DATABASE_URL_UNPOOLED", url]]), LOCAL), host).toThrow(/tu propio computador/);
    }
    expect(() => urlDeLaNube(new Map([["DATABASE_URL_UNPOOLED", LOCAL]]), LOCAL)).toThrow(/tu propio computador/);
  });

  test("rechaza lo que no es una URL de Postgres", () => {
    expect(() => urlDeLaNube(new Map([["DATABASE_URL_UNPOOLED", "no es una url"]]), LOCAL)).toThrow(/no es una URL/);
    expect(() => urlDeLaNube(new Map([["DATABASE_URL_UNPOOLED", "https://neon.tech"]]), LOCAL)).toThrow(/Postgres/);
  });
});

describe("credencialesDeBlob", () => {
  test("lo normal: el id del almacen con el token OIDC de vercel env pull", () => {
    const c = credencialesDeBlob(new Map([["BLOB_STORE_ID", "store_x"], ["VERCEL_OIDC_TOKEN", "eyJ"], ["OTRA", "y"]]));
    expect(c).toEqual({ variables: { BLOB_STORE_ID: "store_x", VERCEL_OIDC_TOKEN: "eyJ" }, modo: "oidc" });
  });

  test("o un token de lectura y escritura", () => {
    expect(credencialesDeBlob(new Map([["BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_x"]]))).toEqual({
      variables: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" },
      modo: "token",
    });
  });

  test("el id solo, sin token, no sirve", () => {
    expect(credencialesDeBlob(new Map([["BLOB_STORE_ID", "store_x"]]))).toBeNull();
    expect(credencialesDeBlob(new Map())).toBeNull();
  });
});

describe("boletasEnUso", () => {
  test("las de gastos y cuentas, una vez cada una, sin las vacias, ordenadas", () => {
    const enUso = boletasEnUso({
      gasto: [
        { hogarId: "h2", boletaArchivo: "b.jpg" },
        { hogarId: "h1", boletaArchivo: "a.pdf" },
        { hogarId: "h1", boletaArchivo: null },
      ],
      cuenta: [
        { hogarId: "h1", boletaArchivo: "a.pdf" },
        { hogarId: "h1", boletaArchivo: "c.png" },
      ],
    });
    expect(enUso).toEqual([
      { hogarId: "h1", nombre: "a.pdf" },
      { hogarId: "h1", nombre: "c.png" },
      { hogarId: "h2", nombre: "b.jpg" },
    ]);
  });
});

/** Un Vercel Blob de mentira con lo que usa la subida: put y list (con el tamano). */
function blobEnMemoria(porPagina = 2) {
  const guardados = new Map<string, { bytes: Uint8Array; tipo: string; access: string }>();
  const sdk = {
    async put(ruta: string, cuerpo: Buffer, opciones: { access: string; contentType: string; allowOverwrite: boolean }) {
      if (guardados.has(ruta) && !opciones.allowOverwrite) throw new Error("ya existe");
      guardados.set(ruta, { bytes: new Uint8Array(cuerpo), tipo: opciones.contentType, access: opciones.access });
      return { pathname: ruta } as never;
    },
    async list(opciones: { prefix: string; cursor?: string }) {
      const todas = [...guardados.keys()].filter((k) => k.startsWith(opciones.prefix)).sort();
      const desde = Number(opciones.cursor ?? 0);
      const pagina = todas.slice(desde, desde + porPagina);
      const hasMore = desde + porPagina < todas.length;
      return {
        blobs: pagina.map((pathname) => ({ pathname, size: guardados.get(pathname)!.bytes.length })),
        hasMore,
        cursor: hasMore ? String(desde + porPagina) : undefined,
      } as never;
    },
  };
  return { sdk: sdk as unknown as SdkDeBlob, guardados };
}

const N = (letra: string, ext = "jpg") => `${letra.repeat(32)}.${ext}`;
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

describe("las boletas a la nube", () => {
  let raiz: string;
  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), "nube-"));
    await mkdir(join(raiz, "hogar-inicial"));
    await writeFile(join(raiz, "hogar-inicial", N("a")), JPG);
    await writeFile(join(raiz, "hogar-inicial", N("b", "pdf")), PDF);
    // Una de antes de los hogares, todavia suelta.
    await writeFile(join(raiz, N("c")), JPG);
  });
  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  test("el plan: subir las que faltan, saltar las que ya estan y avisar las que no calzan o no existen", async () => {
    const enBlob = new Map([
      [`boletas/hogar-inicial/${N("a")}`, JPG.length],
      [`boletas/hogar-inicial/${N("b", "pdf")}`, 999],
    ]);
    const plan = await planDeBoletas(
      [
        { hogarId: "hogar-inicial", nombre: N("a") },
        { hogarId: "hogar-inicial", nombre: N("b", "pdf") },
        { hogarId: "hogar-inicial", nombre: N("c") },
        { hogarId: "hogar-inicial", nombre: N("d") },
        { hogarId: "hogar-inicial", nombre: "../../.ssh/id_rsa" },
      ],
      raiz,
      enBlob,
    );
    expect(plan.yaEstan.map((b) => b.nombre)).toEqual([N("a")]);
    expect(plan.distintas.map((b) => b.nombre)).toEqual([N("b", "pdf")]);
    // La suelta se encuentra en la carpeta de boletas y sube a la de su hogar.
    expect(plan.subir).toEqual([
      { hogarId: "hogar-inicial", nombre: N("c"), ruta: join(raiz, N("c")), bytes: JPG.length },
    ]);
    expect(plan.faltanEnDisco.map((b) => b.nombre)).toEqual([N("d"), "../../.ssh/id_rsa"]);
  });

  test("sube privadas, en boletas/<hogar>/<nombre>, con su tipo y sin pisar; despues calzan todas", async () => {
    const { sdk, guardados } = blobEnMemoria();
    const plan = await planDeBoletas(
      [
        { hogarId: "hogar-inicial", nombre: N("a") },
        { hogarId: "hogar-inicial", nombre: N("b", "pdf") },
        { hogarId: "hogar-inicial", nombre: N("c") },
      ],
      raiz,
      await boletasEnElBlob(sdk),
    );
    expect(plan.subir).toHaveLength(3);

    const avisos: number[] = [];
    expect(await subirBoletas(plan.subir, sdk, (_b, n) => avisos.push(n))).toBe(3);
    expect(avisos).toEqual([1, 2, 3]);

    const pdf = guardados.get(`boletas/hogar-inicial/${N("b", "pdf")}`)!;
    expect(pdf).toEqual({ bytes: PDF, tipo: "application/pdf", access: "private" });
    expect(guardados.get(`boletas/hogar-inicial/${N("c")}`)?.tipo).toBe("image/jpeg");

    // Lee las tres paginas del Blob (de a 2) y todas calzan.
    const enBlob = await boletasEnElBlob(sdk);
    expect(enBlob.size).toBe(3);
    expect(boletasQueNoCalzan(plan.subir, enBlob)).toEqual([]);

    // Repetir no sube nada mas.
    const otraVez = await planDeBoletas([{ hogarId: "hogar-inicial", nombre: N("a") }], raiz, enBlob);
    expect(otraVez.subir).toEqual([]);
    expect(otraVez.yaEstan).toHaveLength(1);
  });

  test("boletasQueNoCalzan avisa las que faltan o tienen otro tamano", () => {
    const local = (nombre: string, bytes: number): BoletaLocal => ({ hogarId: "h", nombre, ruta: "x", bytes });
    const enBlob = new Map([
      [`boletas/h/${N("a")}`, 10],
      [`boletas/h/${N("b")}`, 11],
    ]);
    const noCalzan = boletasQueNoCalzan([local(N("a"), 10), local(N("b"), 12), local(N("c"), 5)], enBlob);
    expect(noCalzan.map((b) => b.nombre)).toEqual([N("b"), N("c")]);
  });
});
