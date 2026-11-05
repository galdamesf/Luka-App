import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DOS_PASOS, RUTA_CONFIGURAR, RUTA_VERIFICAR } from "@/dominio/dos-pasos";
import { RUTA_SESION_TERMINADA, leerAcceso } from "@/lib/hogar-actual";
import { MarcoVerificacion } from "@/componentes/verificacion/MarcoVerificacion";
import { accionAhoraNo } from "../../acciones/verificacion";

export const metadata: Metadata = {
  title: "Verificación en dos pasos · Luka",
};

export const dynamic = "force-dynamic";

/**
 * La pregunta al entrar por primera vez: si activa la verificacion en dos
 * pasos, que es opcional. «Activarla ahora» lleva a configurar la app; «Ahora
 * no» entra solo con Google, y Luka no lo vuelve a preguntar. Como las demas
 * paginas del segundo paso, no pide hogarActual(): revisa con leerAcceso()
 * que a la persona le toque elegir.
 */
export default async function ElegirDosPasos() {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion") redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.estado === "listo") redirect("/");

  return (
    <MarcoVerificacion
      titulo="¿Activas la verificación en dos pasos?"
      bajada={
        <p>
          Es opcional. Si la activas, para entrar a Luka vas a usar Google y un código de {DOS_PASOS.digitos} dígitos de
          una app de tu celular, como Google Authenticator. Así, aunque alguien entre a tu cuenta de Google, no puede ver
          tu hogar sin tu celular.
        </p>
      }
    >
      <div className="space-y-3">
        <Link href={RUTA_CONFIGURAR} className="boton-luka w-full">
          Activarla ahora
        </Link>
        <form action={accionAhoraNo}>
          <button
            type="submit"
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
          >
            Ahora no
          </button>
        </form>
        <p className="text-center text-xs leading-relaxed text-pretty text-texto-tenue">
          Puedes activarla o desactivarla cuando quieras en «Tu hogar».
        </p>
      </div>
    </MarcoVerificacion>
  );
}
