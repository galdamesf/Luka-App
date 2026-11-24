import { destinatariosDeEncabezados, type CorreoEnElBuzon, type FuenteDeCorreos } from "@/lib/buzon-imap";

/** Un buzon en memoria, como el de IMAP: cada correo con sus destinatarios, como los trae IMAP. */
export function buzonEnMemoria(correos: Buffer[]): FuenteDeCorreos & { quedan: () => number; cerrado: () => boolean } {
  const vivos = new Map(correos.map((correo, i) => [i + 1, correo]));
  let cerrado = false;
  return {
    async listar() {
      return [...vivos].map(([uid, correo]): CorreoEnElBuzon => {
        const texto = correo.toString("utf8");
        return { carpeta: "INBOX", uid, destinatarios: destinatariosDeEncabezados(texto.slice(0, texto.indexOf("\r\n\r\n"))) };
      });
    },
    async traer(correo) {
      return new Uint8Array(vivos.get(correo.uid)!);
    },
    async borrar(lista) {
      for (const correo of lista) vivos.delete(correo.uid);
    },
    async cerrar() {
      cerrado = true;
    },
    quedan: () => vivos.size,
    cerrado: () => cerrado,
  };
}
