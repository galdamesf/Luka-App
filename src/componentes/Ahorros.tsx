"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AhorroPlano, MesDeAhorro } from "@/dominio/ahorros";
import { ESTADO_INICIAL, type AccionFormulario, type EstadoFormulario } from "@/dominio/formulario";
import { parsearMonto } from "@/lib/dinero";
import { AvisoFlotante } from "./AvisoFlotante";
import { FichaTono } from "./FichaTono";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP, nombreDelMes, nombreDelMesCorto, porcentajeLegible } from "./formato";

type Props = {
  mes: string;
  /** Los ahorros de este mes, del mas nuevo al mas antiguo. */
  delMes: readonly AhorroPlano[];
  /** Todo lo ahorrado hasta este mes, este incluido. */
  acumulado: number;
  /** Los ultimos meses, del mas antiguo al mas nuevo. */
  historial: readonly MesDeAhorro[];
  /** Cuanto seria ahorrar la meta (20% del sueldo). null sin sueldo. */
  meta: number | null;
  /** El % del sueldo que es la meta, para decirlo. */
  metaPct: number;
  accion: AccionFormulario;
  alEliminar: (datos: FormData) => void;
};

const CAMPO =
  "w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

function milesCorto(monto: number): string {
  return monto === 0 ? "—" : `${new Intl.NumberFormat("es-CL").format(Math.round(monto / 1000))} mil`;
}

/**
 * Los ahorros del mes: cuanto llevas, el total acumulado, la meta y el
 * formulario para apartar mas. Cada ahorro se descuenta de "lo que te
 * quedaria", que va al lado.
 */
