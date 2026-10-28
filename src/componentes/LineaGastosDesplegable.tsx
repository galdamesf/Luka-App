"use client";

import { useState } from "react";
import type { GastoPlano } from "@/dominio/resumen";
import { Icono } from "./Icono";
import { VisorBoleta } from "./VisorBoleta";
import { fechaCorta, formatearCLP } from "./formato";

type Props = {
  etiqueta: string;
  detalle: string;
  monto: number;
  /** Los gastos que componen ese monto, del mas nuevo al mas viejo. */
  gastos: readonly GastoPlano[];
};

/**
 * Una linea del balance que se abre y muestra de que esta hecha.
 *
 * Existe porque el monto solo no alcanza: "gasté mucho más que eso" y "no he
 * usado 51.850" son la misma pregunta —de dónde sale esta cifra— y la unica
 * respuesta util es la lista.
 *
 * Ojo: pagar una cuenta crea un gasto con la categoria de esa cuenta, asi que
 * aca aparecen cosas que uno no recuerda haber "gastado" a mano.
 */
export function LineaGastosDesplegable({ etiqueta, detalle, monto, gastos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const hayQueVer = gastos.length > 0;

  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={() => hayQueVer && setAbierto(!abierto)}
        aria-expanded={hayQueVer ? abierto : undefined}
        disabled={!hayQueVer}
        className={`flex w-full items-baseline justify-between gap-3 rounded text-left ${
          hayQueVer
            ? "cursor-pointer hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            : "cursor-default"
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          {hayQueVer && (
            <span
              aria-hidden="true"
              className={`shrink-0 text-texto-tenue transition-transform duration-150 ${
                abierto ? "rotate-180" : ""
              }`}
            >
              <Icono nombre="chevron-down" tamano={13} />
            </span>
          )}
          <span className="text-texto-tenue">−</span>
          <span>{etiqueta}</span>
          <span className="truncate text-xs text-texto-tenue">{detalle}</span>
        </span>

        <span className="cifra shrink-0 tabular-nums">
          {monto === 0 ? formatearCLP(0) : `−${formatearCLP(monto)}`}
        </span>
      </button>

      {abierto && (
        <ul className="mt-1.5 space-y-1 rounded-md bg-superficie-tenue p-2.5">
          {gastos.map((gasto) => (
            <li
              key={gasto.id}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="cifra shrink-0 text-texto-tenue">
                  {fechaCorta(gasto.fecha)}
                </span>
                <span className="truncate">{gasto.descripcion}</span>
                <span className="shrink-0 text-texto-tenue">
                  {gasto.categoria.nombre}
                </span>
                <VisorBoleta
                  archivo={gasto.boletaArchivo}
                  descripcion={gasto.descripcion}
                />
              </span>
              <span className="cifra shrink-0 tabular-nums">
                {formatearCLP(gasto.monto)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
