import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarCorreoDelEntorno, type EnviarCorreo } from "@/lib/correo";
import { codigoAlAzar, huellaDelCodigoDeCorreo, mismaHuella, secretoDeCodigos } from "@/lib/codigos";
import { servidoresDeCorreo, type BuscarServidores } from "@/lib/mx";
import { configuracionDelBuzon } from "@/lib/buzon";
import { esDelBuzon } from "@/dominio/buzon";
import { correoDeCodigoDeCorreo } from "@/dominio/correos";
import {
  CODIGO_DE_CORREO,
  MAXIMO_DE_CORREOS,
  codigoDeCorreoEquivocado,
  dominioDe,
  limpiarCodigoDeCorreo,
  limpiarCorreo,
  proveedorDe,
  proveedorPorDominio,
  revisarCodigoDeCorreo,
  segundosParaOtroCodigo,
  type ProveedorDeCorreo,
} from "@/dominio/correos-registrados";
import { primerNombre } from "@/dominio/hogar";

/**
 * Los correos donde a cada persona le llegan comprobantes: registrarlos,
 * confirmarlos con un codigo que llega a ese correo y quitarlos. Las reglas
 * estan en src/dominio/correos-registrados.ts.
 *
 * Cada persona maneja solo los suyos: todo se busca por su miembro y su
 * hogar, nunca por lo que mande el navegador.
 */

export class ErrorDeCorreo extends Error {}

type Db = PrismaClient;
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

export type OpcionesDeCorreo = {
  db?: Db;
  /** Por omision, el correo del .env. */
  enviar?: EnviarCorreo | null;
  /** Por omision, AUTH_SECRET. */
  secreto?: string;
  ahora?: Date;
  /** Por omision, los MX del DNS. */
  buscarServidores?: BuscarServidores;
  /** La direccion del buzon de Luka, que nunca es de una persona. Por omision, la del .env. */
  buzon?: string | null;
};

/** Un correo de la persona, como se muestra. */
export type CorreoDeLaPersona = {
  /** Vacio en el de Google, que no es un registro. */
  id: string | null;
  direccion: string;
  proveedor: ProveedorDeCorreo;
  confirmado: boolean;
  /** El de Google con que entra a Luka: ya esta confirmado y no se quita. */
  principal: boolean;
  /** Hay un codigo pedido que todavia sirve. */
  esperandoCodigo: boolean;
};

/** Mientras Luka no pueda mandar correos, no se puede confirmar ninguno. */
const SIN_CORREO =
  "Luka todavía no puede mandar correos, así que por ahora no puede confirmar otro correo tuyo. Mientras, usa el de Google con que entras.";

async function miembroDelHogar(db: Db | Tx, hogarId: string, miembroId: string) {
  const miembro = await db.miembro.findFirst({
    where: { id: miembroId, hogarId },
    select: { id: true, correo: true, nombre: true, entroEn: true },
  });
  if (!miembro) throw new ErrorDeCorreo("Ya no eres parte de este hogar.");
  return miembro;
}

/** Lo que ya se averiguo de cada dominio propio, mientras el servidor siga arriba. */
const proveedoresPorDominio = new Map<string, ProveedorDeCorreo>();

async function proveedorDelCorreo(direccion: string, buscar: BuscarServidores): Promise<ProveedorDeCorreo> {
  const dominio = dominioDe(direccion);
  const publico = proveedorPorDominio(dominio);
  if (publico !== null) return publico;
  const sabido = proveedoresPorDominio.get(dominio);
  if (sabido !== undefined) return sabido;
  const proveedor = proveedorDe(direccion, await buscar(dominio));
  proveedoresPorDominio.set(dominio, proveedor);
  return proveedor;
}

/**
 * Los correos de la persona: primero el de Google con que entra, despues
 * los que registro, en el orden en que los agrego.
 */
export async function leerMisCorreos(
  hogarId: string,
  miembroId: string,
  { db = prisma, ahora = new Date(), buscarServidores = servidoresDeCorreo }: Omit<OpcionesDeCorreo, "enviar" | "secreto"> = {},
): Promise<CorreoDeLaPersona[]> {
  const miembro = await miembroDelHogar(db, hogarId, miembroId);
  const registrados = await db.correoRegistrado.findMany({
    where: { miembroId },
    orderBy: { creadoEn: "asc" },
    select: { id: true, direccion: true, proveedor: true, confirmadoEn: true, codigoVenceEn: true },
  });
  return [
    {
      id: null,
      direccion: miembro.correo,
      proveedor: await proveedorDelCorreo(miembro.correo, buscarServidores),
      confirmado: true,
      principal: true,
      esperandoCodigo: false,
    },
    ...registrados.map((r) => ({
      id: r.id,
      direccion: r.direccion,
      proveedor: r.proveedor,
      confirmado: r.confirmadoEn !== null,
      principal: false,
      esperandoCodigo: r.confirmadoEn === null && r.codigoVenceEn !== null && r.codigoVenceEn.getTime() > ahora.getTime(),
    })),
  ];
}

