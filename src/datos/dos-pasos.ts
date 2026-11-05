import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarCorreo } from "@/dominio/entrada";
import {
  DOS_PASOS,
  estaBloqueado,
  formatearCodigoDeRespaldo,
  limpiarCodigoDeApp,
  limpiarCodigoDeRespaldo,
  mensajeDeBloqueo,
  mensajeDeFallo,
  trasUnFallo,
} from "@/dominio/dos-pasos";
import {
  aBase32,
  cifrarClaveDeApp,
  claveMaestra,
  descifrarClaveDeApp,
  huellaDeRespaldo,
  nuevaClaveDeApp,
  nuevosCodigosDeRespaldo,
  revisarCodigoDeApp,
} from "@/lib/dos-pasos";
import { SEGUNDOS_MAXIMOS, type HogarDeSesion } from "@/lib/sesion";

/**
 * La verificacion en dos pasos contra la base: configurar la app, revisar
 * los codigos, los codigos de respaldo y las sesiones verificadas. Las reglas
 * estan en src/dominio/dos-pasos.ts y la criptografia en src/lib/dos-pasos.ts.
 */

type Base = Pick<PrismaClient, "dosPasos" | "codigoDeRespaldo" | "sesionVerificada" | "miembro" | "$transaction">;

export type OpcionesDeDosPasos = {
  db?: Base;
  /** La clave maestra (CLAVE_DOS_PASOS). Por omision, la del entorno. */
  maestra?: Buffer;
  ahora?: Date;
};

/** Un error que se le puede mostrar tal cual a la persona. */
export class ErrorDeDosPasos extends Error {}

/** Lo que sale de poner un codigo. */
export type ResultadoDeCodigo = { ok: true } | { ok: false; mensaje: string };

const SESION_VALIDA = /^[0-9a-f]{32}$/;

/* ---------------------------------------------------------------------------
   La sesion: en que paso esta
   --------------------------------------------------------------------------- */

export type AccesoEnLaBase = {
  /** El miembro tal como esta en la base, o null si ya no es miembro. */
  hogar: HogarDeSesion | null;
  appConfigurada: boolean;
  sesionVerificada: boolean;
  /** Si ya eligio si usar la verificacion: si no, Luka se lo pregunta. */
  decidio: boolean;
};

/**
 * Lo que dice la base de una sesion, en una sola consulta: si la persona
 * sigue siendo miembro, si ya eligio si usar la verificacion, si tiene la app
 * configurada y si esta sesion ya puso el codigo (y no vencio).
 */
export async function accesoDeSesion(
  correo: string | null | undefined,
  sesionId: string | null | undefined,
  { db = prisma, ahora = new Date() }: Pick<OpcionesDeDosPasos, "db" | "ahora"> = {},
): Promise<AccesoEnLaBase> {
  const nadie = { hogar: null, appConfigurada: false, sesionVerificada: false, decidio: false };
  const normalizado = normalizarCorreo(correo);
  if (normalizado === null) return nadie;

  const sesion = typeof sesionId === "string" && SESION_VALIDA.test(sesionId) ? sesionId : null;
  const fila = await db.miembro.findUnique({
    where: { correo: normalizado },
    select: {
      id: true,
      hogarId: true,
      rol: true,
      entroEn: true,
      decidioDosPasosEn: true,
      dosPasos: { select: { confirmadoEn: true } },
      sesionesVerificadas: {
        // Sin id valido no se busca nada: "" no calza con ninguna fila.
        where: { id: sesion ?? "", expiraEn: { gt: ahora } },
        select: { id: true },
      },
    },
  });
  if (fila === null || fila.entroEn === null) return nadie;

  return {
    hogar: { hogarId: fila.hogarId, miembroId: fila.id, rol: fila.rol },
    appConfigurada: fila.dosPasos?.confirmadoEn != null,
    sesionVerificada: sesion !== null && fila.sesionesVerificadas.length > 0,
    decidio: fila.decidioDosPasosEn !== null,
  };
}

