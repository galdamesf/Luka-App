import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { HOGAR_INICIAL, clienteDePrueba, limpiar } from "./base";
import {
  borrarHogar,
  ErrorDeHogar,
  hacerDueno,
  invitarMiembro,
  pedirCodigoDeBorrado,
  leerHogar,
  miembrosQueEntraron,
  quitarMiembro,
  registrarEntrada,
  renombrarHogar,
  salirDelHogar,
} from "@/datos/hogares";
import { fechaDesdeISO } from "@/lib/fecha";
import type { Correo } from "@/lib/correo";

/**
 * La pagina Hogar contra la base: invitar, sacar, pasar el hogar, salir,
 * cambiarle el nombre y borrarlo. Con el rol que dice la base, y siempre dentro del
 * hogar de quien lo hace.
 */

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = clienteDePrueba();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const OTRO = "hogar-de-ana";
let dueno: string;
let miembro: string;

beforeEach(async () => {
  await limpiar(prisma);
  await prisma.hogar.create({ data: { id: OTRO, nombre: "Casa de Ana" } });
  dueno = (
    await prisma.miembro.create({
      data: { hogarId: HOGAR_INICIAL, correo: "fernando@gmail.com", nombre: "Fernando", rol: "DUENO", entroEn: new Date() },
    })
  ).id;
  miembro = (
    await prisma.miembro.create({
      data: { hogarId: HOGAR_INICIAL, correo: "angelina@gmail.com", nombre: "Angelina", rol: "MIEMBRO", entroEn: new Date() },
    })
  ).id;
});

const rechaza = (promesa: Promise<unknown>, motivo: RegExp) =>
  expect(promesa).rejects.toSatisfy((e: unknown) => e instanceof ErrorDeHogar && motivo.test(e.message));

describe("leerHogar", () => {
  test("trae el hogar con sus miembros: el dueno primero y las invitaciones al final", async () => {
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "abuela@gmail.com" } });
    const hogar = await leerHogar(HOGAR_INICIAL, prisma);
    expect(hogar.nombre).toBe("Mi hogar");
    expect(hogar.miembros.map((m) => m.correo)).toEqual(["fernando@gmail.com", "angelina@gmail.com", "abuela@gmail.com"]);
    expect(hogar.miembros[2]?.entroEn).toBeNull();
  });

  test("no trae miembros de otro hogar", async () => {
    await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    expect((await leerHogar(HOGAR_INICIAL, prisma)).miembros).toHaveLength(2);
  });

  test("cuenta solo a los que ya entraron", async () => {
    await prisma.miembro.create({ data: { hogarId: HOGAR_INICIAL, correo: "abuela@gmail.com" } });
    expect(await miembrosQueEntraron(HOGAR_INICIAL, prisma)).toBe(2);
  });
});

describe("invitar", () => {
  test("el dueno invita un correo: queda pendiente, como miembro", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, " Abuela@Gmail.com ", prisma);
    expect(invitado).toMatchObject({ correo: "abuela@gmail.com", rol: "MIEMBRO", entroEn: null });
  });

  test("al entrar con ese Google, la invitacion se acepta y cae en el hogar", async () => {
    await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    const hogar = await registrarEntrada(
      { correo: "abuela@gmail.com", nombre: "Abuela" },
      { listaDeAntes: [], puertaAbierta: false },
      prisma,
    );
    expect(hogar).toMatchObject({ hogarId: HOGAR_INICIAL, rol: "MIEMBRO" });
  });

  test("un miembro que no es dueno no invita", async () => {
    await rechaza(invitarMiembro(HOGAR_INICIAL, miembro, "abuela@gmail.com", prisma), /dueño/);
  });

  test("un correo que ya es parte de un hogar no se puede invitar", async () => {
    await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "ana@gmail.com", prisma), /ya es parte de un hogar/);
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "angelina@gmail.com", prisma), /ya es parte de un hogar/);
  });

  test("algo que no es correo no se invita", async () => {
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "abuela", prisma), /no parece un correo/);
  });

  test("el dueno de otro hogar no invita a este", async () => {
    const ana = await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(invitarMiembro(HOGAR_INICIAL, ana.id, "abuela@gmail.com", prisma), /Ya no eres parte/);
  });
});

