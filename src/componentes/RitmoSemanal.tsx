"use client";

import Link from "next/link";
import { useState } from "react";
import { nivelDeSemana, type RitmoSemanal as Ritmo, type SemanaDelMes } from "@/dominio/semanas";
import { Icono } from "./Icono";
import type { NombreIcono } from "./iconos";
import { formatearCLP, variacionLegible } from "./formato";
import { TONOS, type Tono } from "./tonos";
import { NIVEL, NIVELES_LEYENDA } from "./niveles-semana";
import { FichaTono } from "./FichaTono";
import { urlPdfReporte, urlReporte } from "./textos-reporte";

type Props = {
  ritmo: Ritmo;
  /** Cuanto habras gastado al cerrar el mes si sigues igual. null fuera del mes en curso. */
  proyeccion: number | null;
  /** La proyeccion como parte del sueldo, para darle tono. null sin sueldo. */
  proyeccionPctSueldo: number | null;
};

const ALTO_BARRA = 180;

function milesCorto(monto: number): string {
  return `$${new Intl.NumberFormat("es-CL").format(Math.round(monto / 1000))} mil`;
}

const UN_DECIMAL = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });




/**
 * El mes en bloques de 7 dias. Las barras y las pestanas eligen la misma
 * semana; el detalle de la derecha cuenta su total, su promedio, su
 * tendencia y en que se fue la plata.
 *
 * "Solo discrecional" saca lo esencial de las barras: el bloque del arriendo
 * siempre es el mas alto y aplana a los demas, que es justo donde se ve si
 * estas gastando de mas.
 */
