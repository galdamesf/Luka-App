"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ESTADO_INICIAL, type AccionFormulario, type EstadoFormulario } from "@/dominio/formulario";
import { DIA_NOMBRE_MES_SIGUIENTE, periodoDeFecha, periodoVecino } from "@/lib/periodo";
import { AvisoFlotante } from "./AvisoFlotante";
import { Icono } from "./Icono";
import { nombreDelMes, rangoCorto } from "./formato";

type Props = {
  /** El dia guardado hoy, 1 a 31. */
  diaInicio: number;
  /** Hoy, "YYYY-MM-DD": la vista previa muestra en que mes estas con cada dia. */
  hoy: string;
  accion: AccionFormulario;
};

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * El boton para elegir en que dia empieza tu mes de gastos, y el dialogo con
 * el selector. Muestra antes de guardar como quedarian este mes y el
 * siguiente, porque "dia 27" solo no dice en que mes quedas hoy.
 */
export function AjusteDiaInicio({ diaInicio, hoy, accion }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(diaInicio);
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const atendido = useRef<EstadoFormulario | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (d === null) return;
    if (abierto && !d.open) {
      setDia(diaInicio);
      d.showModal();
    }
    if (!abierto && d.open) d.close();
  }, [abierto, diaInicio]);

  // Al guardar: cerrar y avisar. El ref evita repetirlo con la misma respuesta.
  useEffect(() => {
    if (!estado.ok || atendido.current === estado) return;
    atendido.current = estado;
    setAbierto(false);
    setAviso(dia === 1 ? "Tu mes vuelve a ser el mes calendario." : `Tu mes ahora empieza el día ${dia}.`);
    // Con otro dia de inicio cambia cual es el mes de hoy: se vuelve al panel
    // sin ?mes= para caer en el que corresponde.
    router.replace("/");
  }, [estado, dia, router]);

  const este = periodoDeFecha(hoy, dia);
  const siguiente = periodoVecino(este, 1);
  const [nombreEste] = nombreDelMes(este.mes).split(" ");
  const [nombreSiguiente] = nombreDelMes(siguiente.mes).split(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="no-imprimir inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-borde px-3 text-sm font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
      >
        <Icono nombre="calendar" tamano={16} />
        {diaInicio === 1 ? "Mes calendario" : `Mes desde el día ${diaInicio}`}
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-dia-inicio"
        onCancel={(e) => {
          e.preventDefault();
          setAbierto(false);
        }}
        onClick={(e) => {
          if (e.target === dialogo.current) setAbierto(false);
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-borde bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form action={enviar} className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 id="titulo-dia-inicio" className="text-lg font-bold">
              ¿Qué día empieza tu mes?
            </h2>
            <p className="text-sm text-texto-tenue">
              Elige el día en que te pagan. Tus gastos, presupuestos, cuentas, ahorros y semanas se cuentan desde ese
              día hasta el día anterior del mes siguiente.
            </p>
          </div>

          <div>
            <label htmlFor="dia-inicio" className="mb-1 block text-xs font-medium text-texto-tenue">
              Día de inicio
            </label>
            <select
              id="dia-inicio"
              name="diaInicioMes"
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              aria-describedby="vista-dia-inicio"
              className="cifra w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue"
            >
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1 (mes calendario)" : d}
                </option>
              ))}
            </select>
            {estado.errores.diaInicioMes !== undefined && (
              <p className="mt-1 text-xs text-peligro">{estado.errores.diaInicioMes[0]}</p>
            )}
          </div>

          <div id="vista-dia-inicio" aria-live="polite" className="space-y-1.5 rounded-lg border border-borde bg-superficie-tenue p-3 text-sm">
            <p>
              <span className="text-texto-tenue">Hoy estás en</span>{" "}
              <span className="font-semibold capitalize">{nombreEste}</span>{" "}
              <span className="text-texto-tenue">·</span> <span className="cifra font-semibold">{rangoCorto(este.desde, este.hasta)}</span>
            </p>
            <p>
              <span className="text-texto-tenue">Después viene</span>{" "}
              <span className="font-semibold capitalize">{nombreSiguiente}</span>{" "}
              <span className="text-texto-tenue">·</span>{" "}
              <span className="cifra font-semibold">{rangoCorto(siguiente.desde, siguiente.hasta)}</span>
            </p>
            {dia >= 29 && (
              <p className="text-xs text-texto-tenue">Los meses que no tienen el día {dia} empiezan en su último día.</p>
            )}
          </div>

          <p className="text-xs text-texto-tenue">
            {dia >= DIA_NOMBRE_MES_SIGUIENTE
              ? "Como empieza en la segunda mitad del mes, cada mes lleva el nombre del mes en que termina: ahí cae la mayor parte de sus días. "
              : dia > 1
                ? "Como empieza en la primera mitad del mes, cada mes lleva el nombre del mes en que empieza. "
                : ""}
            El cambio vale para todos los meses, también los anteriores: cada gasto se cuenta en el mes que le toca
            según su fecha.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors duration-150 hover:bg-superficie-tenue"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className="boton-luka cursor-pointer"
            >
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
          </div>

          {estado.mensaje !== null && !estado.ok && (
            <p role="status" className="text-xs text-peligro">
              {estado.mensaje}
            </p>
          )}
        </form>
      </dialog>

      <AvisoFlotante titulo="Día de inicio guardado" mensaje={aviso} alCerrar={() => setAviso(null)} />
    </>
  );
}
