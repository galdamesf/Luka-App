import { describe, expect, test } from "vitest";
import { configuracionDelBuzon } from "@/lib/buzon";
import { abrirBuzonImap, destinatariosDeEncabezados, type ClienteImap } from "@/lib/buzon-imap";

/*
  El buzon por IMAP sin red: un cliente falso que hace de Gmail, con su
  bandeja, su spam y su papelera. Lo que importa es que se busque en las dos
  carpetas, que solo se pidan los encabezados para decidir, y que borrar sea
  mover a la papelera y vaciarla (en Gmail, sacar de la bandeja solo archiva).
*/

type Mensaje = { uid: number; fecha: Date; crudo: string };

function gmailFalso(carpetas: Record<string, Mensaje[]>, { conPapelera = true } = {}) {
  const llamadas: string[] = [];
  let abierta = "";
  const enLaCarpeta = () => carpetas[abierta] ?? [];
  let siguienteUid = 1000;

  const cliente: ClienteImap = {
    async connect() {
      llamadas.push("connect");
    },
    async list() {
      return [
        { path: "INBOX", specialUse: "\\Inbox" },
        { path: "[Gmail]/Spam", specialUse: "\\Junk" },
        ...(conPapelera ? [{ path: "[Gmail]/Papelera", specialUse: "\\Trash" }] : []),
        { path: "[Gmail]/Todos", specialUse: "\\All" },
      ];
    },
    async getMailboxLock(path) {
      abierta = path;
      llamadas.push(`abrir ${path}`);
      return { release: () => llamadas.push(`soltar ${path}`) };
    },
    async search({ since }) {
      return enLaCarpeta().filter((m) => m.fecha >= since).map((m) => m.uid);
    },
    async *fetch(uids, query) {
      llamadas.push(`encabezados ${abierta} ${uids.join(",")} (${query.headers.join(",")})`);
      for (const m of enLaCarpeta().filter((x) => uids.includes(x.uid))) {
        yield { uid: m.uid, headers: Buffer.from(m.crudo.slice(0, m.crudo.indexOf("\r\n\r\n") + 2)) };
      }
    },
    async fetchOne(uid) {
      llamadas.push(`traer ${abierta} ${uid}`);
      const m = enLaCarpeta().find((x) => x.uid === uid);
      return m ? { source: Buffer.from(m.crudo) } : false;
    },
    async messageMove(uids, destino) {
      llamadas.push(`mover ${abierta} ${uids.join(",")} -> ${destino}`);
      const uidMap = new Map<number, number>();
      for (const uid of uids) {
        const i = enLaCarpeta().findIndex((x) => x.uid === uid);
        const [m] = enLaCarpeta().splice(i, 1);
        siguienteUid += 1;
        (carpetas[destino] ??= []).push({ ...m!, uid: siguienteUid });
        uidMap.set(uid, siguienteUid);
      }
      return { uidMap };
    },
    async messageDelete(uids) {
      llamadas.push(`borrar ${abierta} ${uids.join(",")}`);
      carpetas[abierta] = enLaCarpeta().filter((m) => !uids.includes(m.uid));
      return true;
    },
    async logout() {
      llamadas.push("logout");
    },
  };
  return { cliente, llamadas, carpetas };
}

const CONFIG = { direccion: "luka.prueba@gmail.com", servidor: "imap.gmail.com", puerto: 993, usuario: "luka.prueba@gmail.com", clave: "abcd" };
const AHORA = new Date("2026-11-20T15:00:00Z");
const crudo = (para: string, extra = "") => `Delivered-To: ${para}\r\n${extra}From: banco@banco.cl\r\nTo: camila@ejemplo.cl\r\nSubject: x\r\n\r\nCuerpo\r\n`;

describe("los encabezados que trae IMAP", () => {
  test("las direcciones de Delivered-To, X-Forwarded-To, To y Cc, aunque vengan dobladas", () => {
    const texto = [
      "Delivered-To: luka.prueba+k7q2m9xa4p@gmail.com",
      "X-Forwarded-To: luka.prueba+k7q2m9xa4p@gmail.com",
      "To: Camila Rojas",
      " <Camila@Ejemplo.cl>, otra@ejemplo.cl",
      "Subject: no+cuenta@ejemplo.cl",
      "",
    ].join("\r\n");
    expect(destinatariosDeEncabezados(texto)).toEqual([
      "luka.prueba+k7q2m9xa4p@gmail.com",
      "luka.prueba+k7q2m9xa4p@gmail.com",
      "camila@ejemplo.cl",
      "otra@ejemplo.cl",
    ]);
  });
});

