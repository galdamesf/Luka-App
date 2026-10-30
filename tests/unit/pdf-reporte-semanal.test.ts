import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { armarReporteSemanal, type ReporteSemanal } from "@/dominio/reporte-semanal";
import type { GastoPlano } from "@/dominio/resumen";
import { generarPdfReporteSemanal, nombreArchivoReporte, rangoDeLaSemana } from "@/lib/pdf-reporte-semanal";

const CAFE = { id: "c1", nombre: "Café", color: "#c38409", icono: "coffee", esencial: false };
const REGALOS = { id: "c2", nombre: "Regalos", color: "#9c5ac9", icono: "gift", esencial: false };
const TRANSPORTE = { id: "c3", nombre: "Transporte", color: "#0963ff", icono: "bus", esencial: true };

let n = 0;
const gasto = (fecha: string, monto: number, categoria = CAFE, extra: Partial<GastoPlano> = {}): GastoPlano => ({
  id: `g${++n}`, fecha, descripcion: `Gasto ${n}`, monto, medioPago: "DEBITO", notas: null,
  boletaArchivo: null, cuota: null, categoria, ...extra,
});

function reporte(gastos: GastoPlano[], semana = 5): ReporteSemanal {
  const r = armarReporteSemanal(gastos, "2026-10", semana, "2026-10-30");
  if (r === null) throw new Error("semana inexistente");
  return r;
}

/** El texto dibujado en el PDF, pagina por pagina (Helvetica estandar lo guarda en hex WinAnsi). */
async function textoDe(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((pagina) => {
    const contenido = pagina.node.get(PDFName.of("Contents"));
    const flujos = contenido instanceof PDFArray ? contenido.asArray() : [contenido];
    let texto = "";
    for (const ref of flujos) {
      const flujo = doc.context.lookup(ref as never);
      if (!(flujo instanceof PDFRawStream)) continue;
      const crudo = Buffer.from(inflateSync(flujo.getContents())).toString("latin1");
      for (const m of crudo.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
        texto += `${Buffer.from(m[1] as string, "hex").toString("latin1")}\n`;
      }
    }
    return texto;
  });
}

const GENERADO = new Date("2026-10-30T17:20:00Z");

describe("generarPdfReporteSemanal", () => {
  test("arma un PDF valido, con titulo, fecha de generacion y cada dato de la semana", async () => {
    const bytes = await generarPdfReporteSemanal(
      reporte([
        gasto("2026-10-29", 58_388, REGALOS, { descripcion: "Regalo cumpleaños", notas: "Para la Angelina", boletaArchivo: "a.jpg" }),
        gasto("2026-10-30", 8_378, TRANSPORTE, { descripcion: "Bip!" }),
      ]),
      GENERADO,
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Reporte semanal Luka · Semana 5 · 29 al 31 de octubre de 2026");

    const paginas = await textoDe(bytes);
    const todo = paginas.join("\n");
    for (const esperado of [
      "Semana 5 · 29 al 31 de octubre de 2026",
      "Generado el 30 de octubre de 2026, 14:20",
      "$66.766",
      "Regalo cumpleaños",
      "Para la Angelina",
      "Bip!",
      "Jueves 29 de octubre",
      `Página 1 de ${paginas.length}`,
      "Muy alto",
      "Total · 2 gastos",
    ]) {
      expect(todo, esperado).toContain(esperado);
    }
  });

  test("cada gasto sale en el detalle aunque sean muchos, y pagina con el encabezado repetido", async () => {
    const muchos = Array.from({ length: 90 }, (_, i) =>
      gasto(`2026-10-${String(22 + (i % 7)).padStart(2, "0")}`, 1_000 + i, i % 2 === 0 ? CAFE : REGALOS, { descripcion: `Compra numero ${i + 1}` }),
    );
    const bytes = await generarPdfReporteSemanal(reporte(muchos, 4), GENERADO);
    const paginas = await textoDe(bytes);
    expect(paginas.length).toBeGreaterThan(1);
    const todo = paginas.join("\n");
    for (let i = 1; i <= 90; i++) expect(todo).toContain(`Compra numero ${i}\n`);
    paginas.slice(1).forEach((p, i) => {
      expect(p).toContain("Luka · Reporte semanal · Semana 4");
      expect(p).toContain(`Página ${i + 2} de ${paginas.length}`);
    });
  });

  test("un emoji o un signo menos no rompen el PDF: se limpian", async () => {
    const bytes = await generarPdfReporteSemanal(
      reporte([gasto("2026-10-29", 5_000, CAFE, { descripcion: "Café ☕ con − leche 🥐", notas: "línea\nnueva" })]),
      GENERADO,
    );
    const pagina = (await textoDe(bytes)).join("\n");
    expect(pagina).toContain("Café con - leche");
    expect(pagina).toContain("línea nueva");
  });

  test("una semana sin gastos tambien se puede descargar", async () => {
    const bytes = await generarPdfReporteSemanal(reporte([], 2), GENERADO);
    const pagina = (await textoDe(bytes)).join("\n");
    expect(pagina).toContain("No hay gastos registrados en esta semana.");
  });

  test("las cuotas salen aparte, con su total", async () => {
    const bytes = await generarPdfReporteSemanal(
      reporte([
        gasto("2026-10-29", 9_000),
        gasto("2026-10-30", 158_400, TRANSPORTE, { cuota: { deudaId: "d1", deudaNombre: "Crédito de consumo" } }),
      ]),
      GENERADO,
    );
    const pagina = (await textoDe(bytes)).join("\n");
    expect(pagina).toContain("Cuotas de deudas pagadas esta semana");
    expect(pagina).toContain("Crédito de consumo");
    expect(pagina).toContain("$158.400");
  });
});

describe("nombres", () => {
  test("el archivo no lleva tildes ni espacios", () => {
    expect(nombreArchivoReporte({ mes: "2026-10", semana: 5 })).toBe("luka-reporte-semana-5-octubre-2026.pdf");
  });

  test("el rango de la semana", () => {
    expect(rangoDeLaSemana({ mes: "2026-10", fechaDesde: "2026-10-01", fechaHasta: "2026-10-07" })).toBe("1 al 7 de octubre de 2026");
  });
});
