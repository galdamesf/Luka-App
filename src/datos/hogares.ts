import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS_CON_COLOR } from "@/dominio/categorias-base";
import {
  decidirEntrada,
  limpiarNombre,
  nombreDeHogarNuevo,
  normalizarCorreo,
  type ReglasDeEntrada,
} from "@/dominio/entrada";
import {
  errorDeNombreDeHogar,
  ordenarMiembros,
  puedeHacerDueno,
  puedeInvitar,
  puedeQuitar,
  puedeRenombrar,
  puedeSalir,
  type MiembroDelHogar,
  type Quien,
} from "@/dominio/hogar";
import type { HogarDeSesion } from "@/lib/sesion";

/** El hogar donde quedaron los datos de antes de los hogares (migracion 20261103150000_hogares). */
export const HOGAR_INICIAL = "hogar-inicial";

type ClienteHogares = Pick<PrismaClient, "miembro">;

/** Las categorias con que parte un hogar: las mismas que carga el seed. */
export function categoriasDePartida() {
  return CATEGORIAS_CON_COLOR.map((categoria, orden) => ({ ...categoria, orden }));
}

const CAMPOS_DE_SESION = { id: true, hogarId: true, rol: true } as const;

function aSesion(fila: { id: string; hogarId: string; rol: "DUENO" | "MIEMBRO" }): HogarDeSesion {
  return { hogarId: fila.hogarId, miembroId: fila.id, rol: fila.rol };
}

/**
 * Lo que pasa en la base cuando alguien entra con Google (las reglas, en
 * src/dominio/entrada.ts). Devuelve con que hogar entra, o null si no entra.
 *
 * Todo va en una transaccion: un hogar nuevo nace con su dueno y sus
 * categorias, o no nace. Si dos ingresos del mismo correo chocan (dos
 * pestanas a la vez), el segundo se repite una vez y encuentra al miembro
 * que creo el primero.
 */
export async function registrarEntrada(
  persona: { correo: string | null | undefined; nombre: string | null | undefined },
  reglas: ReglasDeEntrada,
  db: PrismaClient = prisma,
): Promise<HogarDeSesion | null> {
  const correo = normalizarCorreo(persona.correo);
  if (correo === null) return null;
  const nombre = limpiarNombre(persona.nombre);

  const intentar = () =>
    db.$transaction(async (tx) => {
      const existente = await tx.miembro.findUnique({ where: { correo } });
      const hogarInicialConDueno =
        (await tx.miembro.count({ where: { hogarId: HOGAR_INICIAL, rol: "DUENO" } })) > 0;
      const decision = decidirEntrada({
        correo,
        yaEsMiembro: existente !== null,
        hogarInicialConDueno,
        ...reglas,
      });

      switch (decision.tipo) {
        case "rechazada":
          return null;

        case "miembro": {
          // Si era una invitacion, entrar la acepta. El nombre se refresca
          // con el de Google, salvo que venga vacio.
          const miembro = existente!;
          const fila = await tx.miembro.update({
            where: { id: miembro.id },
            data: { entroEn: miembro.entroEn ?? new Date(), nombre: nombre ?? miembro.nombre },
            select: CAMPOS_DE_SESION,
          });
          return aSesion(fila);
        }

        case "dueno-del-hogar-inicial": {
          const fila = await tx.miembro.create({
            data: { hogarId: HOGAR_INICIAL, correo, nombre, rol: "DUENO", entroEn: new Date() },
            select: CAMPOS_DE_SESION,
          });
          return aSesion(fila);
        }

        case "hogar-nuevo": {
          const hogar = await tx.hogar.create({
            data: {
              nombre: nombreDeHogarNuevo(nombre),
              miembros: { create: { correo, nombre, rol: "DUENO", entroEn: new Date() } },
              categorias: { create: categoriasDePartida() },
            },
            select: { miembros: { select: CAMPOS_DE_SESION } },
          });
          return aSesion(hogar.miembros[0]!);
        }
      }
    });

  try {
    return await intentar();
  } catch (error) {
    const choque = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!choque) throw error;
    return intentar();
  }
}

/**
 * El hogar de un correo segun la base, para revisar la sesion en cada visita.
 * null si no es miembro de ningun hogar o si su invitacion sigue pendiente.
 */
export async function miembroDeSesion(
  correo: string | null | undefined,
  db: ClienteHogares = prisma,
): Promise<HogarDeSesion | null> {
  const normalizado = normalizarCorreo(correo);
  if (normalizado === null) return null;

  const fila = await db.miembro.findUnique({
    where: { correo: normalizado },
    select: { ...CAMPOS_DE_SESION, entroEn: true },
  });
  if (fila === null || fila.entroEn === null) return null;
  return aSesion(fila);
}

/* ---------------------------------------------------------------------------
   La pagina Hogar: el hogar con sus miembros, invitar, sacar, salir y pasar
   el hogar. Las reglas de quien puede que estan en src/dominio/hogar.ts; aqui
   se aplican contra la base, con el rol que dice la base y no el que trae la
   sesion, y todo dentro del hogar de quien mira.
   --------------------------------------------------------------------------- */

/** Un error que se le puede mostrar tal cual a la persona. */
export class ErrorDeHogar extends Error {}

export type HogarConMiembros = {
  id: string;
  nombre: string;
  miembros: MiembroDelHogar[];
};

