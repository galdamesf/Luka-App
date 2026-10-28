"use client";

import { useActionState, useEffect, useState } from "react";
import type { CuotaDelMes, DeudaPlana } from "@/dominio/balance";
import { saldoDesde, ultimoMesDe } from "@/dominio/balance";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { ControlEstadoPago } from "./ControlEstadoPago";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP, nombreDelMesCorto } from "./formato";
import { CATEGORIA_CUOTAS } from "@/dominio/categorias-base";

type Props = {
  deuda: DeudaPlana;
  /** La cuota que toca este mes, o null si la deuda no corre en este mes. */
  cuota: CuotaDelMes | null;
  mes: string;
  /** Dia de hoy, para proponerlo como fecha de pago. */
  hoy: string;
  accionPagar: AccionFormulario;
  accionEditar: AccionFormulario;
  /** Marca la cuota pagada de un clic: hoy y el monto pactado. */
  alMarcarPagada: AccionFormulario;
  alDesactivar?: (datos: FormData) => void;
  alRevertir: AccionFormulario;
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

export function FilaDeuda({
  deuda, cuota, mes, hoy, accionPagar, accionEditar, alMarcarPagada, alDesactivar,
  alRevertir,
}: Props) {
  const [estadoPago, pagar, pagando] = useActionState(accionPagar, ESTADO_INICIAL);
  const [estadoEdicion, editar, editando] = useActionState(accionEditar, ESTADO_INICIAL);

  const [abiertoPago, setAbiertoPago] = useState(false);
  const [abiertoEditar, setAbiertoEditar] = useState(false);

  useEffect(() => {
    if (estadoEdicion.ok) setAbiertoEditar(false);
  }, [estadoEdicion]);

  function abrirPago(abierto: boolean) {
    setAbiertoPago(abierto);
    if (abierto) setAbiertoEditar(false);
  }
  function abrirEdicion(abierto: boolean) {
    setAbiertoEditar(abierto);
    if (abierto) setAbiertoPago(false);
  }

  const avance = cuota === null ? null : (cuota.numero / deuda.cuotasTotales) * 100;
  // La MISMA cuenta que el total del encabezado, incluyendo la cuota de este
  // mes. Si la fila usara "lo que falta despues de esta", las filas no
  // sumarian el total de arriba.
  const porPagar = saldoDesde(deuda, mes);
  const pagada = cuota?.pagada === true;

  return (
    <li className="border-b border-borde pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          {pagada && (
            <span className="shrink-0 text-exito">
              <Icono nombre="check" tamano={14} />
            </span>
          )}
          <span className="truncate">{deuda.nombre}</span>
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <span className="cifra text-sm font-medium tabular-nums">
            {formatearCLP(cuota?.montoPagado ?? deuda.montoCuota)}
          </span>

          <button
            type="button"
            onClick={() => abrirEdicion(!abiertoEditar)}
            aria-expanded={abiertoEditar}
            className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto ${
              abiertoEditar ? "bg-superficie-tenue text-texto" : "text-texto-tenue"
            }`}
          >
            <Icono nombre="pencil" tamano={14} />
            <span className="sr-only">Editar la deuda {deuda.nombre}</span>
          </button>

          <form action={alDesactivar}>
            <input type="hidden" name="id" value={deuda.id} />
            <button
              type="submit"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
            >
              <Icono nombre="trash" tamano={14} />
              <span className="sr-only">Marcar {deuda.nombre} como terminada</span>
            </button>
          </form>
        </div>
      </div>

      <p className="mt-0.5 text-xs text-texto-tenue">
        {cuota === null ? (
          <>
            {deuda.cuotasTotales} cuotas ·{" "}
            <span className="whitespace-nowrap">
              {nombreDelMesCorto(deuda.primeraCuota)} a {nombreDelMesCorto(ultimoMesDe(deuda))}
            </span>
          </>
        ) : (
          <>
            <span className="whitespace-nowrap">
              cuota <span className="cifra">{cuota.numero}</span> de{" "}
              <span className="cifra">{deuda.cuotasTotales}</span>
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              termina {nombreDelMesCorto(cuota.ultimoMes)}
            </span>
            {porPagar > 0 && (
              <>
                {" "}·{" "}
                <span className="whitespace-nowrap">
                  faltan <span className="cifra tabular-nums">{formatearCLP(porPagar)}</span>
                </span>
              </>
            )}
          </>
        )}
      </p>

      {avance !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-superficie-tenue"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-avance"
            style={{ width: `${avance}%` }}
          />
        </div>
      )}

      {/* El pago de la cuota del mes. Solo aparece si la deuda corre este mes. */}
      {cuota !== null && (
        <>
          <ControlEstadoPago
            pagado={pagada}
            accionPagar={alMarcarPagada}
            camposPagar={{
              deudaId: deuda.id,
              mes,
              hoy,
              monto: String(deuda.montoCuota),
            }}
            accionRevertir={alRevertir}
            camposRevertir={{ deudaId: deuda.id, mes }}
            queEs={`la cuota de ${deuda.nombre}`}
            monto={cuota.montoPagado ?? deuda.montoCuota}
            categoria={CATEGORIA_CUOTAS}
          />

          {!pagada && (
            <button
              type="button"
              onClick={() => abrirPago(!abiertoPago)}
              aria-expanded={abiertoPago}
              className="mt-1.5 ml-2 cursor-pointer rounded text-xs text-texto-tenue underline-offset-2 transition-colors duration-150 hover:text-texto hover:underline"
            >
              con otra fecha o monto
            </button>
          )}

          {pagada && (
            <p className="mt-1 text-xs text-texto-tenue">
              pagada el {fechaCorta(cuota.pagadaEn as string)}
            </p>
          )}

          {!pagada && abiertoPago && (
            <form
              action={pagar}
              className="mt-2 max-w-md space-y-2 rounded-md bg-superficie-tenue p-3"
            >
              <input type="hidden" name="deudaId" value={deuda.id} />
              <input type="hidden" name="mes" value={mes} />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`cuota-fecha-${deuda.id}`} className={ETIQUETA}>
                    ¿Qué día la pagaste?
                  </label>
                  <input
                    id={`cuota-fecha-${deuda.id}`}
                    name="fechaPago"
                    type="date"
                    defaultValue={hoy}
                    required
                    className={`${CAMPO} cifra`}
                  />
                  <Error mensajes={estadoPago.errores.fechaPago} />
                </div>
                <div>
                  <label htmlFor={`cuota-monto-${deuda.id}`} className={ETIQUETA}>
                    Monto real
                  </label>
                  <input
                    id={`cuota-monto-${deuda.id}`}
                    name="monto"
                    type="text"
                    inputMode="numeric"
                    defaultValue={String(deuda.montoCuota)}
                    required
                    className={`${CAMPO} cifra`}
                  />
                  <Error mensajes={estadoPago.errores.monto} />
                </div>
              </div>

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
                  disabled={pagando}
                  className="flex-1 cursor-pointer rounded-md bg-primario px-3 py-2 text-xs font-medium text-primario-texto transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pagando ? "Guardando…" : "Confirmar pago"}
                </button>
              </div>

              <p className="text-xs text-texto-tenue">
                Se va a crear el gasto y recién ahí baja tu disponible.
              </p>

              {estadoPago.mensaje !== null && !estadoPago.ok && (
                <p role="status" className="text-xs text-peligro">
                  {estadoPago.mensaje}
                </p>
              )}
            </form>
          )}
        </>
      )}

      {abiertoEditar && (
        <form
          action={editar}
          className="mt-2 max-w-md space-y-2 rounded-md border border-borde bg-superficie-tenue p-3"
        >
          <input type="hidden" name="id" value={deuda.id} />

          <div>
            <label htmlFor={`ed-deuda-nombre-${deuda.id}`} className={ETIQUETA}>
              Nombre
            </label>
            <input
              id={`ed-deuda-nombre-${deuda.id}`}
              name="nombre"
              type="text"
              defaultValue={deuda.nombre}
              maxLength={80}
              required
              className={CAMPO}
            />
            <Error mensajes={estadoEdicion.errores.nombre} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`ed-deuda-monto-${deuda.id}`} className={ETIQUETA}>
                Monto de la cuota
              </label>
              <input
                id={`ed-deuda-monto-${deuda.id}`}
                name="montoCuota"
                type="text"
                inputMode="numeric"
                defaultValue={String(deuda.montoCuota)}
                required
                className={`${CAMPO} cifra`}
              />
              <Error mensajes={estadoEdicion.errores.montoCuota} />
            </div>

            <div>
              <label htmlFor={`ed-deuda-total-${deuda.id}`} className={ETIQUETA}>
                Cuotas en total
              </label>
              <input
                id={`ed-deuda-total-${deuda.id}`}
                name="cuotasTotales"
                type="text"
                inputMode="numeric"
                defaultValue={String(deuda.cuotasTotales)}
                required
                className={`${CAMPO} cifra`}
              />
              <Error mensajes={estadoEdicion.errores.cuotasTotales} />
            </div>
          </div>

          <div>
            <label htmlFor={`ed-deuda-primera-${deuda.id}`} className={ETIQUETA}>
              Mes de la primera cuota
            </label>
            <input
              id={`ed-deuda-primera-${deuda.id}`}
              name="primeraCuota"
              type="month"
              defaultValue={deuda.primeraCuota}
              required
              className={`${CAMPO} cifra`}
            />
            <Error mensajes={estadoEdicion.errores.primeraCuota} />
          </div>

          <div>
            <label htmlFor={`ed-deuda-nota-${deuda.id}`} className={ETIQUETA}>
              Nota <span className="font-normal opacity-70">(opcional)</span>
            </label>
            <input
              id={`ed-deuda-nota-${deuda.id}`}
              name="nota"
              type="text"
              maxLength={200}
              className={CAMPO}
            />
            <Error mensajes={estadoEdicion.errores.nota} />
          </div>

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