/**
 * Los correos desde los que el buzon acepta los comprobantes de esa persona:
 * el de Google con que entra (si ya entro) y los que confirmo con el codigo.
 */
export async function correosConfirmados(miembroId: string, db: Db = prisma): Promise<string[]> {
  const miembro = await db.miembro.findUnique({
    where: { id: miembroId },
    select: { correo: true, entroEn: true, correosRegistrados: { where: { confirmadoEn: { not: null } }, select: { direccion: true } } },
  });
  if (!miembro) return [];
  return [...(miembro.entroEn !== null ? [miembro.correo] : []), ...miembro.correosRegistrados.map((c) => c.direccion)];
}

/**
 * Registra un correo y le manda el codigo para confirmarlo. Si ya estaba sin
 * confirmar, manda otro codigo. Devuelve el registro.
 */
export async function agregarCorreo(
  hogarId: string,
  miembroId: string,
  texto: string,
  opciones: OpcionesDeCorreo = {},
): Promise<{ id: string; direccion: string }> {
  const { db = prisma, buscarServidores = servidoresDeCorreo } = opciones;
  const direccion = limpiarCorreo(texto);
  if (direccion === null) throw new ErrorDeCorreo("Escribe un correo válido, como nombre@hotmail.com.");
  const buzon = opciones.buzon === undefined ? (configuracionDelBuzon()?.direccion ?? null) : opciones.buzon;
  if (buzon !== null && esDelBuzon(direccion, buzon)) {
    throw new ErrorDeCorreo("Esa es una dirección de Luka. Escribe un correo tuyo, uno donde te lleguen los comprobantes.");
  }

  const miembro = await miembroDelHogar(db, hogarId, miembroId);
  if (direccion === miembro.correo) throw new ErrorDeCorreo("Ese es tu correo de Google: ya está conectado.");

  const yaEsta = await db.correoRegistrado.findUnique({
    where: { miembroId_direccion: { miembroId, direccion } },
    select: { id: true, confirmadoEn: true },
  });
  if (yaEsta?.confirmadoEn) throw new ErrorDeCorreo("Ese correo ya está en tu lista, confirmado.");
  if (yaEsta) {
    await pedirCodigoDeCorreo(hogarId, miembroId, yaEsta.id, opciones);
    return { id: yaEsta.id, direccion };
  }

  const cuantos = await db.correoRegistrado.count({ where: { miembroId } });
  if (cuantos >= MAXIMO_DE_CORREOS) {
    throw new ErrorDeCorreo(`Puedes conectar hasta ${MAXIMO_DE_CORREOS} correos además del de Google. Quita uno para agregar otro.`);
  }

  // Sin correo para mandar el codigo no tiene sentido guardarlo.
  const enviar = opciones.enviar === undefined ? enviarCorreoDelEntorno() : opciones.enviar;
  if (enviar === null) throw new ErrorDeCorreo(SIN_CORREO);

  const proveedor = await proveedorDelCorreo(direccion, buscarServidores);
  let creado: { id: string };
  try {
    creado = await db.correoRegistrado.create({ data: { miembroId, direccion, proveedor }, select: { id: true } });
  } catch (error) {
    // Dos clics a la vez: el segundo choca con el indice unico.
    if ((error as { code?: string }).code === "P2002") throw new ErrorDeCorreo("Ese correo ya está en tu lista.");
    throw error;
  }
  await pedirCodigoDeCorreo(hogarId, miembroId, creado.id, { ...opciones, enviar });
  return { id: creado.id, direccion };
}

/**
 * Manda el codigo a ese correo y guarda su huella. Uno por minuto. Si el
 * correo no sale, el codigo se borra para que pueda pedir otro al tiro.
 */
