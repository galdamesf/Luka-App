import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar, miembroDePrueba } from "./base";
import {
  agregarCorreo,
  confirmarCorreo,
  correosConfirmados,
  leerMisCorreos,
  pedirCodigoDeCorreo,
  quitarCorreo,
  type OpcionesDeCorreo,
} from "@/datos/correos-registrados";
import type { Correo } from "@/lib/correo";

/*
  Los correos registrados contra la base: el codigo llega a ese correo, en
  la base queda solo su huella, se cuentan los intentos y cada persona
  maneja solo los suyos.
*/

let prisma: PrismaClient;
const OTRO = "hogar-de-ana";
const SECRETO = "secreto-de-prueba";
const BUZON = "luka.prueba@gmail.com";
const AHORA = new Date("2026-11-20T15:00:00Z");

let yo: string;
let ana: string;
let enviados: Correo[];

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpiar(prisma);
  yo = await miembroDePrueba(prisma, { correo: "camila@gmail.com", nombre: "Camila Rojas" });
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  ana = await miembroDePrueba(prisma, { hogarId: OTRO, correo: "ana@gmail.com", nombre: "Ana" });
  enviados = [];
});

const opciones = (extra: Partial<OpcionesDeCorreo> = {}): OpcionesDeCorreo => ({
  db: prisma,
  secreto: SECRETO,
  ahora: AHORA,
  buzon: BUZON,
  enviar: async (correo) => {
    enviados.push(correo);
  },
  // Un dominio propio con Google Workspace; los demas, sin MX.
  buscarServidores: async (dominio) => (dominio === "empresa.cl" ? ["aspmx.l.google.com"] : []),
  ...extra,
});

const ultimoCodigo = () => /\b(\d{6})\b/.exec(enviados.at(-1)!.texto)![1]!;
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);

describe("agregar un correo", () => {
  test("llega un codigo a ese correo, y en la base queda solo su huella", async () => {
    const { id, direccion } = await agregarCorreo(HOGAR_INICIAL, yo, "  Camila.Rojas@Hotmail.com ", opciones());
    expect(direccion).toBe("camila.rojas@hotmail.com");
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ para: "camila.rojas@hotmail.com", asunto: "Tu código para conectar este correo con Luka" });
    expect(enviados[0]!.texto.startsWith("Hola, Camila:")).toBe(true);

    const fila = await prisma.correoRegistrado.findUniqueOrThrow({ where: { id } });
    expect(fila).toMatchObject({ miembroId: yo, proveedor: "OUTLOOK", confirmadoEn: null, intentos: 0 });
    expect(fila.huellaDelCodigo).toMatch(/^[0-9a-f]{64}$/);
    expect(fila.huellaDelCodigo).not.toContain(ultimoCodigo());
    expect(fila.codigoVenceEn!.getTime() - AHORA.getTime()).toBe(30 * 60_000);
  });

  test("reconoce Google Workspace detras de un dominio propio", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@empresa.cl", opciones());
    expect((await prisma.correoRegistrado.findUniqueOrThrow({ where: { id } })).proveedor).toBe("GMAIL");
    const { id: otro } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@sin-mx.cl", opciones());
    expect((await prisma.correoRegistrado.findUniqueOrThrow({ where: { id: otro } })).proveedor).toBe("OTRO");
  });

  test("no se agrega un correo mal escrito, el tuyo de Google ni una direccion de Luka", async () => {
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "camila@", opciones())).rejects.toThrow(/correo válido/);
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "CAMILA@gmail.com", opciones())).rejects.toThrow(/tu correo de Google/);
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "luka.prueba+abcd2345ef@gmail.com", opciones())).rejects.toThrow(/dirección de Luka/);
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "lukaprueba@googlemail.com", opciones())).rejects.toThrow(/dirección de Luka/);
    expect(await prisma.correoRegistrado.count()).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  test("hasta cinco correos ademas del de Google", async () => {
    for (let i = 1; i <= 5; i++) await agregarCorreo(HOGAR_INICIAL, yo, `otro${i}@ejemplo.cl`, opciones());
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "otro6@ejemplo.cl", opciones())).rejects.toThrow(/hasta 5 correos/);
  });

  test("sin correo de Luka configurado no se registra nada", async () => {
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones({ enviar: null }))).rejects.toThrow(
      /todavía no puede mandar correos/,
    );
    expect(await prisma.correoRegistrado.count()).toBe(0);
  });

  test("si el correo no sale, el registro queda sin codigo y se puede pedir otro al tiro", async () => {
    await expect(
      agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones({ enviar: async () => Promise.reject(new Error("smtp caído")) })),
    ).rejects.toThrow(/No se pudo mandar/);
    const fila = await prisma.correoRegistrado.findFirstOrThrow();
    expect(fila).toMatchObject({ huellaDelCodigo: null, codigoVenceEn: null, codigoPedidoEn: null });
    await pedirCodigoDeCorreo(HOGAR_INICIAL, yo, fila.id, opciones());
    expect(enviados).toHaveLength(1);
  });

  test("agregarlo otra vez sin confirmar manda otro codigo, despues del minuto", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    await expect(agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones())).rejects.toThrow(/espera 60 segundos/);
    const otra = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones({ ahora: minutos(2) }));
    expect(otra.id).toBe(id);
    expect(enviados).toHaveLength(2);
    expect(await prisma.correoRegistrado.count()).toBe(1);
  });
});