describe("abrir el buzon", () => {
  test("lista la bandeja y el spam de los ultimos 14 dias, pidiendo solo los encabezados", async () => {
    const { cliente, llamadas } = gmailFalso({
      INBOX: [
        { uid: 1, fecha: new Date("2026-11-19T10:00:00Z"), crudo: crudo("luka.prueba+k7q2m9xa4p@gmail.com") },
        { uid: 2, fecha: new Date("2026-10-01T10:00:00Z"), crudo: crudo("luka.prueba+viejo2345@gmail.com") },
      ],
      "[Gmail]/Spam": [{ uid: 7, fecha: new Date("2026-11-20T10:00:00Z"), crudo: crudo("luka.prueba+k7q2m9xa4p@gmail.com") }],
    });
    const buzon = await abrirBuzonImap(CONFIG, { ahora: AHORA, crearCliente: () => cliente });
    expect(await buzon.listar()).toEqual([
      { carpeta: "INBOX", uid: 1, destinatarios: ["luka.prueba+k7q2m9xa4p@gmail.com", "camila@ejemplo.cl"] },
      { carpeta: "[Gmail]/Spam", uid: 7, destinatarios: ["luka.prueba+k7q2m9xa4p@gmail.com", "camila@ejemplo.cl"] },
    ]);
    expect(llamadas.filter((l) => l.startsWith("encabezados"))).toEqual([
      "encabezados INBOX 1 (delivered-to,x-original-to,x-forwarded-to,to,cc)",
      "encabezados [Gmail]/Spam 7 (delivered-to,x-original-to,x-forwarded-to,to,cc)",
    ]);
    // Cada carpeta se suelta despues de usarla.
    expect(llamadas.filter((l) => l.startsWith("abrir")).length).toBe(llamadas.filter((l) => l.startsWith("soltar")).length);
  });

  test("trae el correo entero solo cuando se lo pide", async () => {
    const { cliente } = gmailFalso({ INBOX: [{ uid: 1, fecha: AHORA, crudo: crudo("luka.prueba+k7q2m9xa4p@gmail.com") }] });
    const buzon = await abrirBuzonImap(CONFIG, { ahora: AHORA, crearCliente: () => cliente });
    const [correo] = await buzon.listar();
    expect(new TextDecoder().decode(await buzon.traer(correo!))).toContain("Cuerpo");
    await expect(buzon.traer({ carpeta: "INBOX", uid: 99, destinatarios: [] })).rejects.toThrow(/ya no esta/);
  });

  test("borrar es mover a la papelera y vaciarla; lo demas queda", async () => {
    const { cliente, llamadas, carpetas } = gmailFalso({
      INBOX: [
        { uid: 1, fecha: AHORA, crudo: crudo("luka.prueba+k7q2m9xa4p@gmail.com") },
        { uid: 2, fecha: AHORA, crudo: crudo("luka.prueba@gmail.com") },
      ],
      "[Gmail]/Spam": [{ uid: 7, fecha: AHORA, crudo: crudo("luka.prueba+k7q2m9xa4p@gmail.com") }],
    });
    const buzon = await abrirBuzonImap(CONFIG, { ahora: AHORA, crearCliente: () => cliente });
    await buzon.borrar([
      { carpeta: "INBOX", uid: 1, destinatarios: [] },
      { carpeta: "[Gmail]/Spam", uid: 7, destinatarios: [] },
    ]);
    expect(carpetas.INBOX!.map((m) => m.uid)).toEqual([2]);
    expect(carpetas["[Gmail]/Spam"]).toEqual([]);
    expect(carpetas["[Gmail]/Papelera"]).toEqual([]);
    expect(llamadas.filter((l) => l.startsWith("mover") || l.startsWith("borrar"))).toEqual([
      "mover INBOX 1 -> [Gmail]/Papelera",
      "borrar [Gmail]/Papelera 1001",
      "mover [Gmail]/Spam 7 -> [Gmail]/Papelera",
      "borrar [Gmail]/Papelera 1002",
    ]);
    await buzon.cerrar();
    expect(llamadas.at(-1)).toBe("logout");
  });

  test("sin papelera (otro servidor), se borra donde esta", async () => {
    const { cliente, carpetas } = gmailFalso({ INBOX: [{ uid: 1, fecha: AHORA, crudo: crudo("x") }] }, { conPapelera: false });
    const buzon = await abrirBuzonImap(CONFIG, { ahora: AHORA, crearCliente: () => cliente });
    await buzon.borrar([{ carpeta: "INBOX", uid: 1, destinatarios: [] }]);
    expect(carpetas.INBOX).toEqual([]);
  });
});

describe("la configuracion del buzon", () => {
  test("por omision, el correo con que Luka manda los codigos, en el IMAP de Gmail", () => {
    expect(configuracionDelBuzon({ CORREO_SMTP_USUARIO: " Luka.Prueba@gmail.com ", CORREO_SMTP_CLAVE: "abcd efgh ijkl mnop" })).toEqual({
      direccion: "luka.prueba@gmail.com",
      servidor: "imap.gmail.com",
      puerto: 993,
      usuario: "Luka.Prueba@gmail.com",
      clave: "abcdefghijklmnop",
    });
  });

  test("BUZON_* es para otro buzon", () => {
    expect(
      configuracionDelBuzon({
        CORREO_SMTP_USUARIO: "luka@gmail.com",
        CORREO_SMTP_CLAVE: "x",
        BUZON_USUARIO: "buzon@lukaapp.cl",
        BUZON_CLAVE: "y",
        BUZON_SERVIDOR: "imap.lukaapp.cl",
        BUZON_PUERTO: "143",
        BUZON_DIRECCION: "gastos@lukaapp.cl",
      }),
    ).toEqual({ direccion: "gastos@lukaapp.cl", servidor: "imap.lukaapp.cl", puerto: 143, usuario: "buzon@lukaapp.cl", clave: "y" });
  });

  test("sin correo o sin clave no hay buzon", () => {
    expect(configuracionDelBuzon({ CORREO_SMTP_USUARIO: "luka@gmail.com" })).toBeNull();
    expect(configuracionDelBuzon({ CORREO_SMTP_CLAVE: "x" })).toBeNull();
    expect(configuracionDelBuzon({})).toBeNull();
  });
});