export async function pedirCodigoDeCorreo(
  hogarId: string,
  miembroId: string,
  correoId: string,
  opciones: OpcionesDeCorreo = {},
): Promise<{ direccion: string }> {
  const { db = prisma, ahora = new Date() } = opciones;
  const enviar = opciones.enviar === undefined ? enviarCorreoDelEntorno() : opciones.enviar;
  if (enviar === null) {
    console.error("Para confirmar correos falta configurar el correo de Luka: CORREO_SMTP_USUARIO y CORREO_SMTP_CLAVE (ver .env.example).");
    throw new ErrorDeCorreo(SIN_CORREO);
  }
  const secreto = opciones.secreto ?? secretoDeCodigos();
  const codigo = codigoAlAzar(CODIGO_DE_CORREO.digitos);

  const destino = await db.$transaction(async (tx) => {
    const miembro = await miembroDelHogar(tx, hogarId, miembroId);
    const registro = await tx.correoRegistrado.findFirst({
      where: { id: correoId, miembroId },
      select: { direccion: true, confirmadoEn: true, codigoPedidoEn: true },
    });
    if (!registro) throw new ErrorDeCorreo("Ese correo ya no está en tu lista.");
    if (registro.confirmadoEn) throw new ErrorDeCorreo("Ese correo ya está confirmado.");

    const espera = segundosParaOtroCodigo(registro.codigoPedidoEn, ahora);
    if (espera > 0) throw new ErrorDeCorreo(`Ya te mandamos un código. Para pedir otro, espera ${espera} segundos.`);

    await tx.correoRegistrado.update({
      where: { id: correoId },
      data: {
        huellaDelCodigo: huellaDelCodigoDeCorreo(codigo, correoId, secreto),
        codigoPedidoEn: ahora,
        codigoVenceEn: new Date(ahora.getTime() + CODIGO_DE_CORREO.minutosDeVigencia * 60_000),
        intentos: 0,
      },
    });
    return { direccion: registro.direccion, nombre: miembro.nombre === null ? null : primerNombre(miembro) };
  });

  try {
    await enviar({ para: destino.direccion, ...correoDeCodigoDeCorreo({ ...destino, codigo }) });
  } catch (error) {
    await db.correoRegistrado.updateMany({
      where: { id: correoId, miembroId },
      data: { huellaDelCodigo: null, codigoPedidoEn: null, codigoVenceEn: null, intentos: 0 },
    });
    console.error("No se pudo mandar el codigo para confirmar un correo:", error);
    throw new ErrorDeCorreo("No se pudo mandar el correo con el código. Revisa que el correo esté bien escrito e intenta de nuevo en un rato.");
  }
  return { direccion: destino.direccion };
}

/**
 * Confirma el correo con el codigo que le llego. Cada intento se cuenta
 * antes de comparar, en la misma fila y dentro de la transaccion: dos
 * intentos a la vez esperan su turno.
 */
export async function confirmarCorreo(
  hogarId: string,
  miembroId: string,
  correoId: string,
  codigoEscrito: string,
  opciones: Omit<OpcionesDeCorreo, "enviar"> = {},
): Promise<{ direccion: string }> {
  const { db = prisma, ahora = new Date() } = opciones;
  const codigo = limpiarCodigoDeCorreo(codigoEscrito);
  if (codigo === null) throw new ErrorDeCorreo("El código son los 6 números que te llegaron a ese correo.");
  const secreto = opciones.secreto ?? secretoDeCodigos();

  const resultado = await db.$transaction(async (tx) => {
    await miembroDelHogar(tx, hogarId, miembroId);
    const registro = await tx.correoRegistrado.findFirst({
      where: { id: correoId, miembroId },
      select: { direccion: true, confirmadoEn: true, huellaDelCodigo: true, codigoVenceEn: true, intentos: true },
    });
    if (!registro) return { error: "Ese correo ya no está en tu lista." } as const;
    if (registro.confirmadoEn) return { direccion: registro.direccion } as const;

    const motivo = revisarCodigoDeCorreo(
      { hayCodigo: registro.huellaDelCodigo !== null, venceEn: registro.codigoVenceEn, intentos: registro.intentos },
      ahora,
    );
    if (motivo !== null) return { error: motivo } as const;

    const contado = await tx.correoRegistrado.updateMany({
      where: { id: correoId, intentos: { lt: CODIGO_DE_CORREO.intentos } },
      data: { intentos: { increment: 1 } },
    });
    if (contado.count === 0) return { error: "Se acabaron los intentos con ese código. Pide uno nuevo." } as const;
    // Si no es, la transaccion termina bien para que el intento quede contado.
    if (!mismaHuella(huellaDelCodigoDeCorreo(codigo, correoId, secreto), registro.huellaDelCodigo!)) {
      return { error: codigoDeCorreoEquivocado(registro.intentos + 1) } as const;
    }

    await tx.correoRegistrado.update({
      where: { id: correoId },
      data: { confirmadoEn: ahora, huellaDelCodigo: null, codigoPedidoEn: null, codigoVenceEn: null, intentos: 0 },
    });
    return { direccion: registro.direccion } as const;
  });

  if ("error" in resultado) throw new ErrorDeCorreo(resultado.error);
  return resultado;
}

/** Quita un correo de la lista: desde ahi, lo que reenvie ya no se lee. */
export async function quitarCorreo(
  hogarId: string,
  miembroId: string,
  correoId: string,
  db: Db = prisma,
): Promise<{ direccion: string }> {
  await miembroDelHogar(db, hogarId, miembroId);
  const registro = await db.correoRegistrado.findFirst({ where: { id: correoId, miembroId }, select: { direccion: true } });
  const borrado = await db.correoRegistrado.deleteMany({ where: { id: correoId, miembroId } });
  if (!registro || borrado.count === 0) throw new ErrorDeCorreo("Ese correo ya no está en tu lista.");
  return { direccion: registro.direccion };
}
