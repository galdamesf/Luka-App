import Link from "next/link";
import { listarGastosDelMes } from "@/datos/gastos";
import { armarReporteSemanal } from "@/dominio/reporte-semanal";
import { nivelDeSemana, ritmoSemanal } from "@/dominio/semanas";
import { esquemaMes } from "@/dominio/esquemas";
import { hoyISO } from "@/lib/fecha";
import { periodoDe, periodoDeFecha } from "@/lib/periodo";
import { leerAjustes } from "@/datos/ajustes";
import { rangoCorto, rangoDeDias } from "@/componentes/formato";
import { SelectorMes } from "@/componentes/SelectorMes";
import { Icono } from "@/componentes/Icono";
import { NIVEL } from "@/componentes/niveles-semana";
import { ReporteSemanalVista } from "@/componentes/ReporteSemanalVista";
import {
  estadoDeLaSemana,
  rangoDeLaSemana,
  urlPdfReporte,
  urlReporte,
} from "@/componentes/textos-reporte";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ mes?: string; semana?: string }> };

/**
 * El reporte de una semana con cada gasto, y su PDF.
 *
 * Sin `semana` (o con una que el mes no tiene) abre la misma que el
 * dashboard: la en curso, o la ultima con gastos.
 */
export default async function ReporteSemana({ searchParams }: Props) {
  const parametros = await searchParams;
  const { diaInicioMes } = await leerAjustes();
  const hoy = hoyISO();
  const elegido = esquemaMes.safeParse(parametros.mes);
  const mes = elegido.success ? elegido.data : periodoDeFecha(hoy, diaInicioMes).mes;
  const periodo = periodoDe(mes, diaInicioMes);

  const gastos = await listarGastosDelMes(periodo);
  const ritmo = ritmoSemanal(gastos, periodo, hoy);
  const pedida = Number(parametros.semana);
  const semana = ritmo.semanas.some((s) => s.semana === pedida) ? pedida : ritmo.semanaInicial;
  const reporte = armarReporteSemanal(gastos, periodo, semana, hoy);
  if (reporte === null) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/informes?mes=${mes}`}
            className="no-imprimir inline-flex items-center gap-1 text-sm font-semibold enlace-luka"
          >
            <Icono nombre="chevron-left" tamano={15} />
            Informes
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reporte semanal</h1>
          <p className="text-sm text-texto-tenue">
            <span className="font-semibold text-texto">
              Semana {reporte.semana} · {rangoDeLaSemana(reporte)}
            </span>{" "}
            · {estadoDeLaSemana(reporte)}
          </p>
        </div>
        <div className="no-imprimir flex flex-wrap items-center gap-3">
          <SelectorMes
            mes={mes}
            ruta="/informes/semana"
            rango={diaInicioMes === 1 ? undefined : rangoCorto(periodo.desde, periodo.hasta)}
          />
          <a
            href={urlPdfReporte(mes, reporte.semana)}
            download
            className="boton-luka cursor-pointer"
          >
            <Icono nombre="download" tamano={18} />
            Descargar PDF
          </a>
        </div>
      </header>

      {/* Las semanas del mes, cada una con el color de su ritmo, igual que en el dashboard. */}
      <nav aria-label="Semanas del mes" className="no-imprimir mt-6">
        <ul className="flex flex-wrap gap-2">
          {ritmo.semanas.map((s) => {
            const activa = s.semana === reporte.semana;
            const nivel = nivelDeSemana(s, ritmo);
            const estilo = NIVEL[nivel?.nivel ?? "sin"];
            return (
              <li key={s.semana}>
                <Link
                  href={urlReporte(mes, s.semana)}
                  aria-current={activa ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors duration-150 ${
                    activa
                      ? "border-acento bg-acento text-acento-tinta"
                      : "border-borde bg-superficie text-texto-tenue hover:border-acento hover:text-texto"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full ${estilo.lleno} ${activa ? "ring-2 ring-acento-tinta/80" : ""}`}
                  />
                  Semana {s.semana}
                  <span className={`cifra text-xs font-normal ${activa ? "text-acento-tinta/80" : "text-texto-tenue"}`}>
                    {rangoDeDias(s.fechaDesde, s.fechaHasta)}
                  </span>
                  {nivel !== null && <span className="sr-only">, ritmo {estilo.nombre.toLowerCase()}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mt-8">
        <ReporteSemanalVista reporte={reporte} />
      </main>
    </div>
  );
}
