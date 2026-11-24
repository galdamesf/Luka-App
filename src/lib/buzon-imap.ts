import { ImapFlow } from "imapflow";
import type { ConfiguracionDelBuzon } from "./buzon";

/**
 * El buzon de Luka por IMAP: traer los correos que llegaron a las
 * direcciones de Luka y borrarlos despues de leerlos. Que se hace con cada
 * uno esta en src/datos/buzon.ts; la configuracion, en src/lib/buzon.ts.
 */

/** Un correo del buzon antes de traerlo: lo justo para saber a quien va. */
export type CorreoEnElBuzon = {
  carpeta: string;
  uid: number;
  /** Delivered-To, X-Original-To, X-Forwarded-To, To y Cc. */
  destinatarios: string[];
};

/** Por donde llegan los correos. La de verdad es IMAP; las pruebas usan una en memoria. */
export interface FuenteDeCorreos {
  listar(): Promise<CorreoEnElBuzon[]>;
  traer(correo: CorreoEnElBuzon): Promise<Uint8Array>;
  /** Despues de leerlos: van a la papelera y se borran de ahi. */
  borrar(correos: readonly CorreoEnElBuzon[]): Promise<void>;
  cerrar(): Promise<void>;
}

/** Lo que se usa de ImapFlow. Las pruebas le pasan uno propio, sin red. */
export interface ClienteImap {
  connect(): Promise<void>;
  list(): Promise<{ path: string; specialUse?: string | undefined }[]>;
  getMailboxLock(path: string): Promise<{ release(): void }>;
  search(query: { since: Date }, options: { uid: true }): Promise<number[] | false | undefined>;
  fetch(
    range: number[],
    query: { uid: true; headers: string[] },
    options: { uid: true },
  ): AsyncIterable<{ uid: number; headers?: Buffer | undefined }>;
  fetchOne(uid: number, query: { source: true }, options: { uid: true }): Promise<{ source?: Buffer | undefined } | false>;
  messageMove(range: number[], destino: string, options: { uid: true }): Promise<{ uidMap?: Map<number, number> | undefined } | false>;
  messageDelete(range: number[], options: { uid: true }): Promise<boolean>;
  logout(): Promise<void>;
}

const ENCABEZADOS_DE_DESTINO = ["delivered-to", "x-original-to", "x-forwarded-to", "to", "cc"];
const UN_CORREO = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/** Las direcciones de los encabezados que trae IMAP (lineas «Clave: valor», que pueden venir dobladas). */
export function destinatariosDeEncabezados(crudo: string): string[] {
  const desdoblado = crudo.replace(/\r?\n[ \t]+/g, " ");
  return desdoblado
    .split(/\r?\n/)
    .filter((linea) => ENCABEZADOS_DE_DESTINO.includes(linea.slice(0, linea.indexOf(":")).trim().toLowerCase()))
    .flatMap((linea) => [...linea.slice(linea.indexOf(":") + 1).matchAll(UN_CORREO)].map((m) => m[0].toLowerCase()));
}

/** Cuantos dias hacia atras se buscan correos: lo mas viejo ya no se espera. */
export const DIAS_QUE_SE_REVISAN = 14;

function crearClienteImap(config: ConfiguracionDelBuzon): ClienteImap {
  return new ImapFlow({
    host: config.servidor,
    port: config.puerto,
    secure: config.puerto === 993,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

/**
 * Abre el buzon por IMAP. Mira la bandeja de entrada y la de spam (a veces
 * un reenvio cae ahi), y borra moviendo a la papelera y vaciandola: en Gmail,
 * sacar un correo de la bandeja solo lo archiva.
 */
export async function abrirBuzonImap(
  config: ConfiguracionDelBuzon,
  { ahora = new Date(), crearCliente = crearClienteImap }: { ahora?: Date; crearCliente?: (c: ConfiguracionDelBuzon) => ClienteImap } = {},
): Promise<FuenteDeCorreos> {
  const cliente = crearCliente(config);
  await cliente.connect();
  const carpetas = await cliente.list();
  const spam = carpetas.find((c) => c.specialUse === "\\Junk")?.path ?? null;
  const papelera = carpetas.find((c) => c.specialUse === "\\Trash")?.path ?? null;
  const revisar = ["INBOX", ...(spam ? [spam] : [])];
  const desde = new Date(ahora.getTime() - DIAS_QUE_SE_REVISAN * 24 * 60 * 60_000);

  async function enLaCarpeta<T>(carpeta: string, hacer: () => Promise<T>): Promise<T> {
    const candado = await cliente.getMailboxLock(carpeta);
    try {
      return await hacer();
    } finally {
      candado.release();
    }
  }

  return {
    async listar() {
      const lista: CorreoEnElBuzon[] = [];
      for (const carpeta of revisar) {
        await enLaCarpeta(carpeta, async () => {
          const uids = (await cliente.search({ since: desde }, { uid: true })) || [];
          if (uids.length === 0) return;
          for await (const mensaje of cliente.fetch(uids, { uid: true, headers: ENCABEZADOS_DE_DESTINO }, { uid: true })) {
            lista.push({ carpeta, uid: mensaje.uid, destinatarios: destinatariosDeEncabezados(mensaje.headers?.toString("utf8") ?? "") });
          }
        });
      }
      return lista;
    },

    async traer(correo) {
      return enLaCarpeta(correo.carpeta, async () => {
        const mensaje = await cliente.fetchOne(correo.uid, { source: true }, { uid: true });
        if (!mensaje || !mensaje.source) throw new Error(`El correo ${correo.uid} ya no esta en ${correo.carpeta}.`);
        return new Uint8Array(mensaje.source);
      });
    },

    async borrar(correos) {
      const porCarpeta = new Map<string, number[]>();
      for (const correo of correos) porCarpeta.set(correo.carpeta, [...(porCarpeta.get(correo.carpeta) ?? []), correo.uid]);

      for (const [carpeta, uids] of porCarpeta) {
        if (papelera === null || carpeta === papelera) {
          await enLaCarpeta(carpeta, () => cliente.messageDelete(uids, { uid: true }));
          continue;
        }
        const movidos = await enLaCarpeta(carpeta, () => cliente.messageMove(uids, papelera, { uid: true }));
        const enLaPapelera = movidos && movidos.uidMap ? [...movidos.uidMap.values()] : [];
        if (enLaPapelera.length > 0) await enLaCarpeta(papelera, () => cliente.messageDelete(enLaPapelera, { uid: true }));
      }
    },

    async cerrar() {
      await cliente.logout();
    },
  };
}