/** Deja la sesion como verificada (y de paso borra las vencidas de esa persona). */
async function verificarLaSesion(db: Pick<Base, "sesionVerificada">, miembroId: string, sesionId: string, ahora: Date): Promise<void> {
  if (!SESION_VALIDA.test(sesionId)) throw new ErrorDeDosPasos("Tu sesión no es válida. Sal y entra de nuevo.");
  const expiraEn = new Date(ahora.getTime() + SEGUNDOS_MAXIMOS * 1000);
  await db.sesionVerificada.deleteMany({ where: { miembroId, expiraEn: { lte: ahora } } });
  await db.sesionVerificada.upsert({
    where: { id: sesionId },
    create: { id: sesionId, miembroId, verificadaEn: ahora, expiraEn },
    update: { miembroId, verificadaEn: ahora, expiraEn },
  });
}

/** Al salir: la sesion deja de estar verificada. */
export async function olvidarSesion(sesionId: string | null | undefined, db: Base = prisma): Promise<void> {
  if (typeof sesionId !== "string" || !SESION_VALIDA.test(sesionId)) return;
  await db.sesionVerificada.deleteMany({ where: { id: sesionId } });
}

/* ---------------------------------------------------------------------------
   Elegir al entrar
   --------------------------------------------------------------------------- */

/**
 * «Ahora no»: entra solo con Google y Luka no se lo vuelve a preguntar. Puede
 * activarla despues en «Tu hogar».
 */
export async function elegirSinDosPasos(
  miembroId: string,
  { db = prisma, ahora = new Date() }: Pick<OpcionesDeDosPasos, "db" | "ahora"> = {},
): Promise<void> {
  await db.miembro.updateMany({ where: { id: miembroId, decidioDosPasosEn: null }, data: { decidioDosPasosEn: ahora } });
}

/* ---------------------------------------------------------------------------
   Configurar la app
   --------------------------------------------------------------------------- */

/**
 * La clave para configurar la app (en base32, para el QR y para escribirla a
 * mano). Si ya habia una configuracion a medias, la misma: recargar la
 * pagina no invalida lo que ya se escaneo. Si la app ya esta configurada,
 * no: cambiarla es pasar por «Tu hogar», con un codigo.
 */
export async function claveParaConfigurar(
  miembroId: string,
  { db = prisma, maestra = claveMaestra() }: OpcionesDeDosPasos = {},
): Promise<string> {
  const existente = await db.dosPasos.findUnique({ where: { miembroId } });
  if (existente?.confirmadoEn) throw new ErrorDeDosPasos("Ya tienes la app configurada.");
  if (existente) return aBase32(descifrarClaveDeApp(existente.claveCifrada, miembroId, maestra));

  const clave = nuevaClaveDeApp();
  try {
    await db.dosPasos.create({ data: { miembroId, claveCifrada: cifrarClaveDeApp(clave, miembroId, maestra) } });
    return aBase32(clave);
  } catch (error) {
    // Otra pestana la creo recien: se usa esa.
    const otra = await db.dosPasos.findUnique({ where: { miembroId } });
    if (otra && !otra.confirmadoEn) return aBase32(descifrarClaveDeApp(otra.claveCifrada, miembroId, maestra));
    throw error;
  }
}

/** Un codigo equivocado: suma un intento y, al llegar al limite, bloquea. */
async function registrarFallo(db: Pick<Base, "dosPasos">, miembroId: string, ahora: Date): Promise<string> {
  // El incremento es atomico: dos intentos a la vez cuentan los dos.
  const { intentos } = await db.dosPasos.update({
    where: { miembroId },
    data: { intentos: { increment: 1 } },
    select: { intentos: true },
  });
  const resultado = trasUnFallo(intentos - 1, ahora);
  if (resultado.bloqueadoHasta !== null) {
    await db.dosPasos.update({ where: { miembroId }, data: resultado });
  }
  return mensajeDeFallo(resultado, ahora);
}

