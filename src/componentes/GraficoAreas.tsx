"use client";

import { useMemo, useState } from "react";
import { SERIES_FLUJO } from "@/dominio/categorias-base";
import type { PuntoMes } from "@/dominio/estadisticas";
import {
  type Punto,
  cruces,
  escala,
  indiceMasCercano,
  nivelesRedondos,
  posicionesEtiquetadas,
  rutaArea,
  rutaLinea,
} from "@/lib/grafico";
import { formatearCLP, nombreDelMes, nombreDelMesCorto } from "./formato";

type Props = {
  serie: readonly PuntoMes[];
  /** Cuantas etiquetas de mes caben sin encimarse. */
  maximoEtiquetas?: number;
};

/**
 * Lienzo interno. El SVG se estira para llenar la caja (preserveAspectRatio
 * "none"), asi que estos numeros son solo un sistema de coordenadas: no
 * definen el tamano final.
 */
const W = 1000;
const H = 400;

/** Montos del eje: "1,2M" / "450k", porque "$1.200.000" no cabe. */
function montoCorto(valor: number): string {
  if (valor === 0) return "0";
  if (Math.abs(valor) >= 1_000_000) {
    const millones = valor / 1_000_000;
    return `${millones.toFixed(millones < 10 ? 1 : 0).replace(".", ",")}M`;
  }
  if (Math.abs(valor) >= 1_000) return `${Math.round(valor / 1_000)}k`;
  return String(Math.round(valor));
}

/**
 * Gastos contra ingresos, mes a mes, con las dos areas superpuestas.
 *
 * Un solo eje de montos: las dos series estan en pesos y comparten escala.
 * Dos ejes distintos aqui serian el error clasico de este grafico, porque
 * dejarian elegir a mano donde se cruzan las lineas.
 *
 * Por que el texto NO va dentro del SVG: el lienzo se estira de 343px en
 * telefono a 1100px en escritorio. Un `fontSize` de 11 dentro del viewBox se
 * encoge con el: en telefono quedaba en unos 5px, ilegible. Las etiquetas y
 * los marcadores son HTML posicionado en porcentaje, que se ve igual de
 * nitido a cualquier ancho; los trazos usan `vector-effect` para no adelgazar.
 *
 * La identidad de cada serie nunca depende del color: hay leyenda siempre,
 * las dos series van rotuladas en el tooltip, y abajo esta la tabla.
 */
