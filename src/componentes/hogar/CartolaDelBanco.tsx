"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { ESTADO_INICIAL, type AccionFormulario, type EstadoFormulario } from "@/dominio/formulario";
import { fechaCorta } from "@/componentes/formato";
import { ConfirmarAccion } from "./ConfirmarAccion";

/** Lo que se muestra de una cartola ya leida. */
export type CartolaLeidaParaMostrar = {
  id: string;
  banco: string;
  ultimos4: string;
  cuenta: string | null;
  desde: string;
  hasta: string;
  filas: number;
  nuevas: number;
  yaEstaban: number;
  fuera: number;
};

export type AccionesDeLaCartola = {
  accionGuardarClave: AccionFormulario;
  accionQuitarClave: AccionFormulario;
  accionSubir: AccionFormulario;
};

type Props = AccionesDeLaCartola & {
  banco: string;
  /** Cual es la clave de su PDF, como lo dice el correo del banco. */
  pista: string;
  /** Si esta persona ya guardo la clave de este banco. */
  tengoClave: boolean;
  leidas: CartolaLeidaParaMostrar[];
};

const CAMPO =
  "min-h-11 w-full rounded-lg border border-borde bg-superficie px-3 text-base text-texto transition-colors duration-150 hover:border-texto-tenue sm:text-sm";
const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-borde px-4 text-sm font-semibold text-texto transition-colors duration-150 hover:bg-superficie disabled:cursor-not-allowed disabled:opacity-60";
const DE_TEXTO =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie hover:text-texto";
const ERROR = "rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm";

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (estado.mensaje === null) return null;
  return estado.ok ? (
    <p role="status" className="text-sm font-semibold text-exito-fuerte">{estado.mensaje}</p>
  ) : (
    <p role="alert" className={ERROR}>{estado.mensaje}</p>
  );
}

/**
 * La cartola del mes de un banco, dentro de su ficha en «Tus bancos y
 * tarjetas»: la clave de su PDF (de quien mira, cifrada y sin mostrarla
 * nunca), subir una cartola a mano y las que ya se leyeron.
 */
export function CartolaDelBanco({ banco, pista, tengoClave, leidas, accionGuardarClave, accionQuitarClave, accionSubir }: Props) {
  const [estadoClave, guardarClave, guardando] = useActionState(accionGuardarClave, ESTADO_INICIAL);
  const [estadoSubida, subir, subiendo] = useActionState(accionSubir, ESTADO_INICIAL);
  const formularioSubida = useRef<HTMLFormElement>(null);
  const ids = { clave: useId(), archivo: useId(), claveSubida: useId(), recordar: useId(), ayuda: useId() };

  // Leida la cartola, el formulario queda limpio para la siguiente.
  useEffect(() => {
    if (estadoSubida.ok) formularioSubida.current?.reset();
  }, [estadoSubida]);

  const errorDeClave = estadoSubida.errores.clave?.[0];

  return (
    <div className="space-y-4 rounded-lg border border-borde bg-superficie-tenue/60 p-3 text-sm">
      <div className="space-y-1">
        <p className="font-semibold">La cartola del mes</p>
        <p className="text-xs leading-relaxed text-texto-tenue">
          Con la cartola, Luka cuadra el mes con lo que dice {banco} y trae lo que no tuvo aviso por correo, como las
          compras con tarjeta de débito. Lo que ya estaba anotado no se repite.
        </p>
      </div>

      {tengoClave ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-[1_1_16rem]">
            <span className="font-semibold text-exito-fuerte">Tu clave está guardada.</span>{" "}
            <span className="text-texto-tenue">Las cartolas que lleguen a tu dirección de Luka se leen solas.</span>
          </p>
          <ConfirmarAccion
            etiqueta="Olvidar la clave"
            pregunta={`¿Olvidar la clave de tus cartolas de ${banco}?`}
            confirmar="Sí, olvidarla"
            accion={accionQuitarClave}
            id={banco}
            claseBoton={DE_TEXTO}
          >
            <p>Las cartolas que lleguen después van a esperar en el buzón hasta que la escribas de nuevo.</p>
          </ConfirmarAccion>
        </div>
      ) : (
        <form action={guardarClave} className="space-y-2">
          <input type="hidden" name="banco" value={banco} />
          <label htmlFor={ids.clave} className="block font-semibold">
            Para que se lean solas: la clave del PDF
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={ids.clave}
              name="clave"
              type="password"
              autoComplete="off"
              required
              maxLength={64}
              aria-describedby={ids.ayuda}
              className={`${CAMPO} flex-[1_1_12rem]`}
            />
            <button type="submit" disabled={guardando} className="boton-luka cursor-pointer">
              {guardando ? "Guardando…" : "Guardar clave"}
            </button>
          </div>
          <p id={ids.ayuda} className="text-xs leading-relaxed text-texto-tenue">
            Es {pista}, como dice el correo de {banco}. Luka la guarda cifrada y solo la usa para abrir tus cartolas:
            nunca se muestra.
          </p>
          <Mensaje estado={estadoClave} />
        </form>
      )}

      <form ref={formularioSubida} action={subir} className="space-y-2 border-t border-borde pt-3">
        <label htmlFor={ids.archivo} className="block font-semibold">
          ¿Tienes una cartola en PDF? Súbela
        </label>
        <input
          id={ids.archivo}
          name="cartola"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="block w-full text-sm text-texto-tenue file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-borde file:bg-superficie file:px-4 file:text-sm file:font-semibold file:text-texto"
        />
        {!tengoClave && (
          <div className="space-y-2">
            <label htmlFor={ids.claveSubida} className="block text-xs font-semibold text-texto-tenue">
              Clave del PDF
            </label>
            <input
              id={ids.claveSubida}
              name="clave"
              type="password"
              autoComplete="off"
              maxLength={64}
              aria-invalid={errorDeClave ? true : undefined}
              className={CAMPO}
            />
            <label htmlFor={ids.recordar} className="flex cursor-pointer items-center gap-2 text-sm">
              <input id={ids.recordar} name="recordar" type="checkbox" defaultChecked className="size-4 cursor-pointer" />
              Recordarla para las próximas cartolas
            </label>
          </div>
        )}
        <button type="submit" disabled={subiendo} className={SECUNDARIO}>
          {subiendo ? "Leyendo…" : "Leer la cartola"}
        </button>
        <Mensaje estado={estadoSubida} />
      </form>

      {leidas.length > 0 && (
        <div className="space-y-1 border-t border-borde pt-3">
          <p className="text-xs font-semibold text-texto-tenue">Las que ya leyó</p>
          <ul className="space-y-1 text-xs leading-relaxed">
            {leidas.map((cartola) => (
              <li key={cartola.id}>
                <span className="font-semibold">
                  Del {fechaCorta(cartola.desde)} al {fechaCorta(cartola.hasta)}
                </span>{" "}
                <span className="text-texto-tenue">
                  · {cartola.cuenta ?? `Cuenta •••• ${cartola.ultimos4}`} · {cartola.filas} movimientos: {cartola.nuevas} por
                  revisar, {cartola.yaEstaban} ya estaban
                  {cartola.fuera > 0 ? `, ${cartola.fuera} fuera` : ""}. Cuadró con {cartola.banco}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
