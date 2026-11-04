import { CODIGO_DE_BORRADO } from "./hogar";

/**
 * El texto de los correos que manda Luka, sin nada de como se mandan
 * (src/lib/correo.ts). Cada correo va en texto y en HTML; en el HTML todo lo
 * que escribio una persona (el nombre del hogar, su nombre) va escapado: un
 * nombre de hogar no puede meter enlaces ni etiquetas en un correo.
 */

/** Escapa lo que va dentro de HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function correoDeCodigoDeBorrado({
  nombreDelHogar,
  nombre,
  codigo,
}: {
  nombreDelHogar: string;
  /** El primer nombre de quien lo pidio, si se sabe. */
  nombre: string | null;
  codigo: string;
}): { asunto: string; texto: string; html: string } {
  const minutos = CODIGO_DE_BORRADO.minutosDeVigencia;
  const saludo = nombre ? `Hola, ${nombre}:` : "Hola:";
  const parrafos = [
    `Pediste borrar el hogar «${nombreDelHogar}» en Luka. Para confirmarlo, escribe este código en Luka:`,
    `Vence en ${minutos} minutos y sirve una sola vez. Al borrar el hogar se pierden todos sus gastos, cuentas, deudas, presupuestos, ahorros y boletas, y no se puede deshacer.`,
    "Si no fuiste tú, no hagas nada: sin este código nadie puede borrar tu hogar. Pero alguien está usando tu sesión de Luka, así que conviene cerrarla con «Salir».",
  ];

  const texto = [saludo, "", parrafos[0], "", `    ${codigo}`, "", parrafos[1], "", parrafos[2], "", "Luka"].join("\n");

  const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155">${escaparHtml(t)}</p>`;
  const html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">',
    p(saludo),
    p(parrafos[0]!),
    `<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;font-family:ui-monospace,Menlo,Consolas,monospace">${escaparHtml(codigo)}</p>`,
    p(parrafos[1]!),
    p(parrafos[2]!),
    '<p style="margin:0;font-size:13px;color:#64748b">Luka</p>',
    "</div>",
  ].join("");

  return { asunto: `Código para borrar «${nombreDelHogar}» en Luka`, texto, html };
}