describe("confirmar con el codigo", () => {
  test("con el codigo queda confirmado y empieza a contar para el buzon", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    expect(await correosConfirmados(yo, prisma)).toEqual(["camila@gmail.com"]);

    const codigo = ultimoCodigo();
    await confirmarCorreo(HOGAR_INICIAL, yo, id, ` ${codigo.slice(0, 3)} ${codigo.slice(3)} `, opciones({ ahora: minutos(5) }));
    const fila = await prisma.correoRegistrado.findUniqueOrThrow({ where: { id } });
    expect(fila).toMatchObject({ confirmadoEn: minutos(5), huellaDelCodigo: null, codigoVenceEn: null, intentos: 0 });
    expect(await correosConfirmados(yo, prisma)).toEqual(["camila@gmail.com", "camila@hotmail.com"]);
  });

  test("un codigo equivocado dice cuantos intentos quedan, y al quinto hay que pedir otro", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    const malo = ultimoCodigo() === "000000" ? "111111" : "000000";
    await expect(confirmarCorreo(HOGAR_INICIAL, yo, id, malo, opciones())).rejects.toThrow("Ese código no es. Te quedan 4 intentos.");
    for (let i = 0; i < 3; i++) await confirmarCorreo(HOGAR_INICIAL, yo, id, malo, opciones()).catch(() => undefined);
    await expect(confirmarCorreo(HOGAR_INICIAL, yo, id, malo, opciones())).rejects.toThrow(/se acabaron los intentos/);
    // Ni siquiera el bueno sirve ya.
    await expect(confirmarCorreo(HOGAR_INICIAL, yo, id, ultimoCodigo(), opciones())).rejects.toThrow(/Se acabaron los intentos/);
    expect((await prisma.correoRegistrado.findUniqueOrThrow({ where: { id } })).confirmadoEn).toBeNull();
  });

  test("un codigo vencido no sirve", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    await expect(confirmarCorreo(HOGAR_INICIAL, yo, id, ultimoCodigo(), opciones({ ahora: minutos(31) }))).rejects.toThrow(/venció/);
  });

  test("lo que no son 6 numeros ni se compara", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    await expect(confirmarCorreo(HOGAR_INICIAL, yo, id, "12345", opciones())).rejects.toThrow(/6 números/);
    expect((await prisma.correoRegistrado.findUniqueOrThrow({ where: { id } })).intentos).toBe(0);
  });

  test("el codigo de un correo no sirve para otro", async () => {
    const uno = await agregarCorreo(HOGAR_INICIAL, yo, "uno@ejemplo.cl", opciones());
    const codigoDelUno = ultimoCodigo();
    const dos = await agregarCorreo(HOGAR_INICIAL, yo, "dos@ejemplo.cl", opciones());
    expect(uno.id).not.toBe(dos.id);
    if (codigoDelUno !== ultimoCodigo()) {
      await expect(confirmarCorreo(HOGAR_INICIAL, yo, dos.id, codigoDelUno, opciones())).rejects.toThrow(/no es/);
    }
  });
});

describe("cada persona con sus correos", () => {
  test("nadie confirma, pide codigo ni quita el correo de otra persona", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    const codigo = ultimoCodigo();
    await expect(confirmarCorreo(OTRO, ana, id, codigo, opciones())).rejects.toThrow(/ya no está en tu lista/);
    await expect(pedirCodigoDeCorreo(OTRO, ana, id, opciones({ ahora: minutos(5) }))).rejects.toThrow(/ya no está en tu lista/);
    await expect(quitarCorreo(OTRO, ana, id, prisma)).rejects.toThrow(/ya no está en tu lista/);
    // Ni con el hogar equivocado.
    await expect(confirmarCorreo(OTRO, yo, id, codigo, opciones())).rejects.toThrow(/Ya no eres parte/);
    expect(await prisma.correoRegistrado.count()).toBe(1);
  });

  test("la lista empieza con el de Google y sigue con los registrados", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    const lista = await leerMisCorreos(HOGAR_INICIAL, yo, { db: prisma, ahora: AHORA, buscarServidores: async () => [] });
    expect(lista).toEqual([
      { id: null, direccion: "camila@gmail.com", proveedor: "GMAIL", confirmado: true, principal: true, esperandoCodigo: false },
      { id, direccion: "camila@hotmail.com", proveedor: "OUTLOOK", confirmado: false, principal: false, esperandoCodigo: true },
    ]);
  });

  test("quitar un correo lo saca de los confirmados", async () => {
    const { id } = await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    await confirmarCorreo(HOGAR_INICIAL, yo, id, ultimoCodigo(), opciones());
    await quitarCorreo(HOGAR_INICIAL, yo, id, prisma);
    expect(await correosConfirmados(yo, prisma)).toEqual(["camila@gmail.com"]);
  });

  test("de una invitacion que todavia no entra, ni su correo de Google cuenta", async () => {
    const invitada = await miembroDePrueba(prisma, { correo: "invitada@gmail.com", rol: "MIEMBRO", entro: false });
    expect(await correosConfirmados(invitada, prisma)).toEqual([]);
  });

  test("si la persona sale del hogar, sus correos se van con ella", async () => {
    await agregarCorreo(HOGAR_INICIAL, yo, "camila@hotmail.com", opciones());
    await prisma.miembro.delete({ where: { id: yo } });
    expect(await prisma.correoRegistrado.count()).toBe(0);
  });
});
