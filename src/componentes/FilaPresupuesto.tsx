"use client";

import { useActionState, useEffect, useState } from "react";
import type { DetalleDeCategoria, LineaPresupuesto } from "@/dominio/presupuestos";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { VisorBoleta } from "./VisorBoleta";
import { fechaCorta, formatearCLP } from "./formato";

type Props = {
  linea: LineaPresupuesto;
  /** Lo gastado en esa categoria, por semana, para el desglose. */
  detalle: DetalleDeCategoria;
  accionEditar: AccionFormulario;
  alEliminar: (datos: FormData) => void;
};

const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-2 py-1.5 text-xs text-texto transition-colors duration-150 hover:border-texto-tenue";
const SECUNDARIO =
  "cursor-pointer rounded-md border border-borde px-3 py-2 text-xs font-medium text-texto-tenue transition-colors duration-150 hover:bg-superficie hover:text-texto";

export function FilaPresupuesto({ linea, detalle, accionEditar, alEliminar }: Props) {
  const [estado, editar, editando] = useActionState(accionEditar, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [desplegado, setDesplegado] = useState(false);

  useEffect(() => {
    if (estado.ok) setAbierto(false);
  }, [estado]);

  const { presupuesto, gastado, restante, porcentaje, agotado, excedido, alLimite } =
    linea;

  // La barra se recorta en 100 para no desbordar la caja, pero el porcentaje
  // de al lado se muestra entero: pasarse del presupuesto tiene que verse.
  const ancho = Math.min(porcentaje, 100);
  const tono = agotado ? "text-peligro" : alLimite ? "text-alerta" : "text-texto-tenue";

  return (
    <li className="border-b border-borde py-3 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        {/* Toda la fila, menos los iconos de accion, abre el desglose. Los
            botones de editar y eliminar van FUERA de este boton: un boton
            dentro de otro es HTML invalido y el navegador lo desarma. */}
        <button
          type="button"
          onClick={() => setDesplegado(!desplegado)}
          aria-expanded={desplegado}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className={`shrink-0 text-texto-tenue transition-transform duration-150 ${
                desplegado ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              <Icono nombre="chevron-down" tamano={13} />
            </span>
            <Icono nombre={presupuesto.categoria.icono} tamano={14} className="shrink-0" />
            <span className="truncate font-medium">{presupuesto.categoria.nombre}</span>
            {excedido && (
              <span className="shrink-0 text-peligro" title="Te pasaste del presupuesto">
                <Icono nombre="alert" tamano={13} />
                <span className="sr-only">te pasaste del presupuesto</span>
              </span>
            )}
          </span>

          <span className="cifra shrink-0 text-sm tabular-nums">
            <span className={excedido ? "font-medium text-peligro" : "font-medium"}>
              {formatearCLP(gastado)}
            </span>
            <span className="text-texto-tenue"> / {formatearCLP(presupuesto.monto)}</span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto ${
              abierto ? "bg-superficie-tenue text-texto" : "text-texto-tenue"
            }`}
          >
            <Icono nombre="pencil" tamano={14} />
            <span className="sr-only">
              Editar el presupuesto de {presupuesto.categoria.nombre}
            </span>
          </button>

          <form action={alEliminar}>
            <input type="hidden" name="id" value={presupuesto.id} />
            <button
              type="submit"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-peligro"
            >
              <Icono nombre="trash" tamano={14} />
              <span className="sr-only">
                Eliminar el presupuesto de {presupuesto.categoria.nombre}
              </span>
            </button>
          </form>
        </div>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-tenue"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(ancho, gastado > 0 ? 1.5 : 0)}%`,
            // Semaforo: verde mientras sobra, amarillo desde el 80%, rojo
            // cuando ya no queda nada. El color de la categoria no va aca:
            // el ocre de Alimentacion quedaba a 12.3 del amarillo de aviso y
            // el carmin de Bienestar a 5.5 del rojo, asi que una barra
            // tranquila se leia como alerta. La categoria la dicen el icono
            // y el nombre, que estan en la misma fila.
            backgroundColor: agotado
              ? "var(--peligro)"
              : alLimite
                ? "var(--alerta)"
                : "var(--exito-fuerte)",
          }}
        />
      </div>

      <p className={`mt-1 text-xs ${tono}`}>
        {excedido ? (
          <>
            te pasaste por{" "}
            <span className="cifra font-medium tabular-nums">
              {formatearCLP(Math.abs(restante))}
            </span>
          </>
        ) : (
          <>
            te quedan{" "}
            <span className="cifra tabular-nums">{formatearCLP(restante)}</span>
          </>
        )}{" "}
        · <span className="cifra">{Math.round(porcentaje)}%</span> usado · creado el{" "}
        {fechaCorta(presupuesto.creadoEn)}
      </p>

      {desplegado && (
        <div className="mt-2 rounded-md border border-borde bg-superficie-tenue p-3">
          {detalle.cantidad === 0 ? (
            <p className="text-xs text-texto-tenue">
              Todavía no hay gastos de esta categoría en el mes.
            </p>
          ) : (
            <>
              <p className="text-xs text-texto-tenue">
                <span className="cifra">{detalle.cantidad}</span>{" "}
                {detalle.cantidad === 1 ? "gasto" : "gastos"} ·{" "}
                <span className="cifra">{formatearCLP(detalle.total)}</span>
                {detalle.conBoleta > 0 && (
                  <>
                    {" "}·{" "}
                    <span className="cifra">{detalle.conBoleta}</span> con boleta
                  </>
                )}
              </p>

              <ul className="mt-2 space-y-3">
                {detalle.semanas
                  .filter((semana) => semana.gastos.length > 0)
                  .map((semana) => (
                    <li key={semana.semana}>
                      <p className="flex items-baseline justify-between gap-2 border-b border-borde pb-1 text-xs text-texto-tenue">
                        <span>
                          Semana <span className="cifra">{semana.semana}</span>
                          <span className="opacity-70">
                            {" "}· días {semana.desde} al {semana.hasta}
                          </span>
                        </span>
                        <span className="cifra tabular-nums">
                          {formatearCLP(semana.total)}
                        </span>
                      </p>

                      <ul className="mt-1 space-y-1">
                        {semana.gastos.map((gasto) => (
                          <li
                            key={gasto.id}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span className="cifra shrink-0 text-texto-tenue">
                                {fechaCorta(gasto.fecha)}
                              </span>
                              <span className="truncate">{gasto.descripcion}</span>
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
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}

      {abierto && (
        <form
          action={editar}
          className="mt-2 max-w-sm space-y-2 rounded-md border border-borde bg-superficie-tenue p-3"
        >
          <input type="hidden" name="id" value={presupuesto.id} />

          <div>
            <label
              htmlFor={`pre-monto-${presupuesto.id}`}
              className="mb-1 block text-xs text-texto-tenue"
            >
              Presupuesto para {presupuesto.categoria.nombre}
            </label>
            <input
              id={`pre-monto-${presupuesto.id}`}
              name="monto"
              type="text"
              inputMode="numeric"
              defaultValue={String(presupuesto.monto)}
              required
              className={`${CAMPO} cifra`}
            />
            {estado.errores.monto !== undefined && (
              <p className="mt-1 text-xs text-peligro">{estado.errores.monto[0]}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className={`${SECUNDARIO} shrink-0`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editando}
              className="flex-1 cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editando ? "Guardando…" : "Guardar"}
            </button>
          </div>

          {estado.mensaje !== null && !estado.ok && (
            <p role="status" className="text-xs text-peligro">
              {estado.mensaje}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
