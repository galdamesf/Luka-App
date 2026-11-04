import { leerHogarActual } from "@/lib/hogar-actual";
import { listarGastosDelMes } from "@/datos/gastos";
import { armarReporteSemanal } from "@/dominio/reporte-semanal";
import { esquemaMes } from "@/dominio/esquemas";
import { hoyISO } from "@/lib/fecha";
import { periodoDe } from "@/lib/periodo";
import { leerAjustes } from "@/datos/ajustes";
import { generarPdfReporteSemanal, nombreArchivoReporte } from "@/lib/pdf-reporte-semanal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Descarga el reporte de una semana en PDF:
 * /informes/semana/pdf?mes=2026-10&semana=5
 *
 * El middleware ya exige sesion, pero esta ruta entrega la plata del mes en
 * un archivo: se vuelve a revisar aqui, contra la base, que la persona siga
 * en su hogar.
 */
export async function GET(peticion: Request) {
  const hogar = await leerHogarActual();
  if (hogar === null) return new Response("Necesitas iniciar sesión.", { status: 401 });

  const parametros = new URL(peticion.url).searchParams;
  const mes = esquemaMes.safeParse(parametros.get("mes"));
  const semana = Number(parametros.get("semana"));
  if (!mes.success || !Number.isInteger(semana)) {
    return new Response("Mes o semana no válidos.", { status: 400 });
  }

  // El mismo corte de mes que el dashboard: con dia 27, noviembre va del 27
  // de octubre al 26 de noviembre.
  const { diaInicioMes } = await leerAjustes();
  const periodo = periodoDe(mes.data, diaInicioMes);
  const gastos = await listarGastosDelMes(periodo);
  const reporte = armarReporteSemanal(gastos, periodo, semana, hoyISO());
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
