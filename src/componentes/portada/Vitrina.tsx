"use client";

import { useState } from "react";
import { Icono } from "@/componentes/Icono";
import { CATEGORIAS_BASE, GRUPOS_GASTO } from "@/dominio/categorias-base";
import { formatearCLP, formatearNumero } from "@/lib/dinero";
import { MES_EJEMPLO } from "./cifras-ejemplo";
import {
  DIA_INICIO_EJEMPLO,
  avisoDeFeria,
  estadoDeFila,
  leerMonto,
  mesConDiaDeInicio,
  montoConSigno,
  porcentajeUsado,
  textoPorcentaje,
  type EstadoFila,
} from "./reglas-vitrina";

/**
 * La vitrina: la seccion «06 · Presupuestos» de la app en forma de tabla, con
 * dos tarjetas flotando encima, el ajuste «Dia de inicio» y el aviso de la
 * feria. Las tres cosas funcionan: cambia el presupuesto de la feria o el dia
 * y mira. Las cifras son el mes de ejemplo (cifras-ejemplo.ts) y las reglas,
 * las de la app (reglas-vitrina.ts).
 *
 * En celular las tarjetas van apiladas bajo la tabla; desde 56 rem de ancho
 * flotan sobre su borde de abajo, con aire reservado para no tapar cifras.
 */

const COLOR: Record<EstadoFila | "sin", { barra: string; texto: string; icono: string; borde: string }> = {
  sobra: { barra: "bg-exito-fuerte", texto: "text-exito", icono: "bg-[#059669]", borde: "border-exito/60" },
  aviso: { barra: "bg-alerta", texto: "text-alerta", icono: "bg-[#b45309]", borde: "border-alerta/70" },
  tope: { barra: "bg-peligro", texto: "text-peligro", icono: "bg-[#be123c]", borde: "border-peligro/70" },
  pasado: { barra: "bg-peligro", texto: "text-peligro", icono: "bg-[#be123c]", borde: "border-peligro/70" },
  sin: { barra: "bg-alerta", texto: "text-texto-tenue", icono: "bg-[#b45309]", borde: "border-alerta/70" },
};

const ALIMENTACION = GRUPOS_GASTO.alimentacion;
const iconoDe = (nombre: string) => CATEGORIAS_BASE.find((c) => c.nombre === nombre)?.icono ?? "ellipsis";
const techoDe = (nombre: string) => {
  const t = MES_EJEMPLO.techos.find((x) => x.categoria === nombre);
  if (!t) throw new Error(`Falta ${nombre} en el mes de ejemplo`);
  return t;
};

const SUPERMERCADO = techoDe("Supermercado");
const FERIA = techoDe("Feria");
const CAFE = techoDe("Café");

type Fila = { categoria: string; techo: number; gastado: number; editable?: boolean };

const FLOTANTE = "rounded-lg border bg-superficie p-4 shadow-[0_26px_50px_-26px_rgba(0,0,0,0.65)]";