export function RitmoSemanal({ ritmo, proyeccion, proyeccionPctSueldo }: Props) {
  const [elegida, setElegida] = useState(ritmo.semanaInicial);
  const [soloDiscrecional, setSoloDiscrecional] = useState(false);

  const semana = ritmo.semanas.find((s) => s.semana === elegida) ?? ritmo.semanas[0];
  if (semana === undefined) return null;

  const nivelDe = (s: SemanaDelMes) => nivelDeSemana(s, ritmo);
  const estiloDe = (s: SemanaDelMes) => NIVEL[nivelDe(s)?.nivel ?? "sin"];
  const nivel = nivelDe(semana);
  const estilo = NIVEL[nivel?.nivel ?? "sin"];

  const tope = soloDiscrecional ? ritmo.maximoDiscrecional : ritmo.maximo;
  const valorDe = (s: (typeof ritmo.semanas)[number]) => (soloDiscrecional ? s.discrecionales : s.total);
  const pico = semana.categorias[0];
  const top = semana.categorias.slice(0, 3);
  const masAlta = ritmo.semanas.find((s) => s.semana === ritmo.semanaMasAlta);
  const tendencia = semana.tendencia;

  const etiqueta = semana.enCurso
    ? "en curso"
    : semana.diasTranscurridos === 0
      ? "todavía no empieza"
      : "cerrada";
  const totalDias = semana.hasta - semana.desde + 1;

  const tonoProyeccion =
    proyeccionPctSueldo === null
      ? "text-texto"
      : proyeccionPctSueldo >= 100
        ? "text-peligro"
        : proyeccionPctSueldo >= 80
          ? "text-alerta"
          : "text-exito";

  return (
    <div className="space-y-4">
      <article
        aria-labelledby="titulo-ritmo"
        className="tarjeta-viva rounded-xl border border-borde bg-superficie p-5 shadow-sm"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 id="titulo-ritmo" className="text-base font-bold">
            Gasto por semana
          </h3>
          <div role="group" aria-label="Elegir semana" className="flex flex-wrap gap-1 rounded-xl border border-borde bg-superficie-tenue p-1">
            {ritmo.semanas.map((s) => {
              const activa = s.semana === semana.semana;
              return (
                <button
                  key={s.semana}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setElegida(s.semana)}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors duration-150 ${
                    activa ? "bg-accion text-accion-texto" : "text-texto-tenue hover:bg-superficie hover:text-texto"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full ${estiloDe(s).lleno} ${activa ? "ring-2 ring-accion-texto/80" : ""}`}
                  />
                  Semana {s.semana}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-8">
          {/* --- Las barras --- */}
          <div className="min-w-0 flex-[5_1_26rem] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-texto-tenue">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2.5 rounded-sm bg-texto-tenue" />
                  Lleno: discrecional
                </span>
                {!soloDiscrecional && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-sm bg-texto-tenue/35" />
                    Suave: esencial
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-pressed={soloDiscrecional}
                onClick={() => setSoloDiscrecional(!soloDiscrecional)}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors duration-150 ${
                  soloDiscrecional ? "border-accion bg-accion/15 text-accion-tinta" : "border-borde text-texto-tenue hover:text-texto"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-4 w-7 rounded-full transition-colors duration-150 ${
                    soloDiscrecional ? "bg-accion" : "bg-texto-tenue/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-3 rounded-full bg-superficie transition-[left] duration-150 ${
                      soloDiscrecional ? "left-3.5" : "left-0.5"
                    }`}
                  />
                </span>
                Solo discrecional
              </button>
            </div>

            <div
              className="grid items-end gap-2 border-b border-borde"
              style={{ gridTemplateColumns: `repeat(${ritmo.semanas.length}, minmax(0, 1fr))`, height: ALTO_BARRA + 44 }}
            >
              {ritmo.semanas.map((s) => {
                const activa = s.semana === semana.semana;
                const valor = valorDe(s);
                const alto = tope === 0 || valor === 0 ? 2 : Math.max(4, Math.round((valor / tope) * ALTO_BARRA));
                const esencial = soloDiscrecional ? 0 : s.esenciales;
                const estiloBarra = estiloDe(s);
                return (
                  <button
                    key={s.semana}
                    type="button"
                    onClick={() => setElegida(s.semana)}
                    aria-pressed={activa}
                    aria-label={`Semana ${s.semana}, días ${s.desde} al ${s.hasta}: ${formatearCLP(valor)}, ritmo ${estiloBarra.nombre.toLowerCase()}`}
                    className={`flex h-full cursor-pointer flex-col items-center justify-end gap-2 rounded-t-lg border border-b-0 pt-2 transition-colors duration-150 ${
                      activa ? "border-accion/50 bg-accion/10" : "border-transparent hover:bg-superficie-tenue"
                    }`}
                  >
                    <span className={`cifra text-[11px] font-bold ${estiloBarra.texto}`}>
                      {valor === 0 ? "—" : milesCorto(valor)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex w-3/5 flex-col overflow-hidden rounded-t-md transition-[height,opacity] duration-500 ${
                        activa ? "opacity-100" : "opacity-80"
                      }`}
                      style={{ height: alto }}
                    >
                      <span className={`block ${estiloBarra.lleno}`} style={{ flex: `${s.discrecionales} 1 0px` }} />
                      <span className={`block ${estiloBarra.suave}`} style={{ flex: `${esencial} 1 0px` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ritmo.semanas.length}, minmax(0, 1fr))` }}>
              {ritmo.semanas.map((s) => {
                const estiloBarra = estiloDe(s);
                return (
                  <span key={s.semana} className="flex flex-col items-center text-center">
                    <span className={`text-[13px] font-bold ${s.semana === semana.semana ? "text-texto" : "text-texto-tenue"}`}>
                      Sem {s.semana}
                    </span>
                    <span className="text-[11px] text-texto-tenue">
                      {s.desde}–{s.hasta}
                    </span>
                    {nivelDe(s) !== null && (
                      <span className={`text-[11px] font-bold ${estiloBarra.texto}`}>{estiloBarra.nombre.toLowerCase()}</span>
                    )}
                  </span>
                );
              })}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-texto-tenue">
              <span>Color según el gasto discrecional por día, contra tu promedio del mes:</span>
              {NIVELES_LEYENDA.map((n) => (
                <span key={n} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className={`size-2 rounded-full ${NIVEL[n].lleno}`} />
                  {NIVEL[n].nombre}
                </span>
              ))}
            </p>
          </div>

          {/* --- El detalle de la semana elegida --- */}
          <div className="min-w-0 flex-[4_1_18rem] space-y-4" aria-live="polite">
            <div className="space-y-1">
              <p className="cifra text-[11px] uppercase tracking-[0.08em] text-accion-tinta">
                Semana {semana.semana} · {etiqueta}
              </p>
              <p className="text-sm text-texto-tenue">
                Días {semana.desde} al {semana.hasta}
                {semana.enCurso && ` · van ${semana.diasTranscurridos} de ${totalDias}`}
              </p>
              <p className="cifra text-3xl font-bold tracking-tight">{formatearCLP(semana.total)}</p>
              {nivel !== null && (
                <p className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${estilo.pildora}`}>
                  <span aria-hidden="true" className={`size-2 rounded-full ${estilo.lleno}`} />
                  Ritmo {estilo.nombre.toLowerCase()} · {UN_DECIMAL.format(nivel.veces)}× tu promedio diario discrecional
                </p>
              )}
            </div>

            {/* Promedio y esencial llevan su color fijo; lo discrecional, el
                del ritmo de la semana, igual que la parte llena de la barra. */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  nombre: "Promedio diario",
                  valor: semana.promedioDiario === null ? "—" : formatearCLP(semana.promedioDiario),
                  franja: TONOS.violeta.barra,
                  viva: TONOS.violeta.viva,
                },
                { nombre: "Esencial", valor: formatearCLP(semana.esenciales), franja: TONOS.cielo.barra, viva: TONOS.cielo.viva },
                { nombre: "Discrecional", valor: formatearCLP(semana.discrecionales), franja: estilo.lleno, viva: estilo.viva },
              ].map((t) => (
                <div
                  key={t.nombre}
                  className={`tarjeta-viva ${t.viva} relative min-w-0 overflow-hidden rounded-lg border border-borde bg-superficie-tenue px-3 pb-2.5 pt-3.5`}
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${t.franja}`} />
                  <p className="text-[11px] text-texto-tenue">{t.nombre}</p>
                  <p className="cifra truncate text-sm font-bold">{t.valor}</p>
                </div>
              ))}
            </div>

            <div
              className={`flex items-start gap-3 rounded-lg px-3.5 py-3 ${
                tendencia === null ? "bg-superficie-tenue" : tendencia > 0 ? "bg-peligro/10" : "bg-exito/10"
              }`}
            >
              <span className={tendencia === null ? "text-texto-tenue" : tendencia > 0 ? "text-peligro" : "text-exito"}>
                <Icono
                  nombre={tendencia === null ? "clock" : tendencia > 0 ? "trending-up" : "trending-down"}
                  tamano={20}
                />
              </span>
              <span className="min-w-0 space-y-0.5">
                {tendencia === null ? (
                  <>
                    <span className="block text-sm font-bold">Sin semana para comparar</span>
                    <span className="block text-xs text-texto-tenue">
                      {semana.semana === 1
                        ? "Es la primera del mes: suele traer el arriendo y lo fijo."
                        : semana.diasTranscurridos === 0
                          ? "Todavía no empieza."
                          : semana.enCurso && semana.discrecionales === 0
                            ? "Todavía no hay gasto discrecional esta semana."
                            : "La semana anterior no tuvo gasto discrecional."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`block text-sm font-bold ${tendencia > 0 ? "text-peligro" : "text-exito"}`}>
                      Discrecional por día {variacionLegible(tendencia)} vs. semana {semana.semana - 1}
                    </span>
                    <span className="block text-xs text-texto-tenue">
                      Se compara por día porque los bloques no duran lo mismo.
                    </span>
                  </>
                )}
              </span>
            </div>

            {pico !== undefined ? (
              <div className="space-y-2.5 border-t border-borde pt-3">
                <p className="text-xs font-semibold text-texto-tenue">
                  En qué se fue{" "}
                  <span className="font-normal">
                    · {pico.categoria.nombre} es el {Math.round((pico.total / semana.total) * 100)}% de la semana
                  </span>
                </p>
                <ul className="space-y-2.5">
                  {top.map((c) => (
                    <li key={c.categoria.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span className="flex min-w-0 items-center gap-2 text-[13px]">
                        <span className="shrink-0" style={{ color: c.categoria.color }}>
                          <Icono nombre={c.categoria.icono} tamano={14} />
                        </span>
                        <span className="truncate">{c.categoria.nombre}</span>
                      </span>
                      <span className="cifra text-[13px] font-bold">{formatearCLP(c.total)}</span>
                      <span aria-hidden="true" className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-superficie-tenue">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(c.total / pico.total) * 100}%`, backgroundColor: c.categoria.color }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="border-t border-borde pt-3 text-sm text-texto-tenue">Sin gastos en esta semana.</p>
            )}

            {/* El reporte completo de la semana elegida: cada gasto, en pantalla o en PDF. */}
            <div className="no-imprimir flex flex-wrap gap-2 border-t border-borde pt-3">
              <Link
                href={urlReporte(ritmo.mes, semana.semana)}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-borde px-3 text-sm font-semibold transition-colors duration-150 hover:bg-superficie-tenue"
              >
                <Icono nombre="file-text" tamano={16} />
                Ver reporte de la semana {semana.semana}
              </Link>
              <a
                href={urlPdfReporte(ritmo.mes, semana.semana)}
                download
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-accion px-3 text-sm font-bold text-accion-texto transition-[filter] duration-150 hover:brightness-110"
              >
                <Icono nombre="download" tamano={16} />
                Descargar PDF
              </a>
            </div>
          </div>
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              nombre: "Promedio por semana",
              valor: ritmo.promedioSemanal === null ? "—" : formatearCLP(ritmo.promedioSemanal),
              nota: "Lo de cada 7 días, sobre los días que van",
              color: "text-texto",
              tono: "cielo",
              icono: "calendar",
            },
            {
              nombre: "Promedio diario",
              valor: ritmo.promedioDiario === null ? "—" : formatearCLP(ritmo.promedioDiario),
              nota: "Sin contar las cuotas de deudas",
              color: "text-texto",
              tono: "violeta",
              icono: "clock",
            },
            {
              nombre: "Semana más alta",
              valor: masAlta === undefined ? "—" : `Semana ${masAlta.semana}`,
              nota: masAlta === undefined ? "Todavía no hay gastos" : `${formatearCLP(masAlta.total)} · días ${masAlta.desde} al ${masAlta.hasta}`,
              color: "text-texto",
              tono: "fucsia",
              icono: "trending-up",
            },
            {
              nombre: "Proyección al cierre",
              valor: proyeccion === null ? "—" : formatearCLP(proyeccion),
              nota:
                proyeccion === null
                  ? "Solo para el mes en curso"
                  : `Si sigues igual${proyeccionPctSueldo === null ? "" : ` · ${Math.round(proyeccionPctSueldo)}% del sueldo`}`,
              color: proyeccion === null ? "text-texto" : tonoProyeccion,
              tono: "naranja",
              icono: "arrow-right",
            },
          ] satisfies { nombre: string; valor: string; nota: string; color: string; tono: Tono; icono: NombreIcono }[]
        ).map((t) => (
          <div
            key={t.nombre}
            className={`tarjeta-viva ${TONOS[t.tono].viva} flex min-w-0 items-start gap-3 rounded-xl border border-borde bg-superficie p-4 shadow-sm`}
          >
            <FichaTono tono={t.tono} icono={t.icono} />
            <div className="min-w-0">
              <p className="text-xs text-texto-tenue">{t.nombre}</p>
              <p className={`cifra mt-1 text-xl font-bold tracking-tight ${t.color}`}>{t.valor}</p>
              <p className="mt-0.5 text-xs text-texto-tenue">{t.nota}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
