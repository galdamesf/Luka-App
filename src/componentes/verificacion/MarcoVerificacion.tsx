import Link from "next/link";
import { Luka } from "@/componentes/Luka";
import { accionSalirSinVerificar } from "@/app/acciones/verificacion";

/** Los enlaces de abajo de la carta: discretos, como «Salir y entrar con otra cuenta». */
export const ENLACE_DE_ABAJO = "text-sm font-semibold text-texto-tenue underline-offset-4 hover:text-texto hover:underline";

type Props = {
  titulo: string;
  bajada: React.ReactNode;
  children: React.ReactNode;
  /** Configurar necesita mas ancho para el QR y los codigos. */
  ancho?: "angosto" | "ancho";
  /**
   * "entrada": parte de entrar a Luka («Paso 2 de 2», y abajo la salida para
   * entrar con otra cuenta). "hogar": activarla desde «Tu hogar», ya adentro
   * (abajo, la vuelta a «Tu hogar»).
   */
  desde?: "entrada" | "hogar";
  /** Lo que va abajo, junto a la salida: por ejemplo «Ahora no». */
  pie?: React.ReactNode;
};

/**
 * El marco del segundo paso: como la pantalla de ingreso (una carta al centro,
 * sin el navbar de la app, porque todavia no se entro) y, abajo, la salida
 * para quien quiere entrar con otra cuenta. Al activar la verificacion desde
 * «Tu hogar», abajo va la vuelta a «Tu hogar».
 */
export function MarcoVerificacion({ titulo, bajada, children, ancho = "angosto", desde = "entrada", pie }: Props) {
  return (
    <main className="grid min-h-svh place-items-center gap-4 bg-fondo px-4 py-10 text-texto sm:px-6">
      <div
        className={`w-full ${ancho === "ancho" ? "max-w-md" : "max-w-sm"} rounded-3xl border border-borde bg-superficie p-6 shadow-sm sm:p-8`}
      >
        <div className="text-center">
          <Luka pose="rastreando" descripcion={null} className="mx-auto h-20 w-auto" />
          {desde === "entrada" && (
            <p className="cifra mt-3 text-[11px] tracking-[0.08em] text-texto-tenue uppercase">Paso 2 de 2</p>
          )}
          <h1 className="font-marca mt-1 text-[1.45rem] leading-tight font-extrabold tracking-[-0.02em] text-balance">
            {titulo}
          </h1>
          <div className="mt-2 text-sm leading-relaxed text-pretty text-texto-tenue">{bajada}</div>
        </div>
        <div className="mt-6">{children}</div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {pie}
        {desde === "hogar" ? (
          <Link href="/hogar" className={ENLACE_DE_ABAJO}>
            Volver a «Tu hogar»
          </Link>
        ) : (
          <form action={accionSalirSinVerificar}>
            <button type="submit" className={`cursor-pointer ${ENLACE_DE_ABAJO}`}>
              Salir y entrar con otra cuenta
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