/** Crea codigos de respaldo nuevos (borra los anteriores) y los devuelve para mostrarlos una vez. */
async function crearCodigosDeRespaldo(db: Pick<Base, "codigoDeRespaldo">, miembroId: string, maestra: Buffer): Promise<string[]> {
  const codigos = nuevosCodigosDeRespaldo();
  await db.codigoDeRespaldo.deleteMany({ where: { miembroId } });
  await db.codigoDeRespaldo.createMany({
    data: codigos.map((c) => ({ miembroId, huella: huellaDeRespaldo(c, miembroId, maestra) })),
  });
  return codigos.map(formatearCodigoDeRespaldo);
}

export type ResultadoDeConfiguracion = { ok: true; codigos: string[] } | { ok: false; mensaje: string };

/**
 * El primer codigo de la app recien escaneada. Si es correcto, la app queda
 * configurada, se crean los codigos de respaldo (se devuelven para
 * mostrarlos una sola vez), esta sesion queda verificada y la persona queda
 * como que ya eligio.
 */
export async function confirmarConfiguracion(
  miembroId: string,
  sesionId: string,
  texto: string,
  { db = prisma, maestra = claveMaestra(), ahora = new Date() }: OpcionesDeDosPasos = {},
): Promise<ResultadoDeConfiguracion> {
  const fila = await db.dosPasos.findUnique({ where: { miembroId } });
  if (fila === null) return { ok: false, mensaje: "Vuelve a cargar la página para ver el código QR." };
  if (fila.confirmadoEn) return { ok: false, mensaje: "Ya tienes la app configurada." };
  if (estaBloqueado(fila.bloqueadoHasta, ahora)) return { ok: false, mensaje: mensajeDeBloqueo(fila.bloqueadoHasta!, ahora) };

  const codigo = limpiarCodigoDeApp(texto);
  if (codigo === null) return { ok: false, mensaje: `Escribe los ${DOS_PASOS.digitos} dígitos que muestra la app.` };

  const revision = revisarCodigoDeApp(descifrarClaveDeApp(fila.claveCifrada, miembroId, maestra), codigo, ahora, null);
  if (!revision.ok) return { ok: false, mensaje: await registrarFallo(db, miembroId, ahora) };

  return db.$transaction(async (tx) => {
    // Solo si sigue a medias: dos pestanas no la confirman dos veces.
    const { count } = await tx.dosPasos.updateMany({
      where: { miembroId, confirmadoEn: null },
      data: { confirmadoEn: ahora, ultimoPaso: revision.paso, intentos: 0, bloqueadoHasta: null },
    });
    if (count === 0) return { ok: false, mensaje: "Ya tienes la app configurada." } as const;
    await tx.miembro.updateMany({ where: { id: miembroId, decidioDosPasosEn: null }, data: { decidioDosPasosEn: ahora } });
    const codigos = await crearCodigosDeRespaldo(tx, miembroId, maestra);
    await verificarLaSesion(tx, miembroId, sesionId, ahora);
    return { ok: true, codigos } as const;
  });
}

/* ---------------------------------------------------------------------------
   Entrar: el codigo de la app o uno de respaldo
   --------------------------------------------------------------------------- */

export type ResultadoDeVerificacion =
  | { ok: true; conRespaldo: boolean; respaldosQueQuedan: number }
  | { ok: false; mensaje: string };

/**
 * Revisa el codigo de la app o uno de respaldo (una vez cada uno), con los
 * intentos y el bloqueo. No verifica ninguna sesion: eso lo hace quien la
 * llama. La usan entrar, desactivar la verificacion y pasar la app a otro
 * celular.
 */
