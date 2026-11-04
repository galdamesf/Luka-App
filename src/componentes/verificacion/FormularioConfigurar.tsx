"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { ESTADO_CON_CODIGOS, type EstadoConCodigos } from "@/dominio/dos-pasos";
import { CodigosDeRespaldo } from "./CodigosDeRespaldo";

type Props = {
  accion: (estado: EstadoConCodigos, datos: FormData) => Promise<EstadoConCodigos>;
  /** El QR ya dibujado en el servidor (SVG de src/lib/qr.ts). */
  qrSvg: string;
  /** El enlace otpauth://, para abrir la app directo desde el celular. */
  enlace: string;
  /** La clave agrupada de a 4, para escribirla a mano. */
  claveAgrupada: string;
  correo: string;
};

const PASO = "flex size-6 shrink-0 items-center justify-center rounded-full bg-acento text-xs font-bold text-acento-tinta";

/**
 * Configurar la app: escanear el QR (o escribir la clave), confirmar con el
 * primer codigo y guardar los codigos de respaldo. Al confirmar, el QR
 * desaparece y quedan los codigos, que se ven esta sola vez.
 */
export function FormularioConfigurar({ accion, qrSvg, enlace, claveAgrupada, correo }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_CON_CODIGOS);
  const idCampo = useId();
  const idError = useId();

  if (estado.ok && estado.codigos !== null) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl border border-exito/40 bg-exito/10 px-3 py-2.5 text-sm font-semibold">
          {estado.mensaje}
        </p>
        <div>
          <h2 className="text-base font-bold">Guarda tus códigos de respaldo</h2>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-texto-tenue">
            Si pierdes el celular, cada uno te deja entrar una vez en vez del código de la app.
          </p>
        </div>
        <CodigosDeRespaldo codigos={estado.codigos} correo={correo} />
        <Link href="/?bienvenida=1" className="boton-luka w-full">
          Ya los guardé: entrar a Luka
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-5">
        <li className="flex gap-3">
          <span className={PASO}>1</span>
          <p className="text-sm leading-relaxed text-pretty">
            Instala en tu celular <strong>Google Authenticator</strong> (o Microsoft Authenticator, 1Password u otra app
            de códigos).
          </p>
        </li>
        <li className="flex gap-3">
          <span className={PASO}>2</span>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm leading-relaxed text-pretty">En la app, toca «+» y escanea este código:</p>
            <div
              role="img"
              aria-label="Código QR para configurar la app"
              className="mx-auto w-full max-w-[240px] overflow-hidden rounded-xl border border-borde bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-xs leading-relaxed text-texto-tenue">
              ¿Estás en el celular?{" "}
              <a href={enlace} className="font-semibold enlace-luka">
                Abrir en la app
              </a>{" "}
              o escribe esta clave a mano:
            </p>
            <p className="cifra rounded-lg bg-superficie-tenue px-3 py-2 text-center text-sm font-semibold tracking-wider text-balance select-all">
              {claveAgrupada}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className={PASO}>3</span>
          <form action={enviar} className="min-w-0 flex-1 space-y-3">
            <label htmlFor={idCampo} className="block text-sm leading-relaxed">
              Escribe el código de 6 dígitos que muestra la app:
            </label>
            <input
              id={idCampo}
              name="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={9}
              placeholder="123 456"
              required
              aria-invalid={estado.mensaje !== null && !estado.ok}
              aria-describedby={estado.mensaje !== null ? idError : undefined}
              className="cifra w-full rounded-xl border border-borde bg-superficie px-3 py-3 text-center text-xl tracking-[0.25em] text-texto transition-colors placeholder:text-texto-tenue/50 hover:border-texto-tenue"
            />
            {estado.mensaje !== null && !estado.ok && (
              <p id={idError} role="alert" className="rounded-xl border border-peligro/40 bg-peligro/10 px-3 py-2.5 text-sm text-pretty">
                {estado.mensaje}
              </p>
            )}
            <button type="submit" disabled={enviando} className="boton-luka w-full cursor-pointer">
              {enviando ? "Revisando…" : "Confirmar"}
            </button>
          </form>
        </li>
      </ol>
    </div>
  );
}
