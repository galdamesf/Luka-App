"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Icono } from "./Icono";
import { Luka } from "./Luka";
import { formatearCLP } from "./formato";

/** Lo que el saludo cuenta del mes. Lo arma la pagina con las mismas cifras del panel. */
export type ResumenBienvenida = {
  /** El nombre de pila, de la cuenta de Google. null si Google no lo da. */
  nombre: string | null;
  /** "noviembre". */
  mes: string;
  /** "27 oct – 26 nov", o null con el mes calendario. */
  rango: string | null;
  /** Dias que quedan contando hoy. */
  diasRestantes: number;
  sinSueldo: boolean;
  /** Libre para el mes despues de pagar todo (lo de "Tu plata del mes"). */
  libre: number;
  porPagar: number;
  cuentasVencidas: number;
  montoVencido: number;
  /** El Health Score, o null si todavia no se puede calcular. */
  puntaje: number | null;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Quita ?bienvenida=1 de la direccion sin recargar: recargar no debe volver a saludar. */
function limpiarDireccion() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("bienvenida")) return;
  url.searchParams.delete("bienvenida");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * El saludo al entrar. Aparece una sola vez, justo despues de ingresar con
 * Google: el ingreso vuelve a "/?bienvenida=1" y la pagina lo monta solo
 * entonces. Apenas se abre, se quita el parametro de la direccion.
 *
 * Ademas de saludar, resume el mes en tres cifras y avisa lo urgente (una
 * cuenta vencida, o que falta el sueldo), con un atajo a cada cosa.
 *
 * Al abrir, el foco va a "Ir a mi panel": Enter cierra el saludo.
 */
export function Bienvenida({ resumen }: { resumen: ResumenBienvenida }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (d !== null && !d.open) d.showModal();
    // showModal enfoca lo primero que encuentra (la X); el foco va al boton principal.
    principal.current?.focus();
    limpiarDireccion();
  }, []);

  const cerrar = () => dialogo.current?.close();
  const { nombre, mes, rango, diasRestantes, sinSueldo, libre, porPagar, cuentasVencidas, montoVencido, puntaje } =
    resumen;

  const cifras = [
    {
      titulo: "Libre para el mes",
      valor: sinSueldo ? "—" : formatearCLP(libre),
      nota: sinSueldo ? "falta tu sueldo" : "tras pagar todo",
      tono: !sinSueldo && libre < 0 ? "text-peligro" : "",
    },
    {
      titulo: "Por pagar",
      valor: formatearCLP(porPagar),
      nota: cuentasVencidas > 0 ? plural(cuentasVencidas, "vencida", "vencidas") : porPagar === 0 ? "todo pagado" : "cuentas y cuotas",
      tono: cuentasVencidas > 0 ? "text-peligro" : "",
    },
    {
      titulo: "Health Score",
      valor: puntaje === null ? "—" : String(puntaje),
      nota: puntaje === null ? "aún sin datos" : "de 100",
      tono: "",
    },
  ];

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClick={(e) => {
        if (e.target === dialogo.current) cerrar();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-borde bg-superficie p-0 text-left text-texto shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative space-y-5 p-6 sm:p-7">
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar el saludo"
          className="absolute top-3 right-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto"
        >
          <Icono nombre="x" tamano={18} />
        </button>

        <div className="flex items-end gap-4">
          <Luka pose="rastreando" descripcion={null} className="h-16 w-auto shrink-0 sm:h-20" />
          <div className="min-w-0 space-y-1 pb-1">
            <h2 id={idTitulo} className="font-marca text-2xl leading-tight font-extrabold tracking-[-0.02em]">
              {nombre === null ? "¡Hola!" : `¡Hola, ${nombre}!`}
            </h2>
            <p className="text-sm text-texto-tenue">Qué bueno verte de vuelta.</p>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed">
          Estás en <span className="font-semibold capitalize">{mes}</span>
          {rango !== null && <span className="cifra text-texto-tenue"> ({rango})</span>}
          {": "}
          {diasRestantes > 0
            ? `${diasRestantes === 1 ? "queda 1 día" : `quedan ${diasRestantes} días`} para cerrar el mes.`
            : "el mes ya cerró."}
        </p>

        {/* En celular, una fila por cifra (nombre a la izquierda, monto a la
            derecha): en tres columnas de 100px los montos se cortaban. */}
        <ul className="grid gap-2 sm:grid-cols-3">
          {cifras.map((c) => (
            <li
              key={c.titulo}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-borde bg-superficie-tenue px-3 py-2.5 sm:block sm:p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-texto-tenue">{c.titulo}</p>
                <p className={`truncate text-[11px] sm:hidden ${c.tono || "text-texto-tenue"}`}>{c.nota}</p>
              </div>
              <p className={`cifra shrink-0 text-base font-bold sm:mt-1 sm:text-lg ${c.tono}`}>{c.valor}</p>
              <p className={`hidden truncate text-[11px] sm:block ${c.tono || "text-texto-tenue"}`}>{c.nota}</p>
            </li>
          ))}
        </ul>

        {/* Lo urgente, con su atajo: primero lo vencido, si no, el sueldo. */}
        {cuentasVencidas > 0 ? (
          <p className="flex items-start gap-2 rounded-xl border border-peligro/40 bg-peligro/10 p-3 text-sm text-peligro">
            <span className="mt-0.5 shrink-0">
              <Icono nombre="alert" tamano={15} />
            </span>
            <span>
              Tienes {plural(cuentasVencidas, "cuenta vencida", "cuentas vencidas")} por{" "}
              <span className="cifra font-semibold">{formatearCLP(montoVencido)}</span>.{" "}
              <a href="#pagos" onClick={cerrar} className="font-semibold underline underline-offset-2">
                Ver pagos
              </a>
            </span>
          </p>
        ) : sinSueldo ? (
          <p className="flex items-start gap-2 rounded-xl border border-alerta/40 bg-alerta/10 p-3 text-sm">
            <span className="mt-0.5 shrink-0 text-alerta">
              <Icono nombre="lightbulb" tamano={15} />
            </span>
            <span>
              Empieza por definir tu sueldo: sin él no se puede saber cuánto te queda.{" "}
              <a href="#balance" onClick={cerrar} className="font-semibold enlace-luka">
                Definir sueldo
              </a>
            </span>
          </p>
        ) : null}

        {/* El boton principal va primero: arriba en celular, a la derecha en pantallas anchas. */}
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-between">
          <button
            ref={principal}
            type="button"
            onClick={cerrar}
            className="boton-luka cursor-pointer"
          >
            Ir a mi panel
            <Icono nombre="arrow-right" tamano={16} />
          </button>
          <Link
            href="/como-usar"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold enlace-luka transition-colors duration-150 hover:bg-superficie-tenue"
          >
            <Icono nombre="circle-help" tamano={16} />
            ¿Cómo usar Luka?
          </Link>
        </div>
      </div>
    </dialog>
  );
}
