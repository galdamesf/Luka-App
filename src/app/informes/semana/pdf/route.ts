import { auth } from "@/auth";
import { listarGastosDelMes } from "@/datos/gastos";
import { armarReporteSemanal } from "@/dominio/reporte-semanal";
import { esquemaMes } from "@/dominio/esquemas";
import { hoyISO } from "@/lib/fecha";
import { generarPdfReporteSemanal, nombreArchivoReporte } from "@/lib/pdf-reporte-semanal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Descarga el reporte de una semana en PDF:
 * /informes/semana/pdf?mes=2026-10&semana=5
 *
 * El middleware ya exige sesion, pero esta ruta entrega la plata del mes en
 * un archivo: se vuelve a revisar aqui por si algun dia cambia el matcher.
 */
export async function GET(peticion: Request) {
  const sesion = await auth();
  if (!sesion?.user) return new Response("Necesitas iniciar sesión.", { status: 401 });

  const parametros = new URL(peticion.url).searchParams;
  const mes = esquemaMes.safeParse(parametros.get("mes"));
  const semana = Number(parametros.get("semana"));
  if (!mes.success || !Number.isInteger(semana)) {
    return new Response("Mes o semana no válidos.", { status: 400 });
  }

  const gastos = await listarGastosDelMes(mes.data);
  const reporte = armarReporteSemanal(gastos, mes.data, semana, hoyISO());
  if (reporte === null) return new Response("Esa semana no existe en el mes.", { status: 404 });

  const pdf = await generarPdfReporteSemanal(reporte);
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivoReporte(reporte)}"`,
      "Cache-Control": "no-store",
    },
  });
}