describe("sacar", () => {
  test("el dueno saca a un miembro, y sus gastos se quedan sin autor", async () => {
    const cat = await prisma.categoria.create({
      data: { hogarId: HOGAR_INICIAL, nombre: "Feria", color: "#15803D", icono: "x" },
    });
    const gasto = await prisma.gasto.create({
      data: {
        hogarId: HOGAR_INICIAL, fecha: fechaDesdeISO("2026-11-03"), descripcion: "Pan", monto: 1_000,
        categoriaId: cat.id, anotadoPorId: miembro,
      },
    });

    await quitarMiembro(HOGAR_INICIAL, dueno, miembro, prisma);

    expect(await prisma.miembro.count({ where: { id: miembro } })).toBe(0);
    expect((await prisma.gasto.findUniqueOrThrow({ where: { id: gasto.id } })).anotadoPorId).toBeNull();
  });

  test("sacar una invitacion pendiente la cancela", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    await quitarMiembro(HOGAR_INICIAL, dueno, invitado.id, prisma);
    expect(await prisma.miembro.count({ where: { correo: "abuela@gmail.com" } })).toBe(0);
  });

  test("un miembro no saca a nadie, ni al dueno", async () => {
    await rechaza(quitarMiembro(HOGAR_INICIAL, miembro, dueno, prisma), /dueño/);
  });

  test("el dueno no se saca a si mismo: para eso esta salir", async () => {
    await rechaza(quitarMiembro(HOGAR_INICIAL, dueno, dueno, prisma), /Salir del hogar/);
  });

  test("no se saca a alguien de otro hogar", async () => {
    const ana = await prisma.miembro.create({ data: { hogarId: OTRO, correo: "ana@gmail.com", rol: "DUENO" } });
    await rechaza(quitarMiembro(HOGAR_INICIAL, dueno, ana.id, prisma), /ya no está en el hogar/);
    expect(await prisma.miembro.count({ where: { id: ana.id } })).toBe(1);
  });
});

describe("pasar el hogar", () => {
  test("el dueno le pasa el hogar a un miembro y queda como miembro", async () => {
    await hacerDueno(HOGAR_INICIAL, dueno, miembro, prisma);
    const roles = Object.fromEntries(
      (await prisma.miembro.findMany({ select: { id: true, rol: true } })).map((m) => [m.id, m.rol]),
    );
    expect(roles).toEqual({ [dueno]: "MIEMBRO", [miembro]: "DUENO" });
  });

  test("no se le pasa a una invitacion pendiente", async () => {
    const invitado = await invitarMiembro(HOGAR_INICIAL, dueno, "abuela@gmail.com", prisma);
    await rechaza(hacerDueno(HOGAR_INICIAL, dueno, invitado.id, prisma), /ya entró/);
  });

  test("un miembro no le pasa el hogar a nadie", async () => {
    await rechaza(hacerDueno(HOGAR_INICIAL, miembro, miembro, prisma), /dueño/);
  });
});

describe("salir", () => {
  test("un miembro sale del hogar", async () => {
    await salirDelHogar(HOGAR_INICIAL, miembro, prisma);
    expect(await prisma.miembro.count({ where: { id: miembro } })).toBe(0);
  });

  test("el dueno no sale sin antes pasar el hogar", async () => {
    await rechaza(salirDelHogar(HOGAR_INICIAL, dueno, prisma), /pásale el hogar/);
    await hacerDueno(HOGAR_INICIAL, dueno, miembro, prisma);
    await salirDelHogar(HOGAR_INICIAL, dueno, prisma);
    expect(await prisma.miembro.count({ where: { id: dueno } })).toBe(0);
  });

  test("quien salio no vuelve a entrar solo, ni estando en la lista del .env", async () => {
    await salirDelHogar(HOGAR_INICIAL, miembro, prisma);
    const vuelve = await registrarEntrada(
      { correo: "angelina@gmail.com", nombre: "Angelina" },
      { listaDeAntes: ["angelina@gmail.com"], puertaAbierta: false },
      prisma,
    );
    expect(vuelve).toBeNull();
  });
});

