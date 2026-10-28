"use client";

import { useActionState, useEffect, useState } from "react";
import type { CuentaPlana } from "@/dominio/cuentas";
import type { CategoriaPlana } from "@/dominio/resumen";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { VisorBoleta } from "./VisorBoleta";
import { CampoBoleta } from "./CampoBoleta";
import { fechaCorta, formatearCLP } from "./formato";

type Props = {
  cuenta: CuentaPlana;
  vencida: boolean;
  /** Dia de hoy, para proponerlo como fecha de pago. */
  hoy: string;
  categorias: readonly CategoriaPlana[];
  accionPagar: AccionFormulario;
  accionEditar: AccionFormulario;
  alEliminar: (datos: FormData) => void;
  alRevertir: (datos: FormData) => void;
};

const CAMPO =
  "w-full rounded-md border border-borde bg-superficie px-2 py-1.5 text-xs text-texto transition-colors duration-150 hover:border-texto-tenue";

const ETIQUETA = "mb-1 block text-xs text-texto-tenue";

const SECUNDARIO =
  "cursor-pointer rounded-md border border-borde px-3 py-2 text-xs font-medium text-texto-tenue transition-colors duration-150 hover:bg-superficie hover:text-texto";

function Error({ mensajes }: { mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return <p className="mt-1 text-xs text-peligro">{mensajes[0]}</p>;
}

export function FilaCuenta({
  cuenta, vencida, hoy, categorias, accionPagar, accionEditar, alEliminar, alRevertir,
}: Props) {
  const [estado, pagar, pendiente] = useActionState(accionPagar, ESTADO_INICIAL);
  const [estadoEdicion, editar, editando] = useActionState(accionEditar, ESTADO_INICIAL);

  // Los dos paneles van controlados para poder cerrarlos: con <details> suelto
  // no hay forma de que el boton "Cancelar" los cierre.
  const [pagando, setPagando] = useState(false);
  const [abiertoEditar, setAbiertoEditar] = useState(false);

  const pagada = cuenta.pagadaEn !== null;

  // Al guardar bien, el panel de edicion se cierra solo: dejarlo abierto
  // sobre datos que ya se guardaron invita a volver a apretar Guardar.
  useEffect(() => {
    if (estadoEdicion.ok) setAbiertoEditar(false);
  }, [estadoEdicion]);

  // Abrir uno cierra el otro: son dos formularios sobre la misma cuenta y
  // tenerlos juntos abiertos solo confunde.
  function abrirPago(abierto: boolean) {
    setPagando(abierto);
    if (abierto) setAbiertoEditar(false);
  }

  function abrirEdicion(abierto: boolean) {
    setAbiertoEditar(abierto);
    if (abierto) setPagando(false);
  }

  return (
    <li className="border-b border-borde px-4 py-2.5 last:border-0">
      {/* Todo en una linea en pantallas anchas: nombre, contexto, monto y
          acciones. En angosto envuelve solo. Antes eran tres lineas por
          cuenta y la tarjeta quedaba larga y vacia a la vez. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          {pagada && (
            <span className="shrink-0 text-exito">
              <Icono nombre="check" tamano={14} />
            </span>
          )}
          <span className={`truncate ${pagada ? "text-texto-tenue" : "font-medium"}`}>
            {cuenta.nombre}
          </span>
          {cuenta.mensual && (
            <span className="shrink-0 text-texto-tenue" title="Se repite cada mes">
              <Icono nombre="repeat" tamano={12} />
              <span className="sr-only">se repite cada mes</span>
            </span>
          )}
        </p>

        {/* En celular toma su propia linea: apretado entre el nombre y el
            monto quedaba en una columna de tres palabras de ancho. */}
        <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-tenue sm:flex-1 sm:basis-auto">
          {pagada ? (
            <>
              <span>pagada el {fechaCorta(cuenta.pagadaEn as string)}</span>
              <VisorBoleta archivo={cuenta.boletaArchivo} descripcion={cuenta.nombre} />
              <form action={alRevertir} className="inline">
                <input type="hidden" name="id" value={cuenta.id} />
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1 rounded transition-colors duration-150 hover:text-texto"
                >
                  <Icono nombre="undo" tamano={12} />
                  deshacer
                  <span className="sr-only">el pago de {cuenta.nombre} y borrar su gasto</span>
                </button>
              </form>
            </>
          ) : (
            <>
              {cuenta.diaVencimiento !== null && (
                <span className={vencida ? "font-medium text-peligro" : ""}>
                  {vencida && (
                    <span className="mr-1 inline-block align-[-2px]">
                      <Icono nombre="alert" tamano={12} />
                    </span>
                  )}
                  vence el {cuenta.diaVencimiento}
                  {vencida && " · vencida"}
                </span>
              )}
              <VisorBoleta archivo={cuenta.boletaArchivo} descripcion={cuenta.nombre} />
            </>
          )}
        </div>

        {/* div y no span: adentro va un <form>, que no es contenido en
            linea. No rompe la hidratacion pero es HTML invalido igual. */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className={`cifra text-sm tabular-nums ${pagada ? "text-texto-tenue" : "font-medium"}`}>
            {formatearCLP(cuenta.monto)}
          </span>

          {/* Editar solo mientras este pendiente: una vez pagada, su gasto ya
              existe y cambiarle el monto dejaria las dos cifras peleadas. */}
          {!pagada && (
            <button
              type="button"
              onClick={() => abrirEdicion(!abiertoEditar)}
              aria-expanded={abiertoEditar}
              className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto ${
                abiertoEditar ? "bg-superficie-tenue text-texto" : "text-texto-tenue"
              }`}
            >
              <Icono nombre="pencil" tamano={14} />
              <span className="sr-only">Editar la cuenta {cuenta.nombre}</span>
            </button>
          )}

          <form action={alEliminar}>
            <input type="hidden" name="id" value={cuenta.id} />
            <button
              type="submit"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-peligro"
            >
              <Icono nombre="trash" tamano={14} />
              <span className="sr-only">Eliminar la cuenta {cuenta.nombre}</span>
            </button>
          </form>
        </div>
      </div>

      {!pagada && (
        <details
          className="mt-1.5"
          open={pagando}
          onToggle={(e) => abrirPago((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-exito transition-opacity duration-150 hover:opacity-80">
            <Icono nombre="check" tamano={13} />
            Marcar como pagada
          </summary>

          <form action={pagar} className="mt-2 max-w-md space-y-2 rounded-md bg-superficie-tenue p-3">
            <input type="hidden" name="id" value={cuenta.id} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`pago-fecha-${cuenta.id}`} className="mb-1 block text-xs text-texto-tenue">
                  ¿Qué día la pagaste?
                </label>
                <input
                  id={`pago-fecha-${cuenta.id}`}
                  name="fechaPago"
                  type="date"
                  defaultValue={hoy}
                  required
                  className={`${CAMPO} cifra`}
                />
              </div>
              <div>
                <label htmlFor={`pago-monto-${cuenta.id}`} className="mb-1 block text-xs text-texto-tenue">
                  Monto real
                </label>
                <input
                  id={`pago-monto-${cuenta.id}`}
                  name="monto"
                  type="text"
                  inputMode="numeric"
                  defaultValue={String(cuenta.monto)}
                  required
                  className={`${CAMPO} cifra`}
                />
              </div>
            </div>

            <CampoBoleta id={`pago-boleta-${cuenta.id}`} />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => abrirPago(false)}
                className={`${SECUNDARIO} shrink-0`}
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={pendiente}
                className="flex-1 cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendiente ? "Guardando…" : "Confirmar pago"}
              </button>
            </div>

            <p className="text-xs text-texto-tenue">
              Se va a crear el gasto con esa fecha y categoría.
            </p>

            {estado.mensaje !== null && (
              <p role="status" className={`text-xs ${estado.ok ? "text-exito" : "text-peligro"}`}>
                {estado.mensaje}
              </p>
            )}
          </form>
        </details>
      )}

      {!pagada && abiertoEditar && (
        <form
          action={editar}
          className="mt-2 max-w-md space-y-2 rounded-md border border-borde bg-superficie-tenue p-3"
        >
          <input type="hidden" name="id" value={cuenta.id} />

          <div>
            <label htmlFor={`ed-nombre-${cuenta.id}`} className={ETIQUETA}>
              Nombre
            </label>
            <input
              id={`ed-nombre-${cuenta.id}`}
              name="nombre"
              type="text"
              defaultValue={cuenta.nombre}
              maxLength={120}
              required
              className={CAMPO}
            />
            <Error mensajes={estadoEdicion.errores.nombre} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`ed-monto-${cuenta.id}`} className={ETIQUETA}>
                Monto
              </label>
              <input
                id={`ed-monto-${cuenta.id}`}
                name="monto"
                type="text"
                inputMode="numeric"
                defaultValue={String(cuenta.monto)}
                required
                className={`${CAMPO} cifra`}
              />
              <Error mensajes={estadoEdicion.errores.monto} />
            </div>

            <div>
              <label htmlFor={`ed-dia-${cuenta.id}`} className={ETIQUETA}>
                Día de vencimiento
              </label>
              <input
                id={`ed-dia-${cuenta.id}`}
                name="diaVencimiento"
                type="text"
                inputMode="numeric"
                placeholder="sin fecha"
                defaultValue={cuenta.diaVencimiento === null ? "" : String(cuenta.diaVencimiento)}
                className={`${CAMPO} cifra`}
              />
              <Error mensajes={estadoEdicion.errores.diaVencimiento} />
            </div>
          </div>

          <div>
            <label htmlFor={`ed-categoria-${cuenta.id}`} className={ETIQUETA}>
              Categoría
            </label>
            <select
              id={`ed-categoria-${cuenta.id}`}
              name="categoriaId"
              defaultValue={cuenta.categoria.id}
              className={CAMPO}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <Error mensajes={estadoEdicion.errores.categoriaId} />
          </div>

          <div>
            <label htmlFor={`ed-nota-${cuenta.id}`} className={ETIQUETA}>
              Nota <span className="font-normal opacity-70">(opcional)</span>
            </label>
            <input
              id={`ed-nota-${cuenta.id}`}
              name="nota"
              type="text"
              maxLength={500}
              defaultValue={cuenta.nota ?? ""}
              className={CAMPO}
            />
            <Error mensajes={estadoEdicion.errores.nota} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-texto-tenue">
            <input
              type="checkbox"
              name="mensual"
              defaultChecked={cuenta.mensual}
              className="size-3.5 cursor-pointer accent-primario"
            />
            Se repite todos los meses
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => abrirEdicion(false)}
              className={`${SECUNDARIO} shrink-0`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editando}
              className="flex-1 cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>

          {estadoEdicion.mensaje !== null && !estadoEdicion.ok && (
            <p role="status" className="text-xs text-peligro">
              {estadoEdicion.mensaje}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