async function revisarCodigo(
  db: Pick<Base, "dosPasos" | "codigoDeRespaldo">,
  miembroId: string,
  texto: string,
  maestra: Buffer,
  ahora: Date,
): Promise<{ ok: true; conRespaldo: boolean } | { ok: false; mensaje: string }> {
  const fila = await db.dosPasos.findUnique({ where: { miembroId } });
  if (fila === null || fila.confirmadoEn === null) {
    return { ok: false, mensaje: "Primero tienes que configurar la app." };
  }
  if (estaBloqueado(fila.bloqueadoHasta, ahora)) return { ok: false, mensaje: mensajeDeBloqueo(fila.bloqueadoHasta!, ahora) };

  const deApp = limpiarCodigoDeApp(texto);
  const deRespaldo = deApp === null ? limpiarCodigoDeRespaldo(texto) : null;
  if (deApp === null && deRespaldo === null) {
    return {
      ok: false,
      mensaje: `Escribe los ${DOS_PASOS.digitos} dígitos de la app, o un código de respaldo (como ABCDE-FGHJK).`,
    };
  }

  if (deApp !== null) {
    const revision = revisarCodigoDeApp(
      descifrarClaveDeApp(fila.claveCifrada, miembroId, maestra),
      deApp,
      ahora,
      fila.ultimoPaso,
    );
    if (revision.ok) {
      // Se guarda el paso solo si sigue siendo mayor: si otra pestana uso
      // este mismo codigo en el mismo instante, una de las dos pierde.
      const { count } = await db.dosPasos.updateMany({
        where: { miembroId, OR: [{ ultimoPaso: null }, { ultimoPaso: { lt: revision.paso } }] },
        data: { ultimoPaso: revision.paso, intentos: 0, bloqueadoHasta: null },
      });
      if (count === 1) return { ok: true, conRespaldo: false };
    }
    return { ok: false, mensaje: await registrarFallo(db, miembroId, ahora) };
  }

  // Codigo de respaldo: se marca usado en el mismo paso que se revisa.
  const { count } = await db.codigoDeRespaldo.updateMany({
    where: { miembroId, huella: huellaDeRespaldo(deRespaldo!, miembroId, maestra), usadoEn: null },
    data: { usadoEn: ahora },
  });
  if (count === 0) return { ok: false, mensaje: await registrarFallo(db, miembroId, ahora) };
  await db.dosPasos.update({ where: { miembroId }, data: { intentos: 0, bloqueadoHasta: null } });
  return { ok: true, conRespaldo: true };
}

/**
 * El segundo paso al entrar. Sirve el codigo de 6 digitos de la app o, si se
 * perdio el celular, uno de los codigos de respaldo (una vez cada uno).
 * Si es correcto, esta sesion queda verificada.
 */
export async function verificarCodigo(
  miembroId: string,
  sesionId: string,
  texto: string,
  { db = prisma, maestra = claveMaestra(), ahora = new Date() }: OpcionesDeDosPasos = {},
): Promise<ResultadoDeVerificacion> {
  const revision = await revisarCodigo(db, miembroId, texto, maestra, ahora);
  if (!revision.ok) return revision;
  await verificarLaSesion(db, miembroId, sesionId, ahora);
  return { ok: true, conRespaldo: revision.conRespaldo, respaldosQueQuedan: await respaldosQueQuedan(miembroId, db) };
}

/* ---------------------------------------------------------------------------
   Desde «Tu hogar»
   --------------------------------------------------------------------------- */

/** Cuantos codigos de respaldo le quedan sin usar. */
export async function respaldosQueQuedan(miembroId: string, db: Pick<Base, "codigoDeRespaldo"> = prisma): Promise<number> {
  return db.codigoDeRespaldo.count({ where: { miembroId, usadoEn: null } });
}

export type EstadoDeLaApp = { configuradaEn: Date | null; respaldosQueQuedan: number };

/** Lo que se muestra en «Tu hogar»: desde cuando tiene la app y cuantos respaldos le quedan. */
export async function estadoDeLaApp(miembroId: string, db: Base = prisma): Promise<EstadoDeLaApp> {
  const [fila, quedan] = await Promise.all([
    db.dosPasos.findUnique({ where: { miembroId }, select: { confirmadoEn: true } }),
    respaldosQueQuedan(miembroId, db),
  ]);
  return { configuradaEn: fila?.confirmadoEn ?? null, respaldosQueQuedan: quedan };
}

