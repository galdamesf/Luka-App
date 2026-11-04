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
import type { HogarDeSesion } from "@/lib/sesion";

/** El hogar donde quedaron los datos de antes de los hogares (migracion 20261103150000_hogares). */
export const HOGAR_INICIAL = "hogar-inicial";

/**
 * El hogar que usan las funciones de datos que TODAVIA no reciben el hogar de
 * la sesion. Es el mismo valor por omision que tiene hoy cada tabla, asi que
 * no cambia nada: todo sigue cayendo en el hogar inicial.
 *
 * Cuando todas las funciones reciban el hogar de quien mira, esta constante
 * se borra, y TypeScript marca cualquier lugar que se haya quedado atras.
 */
export const HOGAR_DE_TRANSICION = HOGAR_INICIAL;

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
      const decision = decidirEntrada({ correo, yaEsMiembro: existente !== null, ...reglas });

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

        case "hogar-inicial": {
          const fila = await tx.miembro.create({
            data: { hogarId: HOGAR_INICIAL, correo, nombre, rol: decision.rol, entroEn: new Date() },
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