export function Vitrina() {
  const [techoTxt, setTechoTxt] = useState(formatearNumero(FERIA.techo));
  const [dia, setDia] = useState(DIA_INICIO_EJEMPLO);

  const techoFeria = leerMonto(techoTxt);
  const mes = mesConDiaDeInicio(dia);
  const filas: Fila[] = [
    { categoria: "Supermercado", techo: SUPERMERCADO.techo, gastado: SUPERMERCADO.gastado },
    { categoria: "Feria", techo: techoFeria, gastado: FERIA.gastado, editable: true },
    { categoria: "Café", techo: CAFE.techo, gastado: CAFE.gastado },
  ];
  // Como en la app, el total cuenta solo las categorias que tienen presupuesto.
  const conTecho = filas.filter((f) => f.techo > 0);
  const total = {
    techo: conTecho.reduce((s, f) => s + f.techo, 0),
    gastado: conTecho.reduce((s, f) => s + f.gastado, 0),
  };
  const aviso = avisoDeFeria(FERIA.gastado, techoFeria);

  return (
    <section aria-label="Luka por dentro, con un mes de ejemplo" className="mx-auto max-w-5xl px-5 pb-20 @3xl:pb-28">
      {/* La vitrina entera sube como una capa, y sus dos tarjetas flotantes llegan
          un poco despues y se asientan en su lugar: solo bajan, nunca suben sobre
          la tabla (no tienen aire para eso). */}
      <div data-paralaje="0.12" data-paralaje-min="-60" data-paralaje-max="70" className="relative @4xl:px-12 @4xl:pb-32">
        <div className="overflow-hidden rounded-lg border border-borde bg-superficie shadow-[0_34px_70px_-40px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3 @xl:px-5">
            <p className="font-extrabold text-texto">Presupuesto por categoría</p>
            <p className="cifra text-xs text-texto-suave">
              <span className="capitalize">{mes.nombre}</span> · {mes.dias} días
            </p>
          </div>
          <table className="w-full text-left text-[13px] @md:text-sm">
            <caption className="sr-only">
              Presupuestos de alimentación del mes: el presupuesto, lo gastado y lo que te queda en cada categoría.
            </caption>
            <thead className="bg-superficie-tenue text-[11px] tracking-[0.12em] text-texto-suave uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-extrabold @xl:px-5">Categoría</th>
                <th scope="col" className="px-2 py-3 text-right font-extrabold @md:px-3">Presupuesto</th>
                <th scope="col" className="hidden px-3 py-3 text-right font-extrabold @lg:table-cell">Gastado</th>
                <th scope="col" className="py-3 pr-4 pl-2 text-right font-extrabold @md:px-4 @xl:px-5">Te quedan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-borde">
                <th scope="colgroup" colSpan={4} className="px-4 py-2.5 text-left font-bold text-texto-tenue @xl:px-5">
                  <span className="inline-flex items-center gap-1.5">
                    <Icono nombre="chevron-down" tamano={16} />
                    {ALIMENTACION.nombre}
                  </span>
                </th>
              </tr>
              {filas.map((f) => {
                const sinTecho = f.techo <= 0;
                const estado: EstadoFila | "sin" = sinTecho ? "sin" : estadoDeFila(f.gastado, f.techo);
                const p = porcentajeUsado(f.gastado, f.techo);
                return (
                  <tr key={f.categoria} className={`border-t border-borde ${f.editable ? "bg-acento/[0.06]" : ""}`}>
                    <th scope="row" className="py-3 pr-2 pl-4 text-left font-normal @md:pr-3 @md:pl-8 @xl:pl-10">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="hidden size-7 shrink-0 place-items-center rounded-md text-white @md:grid"
                          style={{ backgroundColor: ALIMENTACION.color }}
                        >
                          <Icono nombre={iconoDe(f.categoria)} tamano={16} />
                        </span>
                        <span className="font-bold text-texto">{f.categoria}</span>
                        {f.editable && <NotaAMano />}
                      </div>
                      <div className="mt-2 flex items-center gap-2 @md:pl-[38px]">
                        <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-superficie-tenue @lg:w-full @lg:max-w-[160px] @lg:shrink">
                          <span
                            className={`block h-full rounded-full transition-[width] duration-300 ${COLOR[estado].barra}`}
                            style={{ width: `${Math.min(100, p)}%` }}
                          />
                        </span>
                        <span className={`cifra text-[11px] font-semibold whitespace-nowrap ${COLOR[estado].texto}`}>
                          {sinTecho ? "—" : textoPorcentaje(p)}
                        </span>
                      </div>
                    </th>
                    <td className="px-2 py-3 text-right align-top @md:px-3">
                      {f.editable ? (
                        <>
                          <label htmlFor="portada-techo-feria" className="sr-only">
                            Presupuesto de la feria, en pesos
                          </label>
                          <input
                            id="portada-techo-feria"
                            inputMode="numeric"
                            autoComplete="off"
                            value={techoTxt}
                            onChange={(e) => {
                              const n = leerMonto(e.target.value);
                              setTechoTxt(n === 0 ? "" : formatearNumero(n));
                            }}
                            className="cifra h-9 w-[5.5rem] rounded-md border-2 border-acento bg-superficie-tenue px-2 text-right text-[13px] font-semibold text-texto outline-none transition-shadow focus:ring-4 focus:ring-acento/25 @md:w-[6.8rem] @md:text-sm"
                          />
                        </>
                      ) : (
                        <span className="cifra leading-9 font-semibold text-texto">{formatearCLP(f.techo)}</span>
                      )}
                    </td>
                    <td className="cifra hidden px-3 py-3 text-right align-top leading-9 text-texto-tenue @lg:table-cell">
                      {formatearCLP(f.gastado)}
                    </td>
                    <td className={`cifra py-3 pr-4 pl-2 text-right align-top leading-9 font-semibold @md:px-4 @xl:px-5 ${COLOR[estado].texto}`}>
                      {sinTecho ? "—" : montoConSigno(f.techo - f.gastado)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-borde bg-superficie-tenue/70 font-bold">
                <th scope="row" className="px-4 py-3 text-left @xl:px-5">
                  Total {ALIMENTACION.nombre.toLowerCase()}
                </th>
                <td className="cifra px-2 py-3 text-right @md:px-3">{formatearCLP(total.techo)}</td>
                <td className="cifra hidden px-3 py-3 text-right @lg:table-cell">{formatearCLP(total.gastado)}</td>
                <td className="cifra py-3 pr-4 pl-2 text-right @md:px-4 @xl:px-5">{montoConSigno(total.techo - total.gastado)}</td>
              </tr>
              <tr aria-hidden="true" className="border-t border-borde">
                <td colSpan={4} className="px-4 py-3 text-center">
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-borde px-3 text-sm font-bold text-texto-suave">
                    <span className="text-base leading-none">+</span> Agregar presupuesto
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {/* Aire para que las tarjetas floten sobre el borde sin tapar cifras. */}
          <div aria-hidden="true" className="hidden h-16 @4xl:block" />
        </div>

        <div className="mt-4 grid gap-4 @2xl:grid-cols-2 @4xl:contents">
          <TarjetaDia dia={dia} alCambiar={setDia} mes={mes} />
          {/* La llave cambia con el estado del aviso: asi vuelve a entrar cuando cambia. */}
          <TarjetaAviso key={aviso.estado} {...aviso} />
        </div>
      </div>
    </section>
  );
}

/** La anotacion a mano junto al unico campo que se edita. */
function NotaAMano() {
  return (
    <span
      aria-hidden="true"
      className="font-mano ml-1 hidden -rotate-[4deg] items-center gap-1 text-[1.4rem] leading-none font-bold whitespace-nowrap text-anotacion @3xl:inline-flex"
    >
      cámbialo
      <svg viewBox="0 0 46 22" className="h-[18px] w-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 14c9-7 22-9 38-4" />
        <path d="M33 4l8 6-9 5" />
      </svg>
    </span>
  );
}

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/** El ajuste «Dia de inicio» de la app, con su «Hoy estas en» y «Despues viene». */
function TarjetaDia({
  dia,
  alCambiar,
  mes,
}: {
  dia: number;
  alCambiar: (d: number) => void;
  mes: ReturnType<typeof mesConDiaDeInicio>;
}) {
  return (
    <div
      data-paralaje="0.3"
      data-paralaje-min="0"
      data-paralaje-max="110"
      className={`${FLOTANTE} relative border-borde @4xl:absolute @4xl:bottom-0 @4xl:left-0 @4xl:w-[300px] @5xl:w-[330px]`}>
      <label htmlFor="portada-dia" className="text-[11px] font-extrabold tracking-[0.12em] text-texto-suave uppercase">
        Día de inicio
      </label>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative shrink-0">
          <select
            id="portada-dia"
            value={dia}
            onChange={(e) => alCambiar(Number(e.target.value))}
            className="cifra h-11 cursor-pointer appearance-none rounded-md border border-borde bg-superficie-tenue pr-9 pl-3 font-semibold text-texto"
          >
            {DIAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-texto-suave">
            <Icono nombre="chevron-down" tamano={16} />
          </span>
        </div>
        <p className="text-sm leading-snug text-texto-tenue">de cada mes: el día que te pagan</p>
      </div>
      <p aria-live="polite" className="mt-3 border-t border-borde pt-3 text-sm leading-relaxed text-texto-tenue">
        Hoy estás en <b className="text-texto">{mes.nombre}</b>: del {mes.rango}. Después viene {mes.siguiente}.
      </p>
    </div>
  );
}

/** El aviso de la feria, y abajo, donde aparece al entrar: Inicio › 06 · Presupuestos. */
function TarjetaAviso({ estado, titulo, linea }: ReturnType<typeof avisoDeFeria>) {
  const tranquilo = estado === "sobra" || estado === "sin";
  return (
    <div
      role="status"
      data-paralaje="0.4"
      data-paralaje-min="0"
      data-paralaje-max="130"
      className={`${FLOTANTE} portada-aviso-entra relative border-2 ${COLOR[estado].borde} @4xl:absolute @4xl:right-0 @4xl:bottom-8 @4xl:w-[310px] @5xl:w-[340px]`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-white ${COLOR[estado].icono}`}>
          <Icono nombre={estado === "sobra" ? "check" : "bell"} tamano={18} />
        </span>
        <div className="min-w-0">
          <p className="leading-snug font-extrabold text-texto">{titulo}</p>
          <p className={`mt-1 text-sm leading-relaxed ${tranquilo ? "text-texto-tenue" : COLOR[estado].texto}`}>{linea}</p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 border-t border-borde pt-3 text-xs text-texto-suave">
        Lo ves en <b className="font-bold text-texto-tenue">Inicio</b>
        <Icono nombre="chevron-right" tamano={14} />
        <b className="font-bold text-texto-tenue">06 · Presupuestos</b>
      </p>
    </div>
  );
}