describe("cambiar el nombre", () => {
  test("el dueno le cambia el nombre al hogar", async () => {
    await renombrarHogar(HOGAR_INICIAL, dueno, "  Casa Galdames  ", prisma);
    expect((await leerHogar(HOGAR_INICIAL, prisma)).nombre).toBe("Casa Galdames");
  });

  test("un miembro no, y un nombre vacio tampoco", async () => {
    await rechaza(renombrarHogar(HOGAR_INICIAL, miembro, "Otro", prisma), /dueño/);
    await rechaza(renombrarHogar(HOGAR_INICIAL, dueno, "   ", prisma), /Escribe un nombre/);
  });
});

describe("borrar el hogar, con el codigo del correo", () => {
  const SECRETO = "secreto-de-prueba";
  let raiz: string;
  let ana: string;
  let enviados: Correo[];
  /** Un «correo» que no sale a internet: guarda lo que se mando. */
  const enviar = async (correo: Correo) => {
    enviados.push(correo);
  };
  const codigoEnviado = () => /\b(\d{6})\b/.exec(enviados.at(-1)!.texto)![1]!;
  const pedir = (hogarId: string, quienId: string, ahora = new Date()) =>
    pedirCodigoDeBorrado(hogarId, quienId, { db: prisma, enviar, secreto: SECRETO, ahora });
  const borrar = (hogarId: string, quienId: string, codigo: string, ahora = new Date()) =>
    borrarHogar(hogarId, quienId, codigo, { db: prisma, raizBoletas: raiz, secreto: SECRETO, ahora });

  beforeEach(async () => {
    enviados = [];
    raiz = await mkdtemp(join(tmpdir(), "boletas-"));
    ana = (
      await prisma.miembro.create({
        data: { hogarId: OTRO, correo: "ana@gmail.com", nombre: "Ana Pérez", rol: "DUENO", entroEn: new Date() },
      })
    ).id;
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  /** Un hogar con un poco de todo, para ver que no quede nada. */
  async function llenar(hogarId: string) {
    const cat = await prisma.categoria.create({ data: { hogarId, nombre: "Feria", color: "#15803D", icono: "x" } });
    const mes = fechaDesdeISO("2026-11-01");
    const gasto = await prisma.gasto.create({
      data: { hogarId, fecha: fechaDesdeISO("2026-11-03"), descripcion: "Pan", monto: 1_000, categoriaId: cat.id },
    });
    const deuda = await prisma.deuda.create({
      data: { hogarId, nombre: "Crédito", montoCuota: 10_000, cuotasTotales: 12, primeraCuota: mes },
    });
    await prisma.cuotaPagada.create({ data: { deudaId: deuda.id, mes, pagadaEn: mes, monto: 10_000, gastoId: gasto.id } });
    await prisma.cuenta.create({ data: { hogarId, nombre: "Luz", monto: 20_000, mes, categoriaId: cat.id } });
    await prisma.presupuesto.create({ data: { hogarId, categoriaId: cat.id, mes, monto: 50_000 } });
    await prisma.ahorro.create({ data: { hogarId, mes, monto: 30_000 } });
    await prisma.sueldo.create({ data: { hogarId, monto: 900_000, vigenteDesde: mes } });
    await prisma.ajustes.create({ data: { hogarId, diaInicioMes: 27 } });
    await mkdir(join(raiz, hogarId), { recursive: true });
    await writeFile(join(raiz, hogarId, `${"a".repeat(32)}.jpg`), "boleta");
  }

  const filasDe = async (hogarId: string) =>
    Promise.all([
      prisma.gasto.count({ where: { hogarId } }),
      prisma.categoria.count({ where: { hogarId } }),
      prisma.deuda.count({ where: { hogarId } }),
      prisma.cuotaPagada.count({ where: { deuda: { hogarId } } }),
      prisma.cuenta.count({ where: { hogarId } }),
      prisma.presupuesto.count({ where: { hogarId } }),
      prisma.ahorro.count({ where: { hogarId } }),
      prisma.sueldo.count({ where: { hogarId } }),
      prisma.ajustes.count({ where: { hogarId } }),
      prisma.miembro.count({ where: { hogarId } }),
      prisma.codigoDeBorrado.count({ where: { hogarId } }),
    ]);

  test("el codigo llega al correo del dueno, y en la base queda solo su huella", async () => {
    expect(await pedir(OTRO, ana)).toEqual({ correo: "ana@gmail.com" });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ para: "ana@gmail.com", asunto: "Código para borrar «Casa de Ana» en Luka" });
    expect(enviados[0]!.texto.startsWith("Hola, Ana:")).toBe(true);

    const fila = await prisma.codigoDeBorrado.findUniqueOrThrow({ where: { hogarId: OTRO } });
    expect(fila).toMatchObject({ miembroId: ana, intentos: 0 });
    expect(fila.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(fila.huella).not.toContain(codigoEnviado());
    expect(fila.expiraEn.getTime() - fila.creadoEn.getTime()).toBe(10 * 60_000);
  });

  test("con el codigo, el dueno que esta solo borra todo, y el otro hogar queda intacto", async () => {
    await llenar(OTRO);
    await llenar(HOGAR_INICIAL);
    await prisma.miembro.create({ data: { hogarId: OTRO, correo: "invitada@gmail.com" } });
    const antesDelOtro = await filasDe(HOGAR_INICIAL);

    await pedir(OTRO, ana);
    const codigo = codigoEnviado();
    await borrar(OTRO, ana, ` ${codigo.slice(0, 3)} ${codigo.slice(3)} `);

    expect(await prisma.hogar.count({ where: { id: OTRO } })).toBe(0);
    expect(await filasDe(OTRO)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await prisma.miembro.count({ where: { correo: "invitada@gmail.com" } })).toBe(0);
    expect(existsSync(join(raiz, OTRO))).toBe(false);

    expect(await filasDe(HOGAR_INICIAL)).toEqual(antesDelOtro);
    expect(existsSync(join(raiz, HOGAR_INICIAL, `${"a".repeat(32)}.jpg`))).toBe(true);
  });

  test("sin pedir el codigo, no se borra", async () => {
    await rechaza(borrar(OTRO, ana, "123456"), /Primero pide el código/);
    await rechaza(borrar(OTRO, ana, "hola"), /6 números/);
    expect(await prisma.hogar.count({ where: { id: OTRO } })).toBe(1);
  });

  test("un codigo equivocado cuenta el intento, y al quinto no queda ninguno, ni con el bueno", async () => {
    await llenar(OTRO);
    await pedir(OTRO, ana);
    const bueno = codigoEnviado();
    const malo = bueno === "000000" ? "111111" : "000000";

    await rechaza(borrar(OTRO, ana, malo), /Te quedan 4 intentos/);
    for (let i = 0; i < 3; i++) await rechaza(borrar(OTRO, ana, malo), /Ese código no es/);
    await rechaza(borrar(OTRO, ana, malo), /se acabaron los intentos/);
    expect((await prisma.codigoDeBorrado.findUniqueOrThrow({ where: { hogarId: OTRO } })).intentos).toBe(5);

    await rechaza(borrar(OTRO, ana, bueno), /Se acabaron los intentos/);
    expect(await prisma.gasto.count({ where: { hogarId: OTRO } })).toBe(1);
    expect(existsSync(join(raiz, OTRO))).toBe(true);
  });

  test("varios intentos a la vez no se saltan el limite", async () => {
    await pedir(OTRO, ana);
    const bueno = codigoEnviado();
    const malos = Array.from({ length: 12 }, (_, i) => String((Number(bueno) + i + 1) % 1_000_000).padStart(6, "0"));
    await Promise.allSettled(malos.map((m) => borrar(OTRO, ana, m)));
    expect((await prisma.codigoDeBorrado.findUniqueOrThrow({ where: { hogarId: OTRO } })).intentos).toBe(5);
  });

  test("el codigo vence a los 10 minutos", async () => {
    const antes = new Date(Date.now() - 11 * 60_000);
    await pedir(OTRO, ana, antes);
    await rechaza(borrar(OTRO, ana, codigoEnviado()), /venció/);
    expect(await prisma.hogar.count({ where: { id: OTRO } })).toBe(1);
  });

  test("otro codigo, recien despues de un minuto; y el nuevo reemplaza al anterior", async () => {
    const t0 = new Date();
    await pedir(OTRO, ana, t0);
    const primero = codigoEnviado();
    await rechaza(pedir(OTRO, ana, new Date(t0.getTime() + 30_000)), /espera 30 segundos/);
    expect(enviados).toHaveLength(1);

    await pedir(OTRO, ana, new Date(t0.getTime() + 61_000));
    const segundo = codigoEnviado();
    expect(await prisma.codigoDeBorrado.count({ where: { hogarId: OTRO } })).toBe(1);
    if (primero !== segundo) await rechaza(borrar(OTRO, ana, primero), /Ese código no es/);
    await borrar(OTRO, ana, segundo);
    expect(await prisma.hogar.count({ where: { id: OTRO } })).toBe(0);
  });

  test("si el correo no sale, no queda codigo y se puede pedir otro al tiro", async () => {
    const fallar = async () => {
      throw new Error("smtp caido");
    };
    await rechaza(pedirCodigoDeBorrado(OTRO, ana, { db: prisma, enviar: fallar, secreto: SECRETO }), /No se pudo mandar el correo/);
    expect(await prisma.codigoDeBorrado.count()).toBe(0);
    await pedir(OTRO, ana);
    expect(enviados).toHaveLength(1);
  });

  test("sin correo configurado no se pide codigo", async () => {
    await rechaza(pedirCodigoDeBorrado(OTRO, ana, { db: prisma, enviar: null, secreto: SECRETO }), /no puede mandar correos/);
    expect(await prisma.codigoDeBorrado.count()).toBe(0);
  });

  test("con alguien mas que ya entro no se pide codigo ni se borra: le quitaria sus datos", async () => {
    await rechaza(pedir(HOGAR_INICIAL, dueno), /estás solo/);
    await rechaza(borrar(HOGAR_INICIAL, dueno, "123456"), /estás solo/);
    expect(enviados).toHaveLength(0);
    expect(await prisma.hogar.count({ where: { id: HOGAR_INICIAL } })).toBe(1);
  });

  test("un miembro no pide codigo, ni el dueno de otro hogar", async () => {
    await rechaza(pedir(HOGAR_INICIAL, miembro), /dueño/);
    await rechaza(pedir(HOGAR_INICIAL, ana), /Ya no eres parte/);
    expect(enviados).toHaveLength(0);
  });

  test("el codigo de un hogar no sirve para borrar otro", async () => {
    // Pedro, dueno solo de un tercer hogar, recibe su propio codigo.
    const tercero = await prisma.hogar.create({ data: { nombre: "Casa de Pedro" } });
    const pedro = await prisma.miembro.create({
      data: { hogarId: tercero.id, correo: "pedro@gmail.com", rol: "DUENO", entroEn: new Date() },
    });
    await pedir(tercero.id, pedro.id);
    const dePedro = codigoEnviado();
    await pedir(OTRO, ana);
    const deAna = codigoEnviado();
    if (dePedro !== deAna) await rechaza(borrar(OTRO, ana, dePedro), /Ese código no es/);
    expect(await prisma.hogar.count({ where: { id: OTRO } })).toBe(1);
  });

  test("despues de borrar su hogar, a esa persona ya se la puede invitar a otro", async () => {
    await rechaza(invitarMiembro(HOGAR_INICIAL, dueno, "ana@gmail.com", prisma), /ya es parte de un hogar/);
    await pedir(OTRO, ana);
    await borrar(OTRO, ana, codigoEnviado());

    await invitarMiembro(HOGAR_INICIAL, dueno, "ana@gmail.com", prisma);
    const entra = await registrarEntrada(
      { correo: "ana@gmail.com", nombre: "Ana" },
      { listaDeAntes: [], puertaAbierta: true },
      prisma,
    );
    expect(entra).toMatchObject({ hogarId: HOGAR_INICIAL, rol: "MIEMBRO" });
  });
});