type FilaMiembro = {
  id: string;
  correo: string;
  nombre: string | null;
  rol: "DUENO" | "MIEMBRO";
  entroEn: Date | null;
};

function aMiembro(fila: FilaMiembro): MiembroDelHogar {
  return { ...fila, entroEn: fila.entroEn === null ? null : fila.entroEn.toISOString() };
}

const CAMPOS_DE_MIEMBRO = { id: true, correo: true, nombre: true, rol: true, entroEn: true } as const;

export async function leerHogar(hogarId: string, db: Pick<PrismaClient, "hogar"> = prisma): Promise<HogarConMiembros> {
  const hogar = await db.hogar.findUniqueOrThrow({
    where: { id: hogarId },
    select: { id: true, nombre: true, miembros: { select: CAMPOS_DE_MIEMBRO } },
  });
  return { id: hogar.id, nombre: hogar.nombre, miembros: ordenarMiembros(hogar.miembros.map(aMiembro)) };
}

/** Cuantos miembros ya entraron: con mas de uno, cada gasto dice quien lo anoto. */
export async function miembrosQueEntraron(hogarId: string, db: ClienteHogares = prisma): Promise<number> {
  return db.miembro.count({ where: { hogarId, entroEn: { not: null } } });
}

type ClienteTxHogar = Pick<PrismaClient, "miembro" | "hogar">;

/** Quien hace la accion, segun la base. Si ya no esta en el hogar, no hace nada. */
async function quienEs(tx: ClienteTxHogar, hogarId: string, quienId: string): Promise<Quien> {
  const fila = await tx.miembro.findFirst({ where: { id: quienId, hogarId }, select: { id: true, rol: true } });
  if (fila === null) throw new ErrorDeHogar("Ya no eres parte de este hogar.");
  return { miembroId: fila.id, rol: fila.rol };
}

/** Un miembro del hogar, o el error de que ya no esta. */
async function miembroDelHogar(tx: ClienteTxHogar, hogarId: string, miembroId: string): Promise<MiembroDelHogar> {
  const fila = await tx.miembro.findFirst({ where: { id: miembroId, hogarId }, select: CAMPOS_DE_MIEMBRO });
  if (fila === null) throw new ErrorDeHogar("Esa persona ya no está en el hogar.");
  return aMiembro(fila);
}

function exigir(motivo: string | null): void {
  if (motivo !== null) throw new ErrorDeHogar(motivo);
}

export async function renombrarHogar(
  hogarId: string,
  quienId: string,
  nombre: string,
  db: PrismaClient = prisma,
): Promise<void> {
  exigir(errorDeNombreDeHogar(nombre));
  await db.$transaction(async (tx) => {
    exigir(puedeRenombrar(await quienEs(tx, hogarId, quienId)));
    await tx.hogar.update({ where: { id: hogarId }, data: { nombre: nombre.trim() } });
  });
}

/**
 * Invita un correo al hogar: queda como miembro con la invitacion pendiente
 * hasta que entre con ese Google. No se manda ningun correo: la persona
 * entra a Luka y cae en el hogar.
 */
export async function invitarMiembro(
  hogarId: string,
  quienId: string,
  correo: string,
  db: PrismaClient = prisma,
): Promise<MiembroDelHogar> {
  const normalizado = normalizarCorreo(correo);
  if (normalizado === null) throw new ErrorDeHogar("Ese correo no parece un correo.");

  try {
    return await db.$transaction(async (tx) => {
      exigir(puedeInvitar(await quienEs(tx, hogarId, quienId)));
      const fila = await tx.miembro.create({
        data: { hogarId, correo: normalizado, rol: "MIEMBRO" },
        select: CAMPOS_DE_MIEMBRO,
      });
      return aMiembro(fila);
    });
  } catch (error) {
    // El correo es unico en toda la base: cada persona esta en un solo hogar.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorDeHogar("Ese correo ya es parte de un hogar en Luka.");
    }
    throw error;
  }
}

/** Saca a alguien del hogar, o cancela su invitacion: es lo mismo. Sus gastos se quedan. */
export async function quitarMiembro(
  hogarId: string,
  quienId: string,
  miembroId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const quien = await quienEs(tx, hogarId, quienId);
    const objetivo = await miembroDelHogar(tx, hogarId, miembroId);
    exigir(puedeQuitar(quien, objetivo));
    await tx.miembro.delete({ where: { id: objetivo.id } });
  });
}

/** El dueno le pasa el hogar a otro miembro, que ya haya entrado, y queda como miembro. */
export async function hacerDueno(
  hogarId: string,
  quienId: string,
  miembroId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const quien = await quienEs(tx, hogarId, quienId);
    const objetivo = await miembroDelHogar(tx, hogarId, miembroId);
    exigir(puedeHacerDueno(quien, objetivo));
    await tx.miembro.update({ where: { id: objetivo.id }, data: { rol: "DUENO" } });
    await tx.miembro.update({ where: { id: quien.miembroId }, data: { rol: "MIEMBRO" } });
  });
}

/** Un miembro se va del hogar. Sus gastos se quedan, sin autor. */
export async function salirDelHogar(hogarId: string, quienId: string, db: PrismaClient = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const quien = await quienEs(tx, hogarId, quienId);
    exigir(puedeSalir(quien));
    await tx.miembro.delete({ where: { id: quien.miembroId } });
  });
}