export function Ahorros({ mes, delMes, acumulado, historial, meta, metaPct, accion, alEliminar }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const enviado = useRef<{ monto: number | null; nota: string } | null>(null);
  const atendido = useRef<EstadoFormulario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Tras guardar: limpiar y avisar. El ref evita repetirlo si el componente
  // se vuelve a pintar con la misma respuesta.
  useEffect(() => {
    if (!estado.ok || atendido.current === estado) return;
    atendido.current = estado;
    const datos = enviado.current;
    formulario.current?.reset();
    setAviso(
      datos !== null && datos.monto !== null
        ? `${formatearCLP(datos.monto)}${datos.nota ? ` para ${datos.nota}` : ""}. Ya se descuenta de lo que te queda.`
        : "Ya se descuenta de lo que te queda.",
    );
  }, [estado]);

  const [nombreMes] = nombreDelMes(mes).split(" ");
  const totalMes = delMes.reduce((suma, a) => suma + a.monto, 0);
  const avanceMeta = meta === null || meta === 0 ? null : (totalMes / meta) * 100;
  const maximo = Math.max(1, ...historial.map((h) => h.total));

  return (
    <article
      id="ahorros"
      aria-labelledby="titulo-ahorros"
      className="tarjeta-viva viva-esmeralda flex h-full min-w-0 scroll-mt-28 flex-col gap-5 rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <FichaTono tono="esmeralda" icono="piggy-bank" />
        <div className="min-w-0">
          <h3 id="titulo-ahorros" className="text-base font-bold">
            Ahorros
          </h3>
          <p className="text-[13px] leading-snug text-texto-tenue">
            Lo que apartas cada mes. Se descuenta de lo que te queda y se suma a tu total.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-lg border border-borde bg-superficie-tenue p-3">
          <dt className="text-xs text-texto-tenue">Ahorrado en {nombreMes}</dt>
          <dd className="cifra mt-1 truncate text-xl font-bold tracking-tight">{formatearCLP(totalMes)}</dd>
          <dd className="text-xs text-texto-tenue">
            {delMes.length === 0 ? "Sin aportes todavía" : `${delMes.length} ${delMes.length === 1 ? "aporte" : "aportes"}`}
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-borde bg-superficie-tenue p-3">
          <dt className="text-xs text-texto-tenue">Total ahorrado</dt>
          <dd className="cifra mt-1 truncate text-xl font-bold tracking-tight text-exito">{formatearCLP(acumulado)}</dd>
          <dd className="text-xs text-texto-tenue">Hasta {nombreDelMes(mes)}</dd>
        </div>
      </dl>

      {meta !== null && avanceMeta !== null && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <span className="text-texto-tenue">
              Meta: el {metaPct}% del sueldo, <span className="cifra font-semibold text-texto">{formatearCLP(meta)}</span>
            </span>
            <span className={`font-bold ${avanceMeta >= 100 ? "text-exito" : "text-texto"}`}>
              {avanceMeta >= 100 ? "Meta cumplida" : `Llevas el ${porcentajeLegible(avanceMeta)}`}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-superficie-tenue">
            <div className="h-full rounded-full bg-tono-esmeralda transition-[width] duration-500" style={{ width: `${Math.min(100, avanceMeta)}%` }} />
          </div>
          {avanceMeta < 100 && (
            <p className="text-xs text-texto-tenue">
              Te faltan <span className="cifra font-semibold text-texto">{formatearCLP(meta - totalMes)}</span> para llegar.
            </p>
          )}
        </div>
      )}

      {/* --- Agregar --- */}
      <form
        ref={formulario}
        action={enviar}
        onSubmit={(evento) => {
          // Lo que se mando, para el aviso: al volver la respuesta el
          // formulario ya se limpio y no quedaria de donde sacarlo.
          const datos = new FormData(evento.currentTarget);
          enviado.current = {
            monto: parsearMonto(String(datos.get("monto") ?? "")),
            nota: String(datos.get("nota") ?? "").trim(),
          };
        }}
        className="space-y-3 rounded-lg border border-borde p-3"
      >
        <input type="hidden" name="mes" value={mes} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <label htmlFor="ahorro-monto" className="mb-1 block text-xs font-medium text-texto-tenue">
              Cuánto apartas
            </label>
            <input
              id="ahorro-monto"
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="100000"
              required
              aria-invalid={estado.errores.monto !== undefined}
              aria-describedby={estado.errores.monto !== undefined ? "ahorro-monto-error" : undefined}
              className={`${CAMPO} cifra`}
            />
            {estado.errores.monto !== undefined && (
              <p id="ahorro-monto-error" className="mt-1 text-xs text-peligro">
                {estado.errores.monto[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ahorro-nota" className="mb-1 block text-xs font-medium text-texto-tenue">
              Para qué <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="ahorro-nota"
              name="nota"
              type="text"
              maxLength={120}
              placeholder="Fondo de emergencia, vacaciones…"
              className={CAMPO}
            />
            {estado.errores.nota !== undefined && (
              <p className="mt-1 text-xs text-peligro">{estado.errores.nota[0]}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pendiente}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-accion px-4 text-sm font-bold text-accion-texto transition-[filter,opacity] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icono nombre="plus" tamano={16} />
            {pendiente ? "Guardando…" : `Agregar ahorro de ${nombreMes}`}
          </button>
          {estado.mensaje !== null && !estado.ok && (
            <p role="status" className="text-xs text-peligro">
              {estado.mensaje}
            </p>
          )}
        </div>
      </form>

      {/* --- Los de este mes --- */}
      {delMes.length > 0 && (
        <ul className="divide-y divide-borde">
          {delMes.map((a) => (
            <li key={a.id} className="fila-viva viva-esmeralda -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.nota ?? "Ahorro"}</span>
                <span className="block text-xs text-texto-tenue">Anotado el {fechaCorta(a.creadoEn)}</span>
              </span>
              <span className="cifra text-sm font-bold">{formatearCLP(a.monto)}</span>
              <form action={alEliminar}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-peligro"
                >
                  <Icono nombre="trash" tamano={14} />
                  <span className="sr-only">
                    Quitar el ahorro de {formatearCLP(a.monto)}
                    {a.nota ? ` (${a.nota})` : ""}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* --- Los ultimos meses --- */}
      <div className="mt-auto space-y-2 border-t border-borde pt-4">
        <p className="text-xs font-semibold text-texto-tenue">Últimos {historial.length} meses</p>
        <ul className="grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${historial.length}, minmax(0, 1fr))` }}>
          {historial.map((h) => {
            const actual = h.mes === mes;
            return (
              <li key={h.mes} className="flex flex-col items-center gap-1">
                <span className={`cifra text-[10px] ${actual ? "font-bold text-texto" : "text-texto-tenue"}`}>
                  {milesCorto(h.total)}
                </span>
                <span aria-hidden="true" className="flex h-14 w-full items-end justify-center">
                  <span
                    className={`block w-3/5 rounded-t-md ${h.total === 0 ? "bg-superficie-tenue" : actual ? "bg-tono-esmeralda" : "bg-tono-esmeralda/45"}`}
                    style={{ height: `${h.total === 0 ? 6 : Math.max(10, (h.total / maximo) * 100)}%` }}
                  />
                </span>
                <span className={`text-[11px] capitalize ${actual ? "font-bold text-texto" : "text-texto-tenue"}`}>
                  {nombreDelMesCorto(h.mes).split(" ")[0]}
                  <span className="sr-only">: {formatearCLP(h.total)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <AvisoFlotante titulo="Ahorro agregado" mensaje={aviso} alCerrar={() => setAviso(null)} />
    </article>
  );
}