/** Codigos de respaldo nuevos: los anteriores dejan de servir. */
export async function renovarCodigosDeRespaldo(
  miembroId: string,
  { db = prisma, maestra = claveMaestra() }: OpcionesDeDosPasos = {},
): Promise<string[]> {
  const fila = await db.dosPasos.findUnique({ where: { miembroId }, select: { confirmadoEn: true } });
  if (!fila?.confirmadoEn) throw new ErrorDeDosPasos("Primero tienes que configurar la app.");
  return db.$transaction((tx) => crearCodigosDeRespaldo(tx, miembroId, maestra));
}

/**
 * Desactivar la verificacion, o pasar la app a otro celular: se quita la
 * app y sus codigos de respaldo. Pide un codigo de la app o uno de respaldo:
 * quien encuentre la sesion abierta en otro computador no puede quitarla.
 *
 * Esta sesion sigue abierta. Las demas de la persona (otro computador, otro
 * navegador) dejan de estar verificadas: si la vuelve a activar, ahi tienen
 * que poner el codigo, y si la app se cambia porque se perdio el celular,
 * quien lo tenga no sigue adentro con una sesion vieja.
 */
export async function quitarMiApp(
  miembroId: string,
  sesionActual: string,
  texto: string,
  { db = prisma, maestra = claveMaestra(), ahora = new Date() }: OpcionesDeDosPasos = {},
): Promise<ResultadoDeCodigo> {
  const revision = await revisarCodigo(db, miembroId, texto, maestra, ahora);
  if (!revision.ok) return revision;
  await db.$transaction([
    db.sesionVerificada.deleteMany({ where: { miembroId, id: { not: sesionActual } } }),
    db.codigoDeRespaldo.deleteMany({ where: { miembroId } }),
    db.dosPasos.deleteMany({ where: { miembroId } }),
  ]);
  return { ok: true };
}

/**
 * El dueno le reinicia la app a otro miembro que perdio el celular y sus
 * codigos de respaldo: se le quita la app y sus sesiones dejan de estar
 * verificadas. En su proximo clic, Luka le pregunta de nuevo si la activa.
 *
 * Solo el dueno, solo a alguien de su hogar, y no a si mismo (para eso
 * estan los codigos de respaldo): si no, cualquiera con la sesion de Google
 * del dueno podria saltarse el segundo paso.
 */
export async function reiniciarAppDe(
  hogarId: string,
  quienId: string,
  miembroId: string,
  db: Base = prisma,
): Promise<void> {
  if (quienId === miembroId) {
    throw new ErrorDeDosPasos("Tu propia app no se reinicia desde aquí: usa un código de respaldo para entrar.");
  }
  await db.$transaction(async (tx) => {
    const [quien, otro] = await Promise.all([
      tx.miembro.findFirst({ where: { id: quienId, hogarId }, select: { rol: true } }),
      tx.miembro.findFirst({ where: { id: miembroId, hogarId }, select: { id: true } }),
    ]);
    if (quien?.rol !== "DUENO") throw new ErrorDeDosPasos("Solo el dueño del hogar puede reiniciar la app de alguien.");
    if (otro === null) throw new ErrorDeDosPasos("Esa persona no es parte de tu hogar.");
    await tx.sesionVerificada.deleteMany({ where: { miembroId } });
    await tx.codigoDeRespaldo.deleteMany({ where: { miembroId } });
    await tx.dosPasos.deleteMany({ where: { miembroId } });
    await tx.miembro.update({ where: { id: miembroId }, data: { decidioDosPasosEn: null } });
  });
}

/** Quienes del hogar tienen la app configurada, para la lista de miembros. */
export async function appsDelHogar(hogarId: string, db: Base = prisma): Promise<Set<string>> {
  const filas = await db.dosPasos.findMany({
    where: { miembro: { hogarId }, confirmadoEn: { not: null } },
    select: { miembroId: true },
  });
  return new Set(filas.map((f) => f.miembroId));
}