export function GraficoAreas({ serie, maximoEtiquetas = 7 }: Props) {
  const [activo, setActivo] = useState<number | null>(null);

  const geo = useMemo(() => {
    const maximo = Math.max(1, ...serie.map((p) => Math.max(p.gastos, p.ingresos)));
    const niveles = nivelesRedondos(maximo, 4);
    const techo = niveles.at(-1) ?? 1;

    const ex = escala([0, Math.max(1, serie.length - 1)], [0, W]);
    const ey = escala([0, techo], [H, 0]);
    const x = (i: number) => (serie.length === 1 ? W / 2 : ex(i));

    const ingresos: Punto[] = serie.map((p, i) => ({ x: x(i), y: ey(p.ingresos) }));
    const gastos: Punto[] = serie.map((p, i) => ({ x: x(i), y: ey(p.gastos) }));

    return {
      niveles,
      x,
      ey,
      ingresos,
      gastos,
      etiquetados: posicionesEtiquetadas(serie.length, maximoEtiquetas),
    };
  }, [serie, maximoEtiquetas]);

  if (serie.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-texto-tenue">
        Todavía no hay meses con datos para comparar.
      </p>
    );
  }

  const { niveles, x, ey, ingresos, gastos, etiquetados } = geo;
  const unPunto = serie.length === 1;

  const enX = (v: number) => `${(v / W) * 100}%`;
  const enY = (v: number) => `${(v / H) * 100}%`;

  // Las curvas se cruzan donde la plata se dio vuelta.
  const vueltas = unPunto ? [] : cruces(ingresos, gastos);

  const indice = activo === null ? null : Math.min(Math.max(activo, 0), serie.length - 1);
  const punto = indice === null ? null : serie[indice]!;
  const diferencia = punto === null ? 0 : punto.ingresos - punto.gastos;

  function desdePuntero(evento: React.PointerEvent<HTMLDivElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    if (caja.width === 0) return;

    const enLienzo = ((evento.clientX - caja.left) / caja.width) * W;
    setActivo(
      unPunto ? 0 : indiceMasCercano(ingresos, enLienzo),
    );
  }

  function porTeclado(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();

    const actual = indice ?? serie.length - 1;
    setActivo(
      Math.min(Math.max(actual + (evento.key === "ArrowLeft" ? -1 : 1), 0), serie.length - 1),
    );
  }

  const marcadores = (i: number) =>
    ([
      [ingresos[i]!, SERIES_FLUJO.ingresos.color],
      [gastos[i]!, SERIES_FLUJO.gastos.color],
    ] as const);

  return (
    <figure className="m-0">
      {/* Leyenda: la identidad de las series nunca queda solo en el color. */}
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {([SERIES_FLUJO.ingresos, SERIES_FLUJO.gastos] as const).map((s) => (
          <span key={s.nombre} className="flex items-center gap-1.5 text-xs text-texto-tenue">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.nombre}
          </span>
        ))}
      </figcaption>

      <div className="mt-3">
        {/* Fila grafico: la canaleta se estira EXACTO al alto de la caja,
            porque el eje de meses va en otra fila mas abajo. Si estuviera
            dentro de este flex, los montos quedarian corridos. */}
        <div className="flex">
          <div aria-hidden="true" className="relative w-11 shrink-0 sm:w-14">
            {niveles.map((nivel) => (
              <span
                key={nivel}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-texto-tenue sm:text-[11px]"
                style={{ top: enY(ey(nivel)) }}
              >
                {montoCorto(nivel)}
              </span>
            ))}
          </div>

          {/* La caja del grafico. Mas alta en telefono, mas ancha en pantalla. */}
          <div
            className="relative aspect-[4/3] min-w-0 flex-1 sm:aspect-[21/8]"
            role="img"
            aria-label={
              `Gastos contra ingresos de ${serie.length} ${serie.length === 1 ? "mes" : "meses"}, ` +
              `de ${nombreDelMes(serie[0]!.mes)} a ${nombreDelMes(serie.at(-1)!.mes)}. ` +
              `El detalle mes por mes está en la tabla que sigue.`
            }
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
              aria-hidden="true"
            >
              {niveles.map((nivel) => (
                <line
                  key={nivel}
                  x1={0}
                  x2={W}
                  y1={ey(nivel)}
                  y2={ey(nivel)}
                  stroke="var(--borde)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {!unPunto && (
                <>
                  <path
                    d={rutaArea(ingresos, H)}
                    fill={SERIES_FLUJO.ingresos.color}
                    fillOpacity={0.16}
                  />
                  <path
                    d={rutaArea(gastos, H)}
                    fill={SERIES_FLUJO.gastos.color}
                    fillOpacity={0.16}
                  />
                  <path
                    d={rutaLinea(ingresos)}
                    fill="none"
                    stroke={SERIES_FLUJO.ingresos.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={rutaLinea(gastos)}
                    fill="none"
                    stroke={SERIES_FLUJO.gastos.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}

              {indice !== null && (
                <line
                  x1={x(indice)}
                  x2={x(indice)}
                  y1={0}
                  y2={H}
                  stroke="var(--texto-tenue)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Marcadores en HTML: un circulo dentro del SVG estirado saldria
                ovalado y se encogeria en telefono. */}
            {vueltas.map((v) => (
              <span
                key={`vuelta-${v.x}-${v.y}`}
                aria-hidden="true"
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-texto-tenue bg-superficie"
                style={{ left: enX(v.x), top: enY(v.y) }}
              />
            ))}

            {(unPunto ? [0] : indice !== null ? [indice] : []).map((i) =>
              marcadores(i).map(([p, color]) => (
                <span
                  key={`${i}-${color}`}
                  aria-hidden="true"
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie"
                  style={{ left: enX(p.x), top: enY(p.y), backgroundColor: color }}
                />
              )),
            )}

            {/* Zona de captura: cubre todo, asi no hay que apuntarle a la linea. */}
            <div
              tabIndex={0}
              className="absolute inset-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
              onPointerMove={desdePuntero}
              onPointerLeave={() => setActivo(null)}
              onKeyDown={porTeclado}
              onBlur={() => setActivo(null)}
            />

            {punto !== null && indice !== null && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute top-0 z-10 w-max max-w-52 rounded-md border border-borde bg-superficie p-2.5 shadow-lg"
                style={{
                  left: enX(x(indice)),
                  transform:
                    x(indice) > W * 0.55
                      ? "translateX(calc(-100% - 10px))"
                      : "translateX(10px)",
                }}
              >
                <p className="text-xs font-medium">{nombreDelMes(punto.mes)}</p>

                <dl className="mt-1.5 space-y-1">
                  {([
                    [SERIES_FLUJO.ingresos, punto.ingresos],
                    [SERIES_FLUJO.gastos, punto.gastos],
                  ] as const).map(([s, valor]) => (
                    <div key={s.nombre} className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-xs text-texto-tenue">
                        <span
                          aria-hidden="true"
                          className="h-0.5 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.nombre}
                      </dt>
                      <dd className="cifra text-xs font-semibold tabular-nums">
                        {formatearCLP(valor)}
                      </dd>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-3 border-t border-borde pt-1">
                    <dt className="text-xs text-texto-tenue">
                      {diferencia < 0 ? "Te faltó" : "Te quedó"}
                    </dt>
                    <dd
                      className={`cifra text-xs font-semibold tabular-nums ${
                        diferencia < 0 ? "text-peligro" : "text-exito"
                      }`}
                    >
                      {formatearCLP(Math.abs(diferencia))}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

        </div>

        {/* Eje de meses: fila aparte, alineada con la caja por el mismo
            ancho de canaleta. */}
        <div aria-hidden="true" className="flex">
          <div className="w-11 shrink-0 sm:w-14" />
          <div className="relative h-4 min-w-0 flex-1">
            {etiquetados.map((i, k) => (
              <span
                key={serie[i]!.mes}
                /* En telefono cabe la mitad: "nov 2025" y "ene 2026" se
                   encimaban. Se esconde una de cada dos, menos la primera y
                   la ultima, que son las que ubican el periodo. */
                className={`absolute text-[10px] whitespace-nowrap text-texto-tenue sm:text-[11px] ${
                  k % 2 === 1 && k !== etiquetados.length - 1 ? "hidden sm:inline" : ""
                }`}
                style={{
                  left: enX(x(i)),
                  transform:
                    i === 0
                      ? "translateX(0)"
                      : i === serie.length - 1
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {nombreDelMesCorto(serie[i]!.mes)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
