import { Luka } from "@/componentes/Luka";
import { accionSalirSinVerificar } from "@/app/acciones/verificacion";

type Props = {
  titulo: string;
  bajada: React.ReactNode;
  children: React.ReactNode;
  /** Configurar necesita mas ancho para el QR y los codigos. */
  ancho?: "angosto" | "ancho";
};

/**
 * El marco del segundo paso: como la pantalla de ingreso (una carta al centro,
 * sin el navbar de la app, porque todavia no se entro) y, abajo, la salida
 * para quien quiere entrar con otra cuenta.
 */
export function MarcoVerificacion({ titulo, bajada, children, ancho = "angosto" }: Props) {
  return (
    <main className="grid min-h-svh place-items-center gap-4 bg-fondo px-4 py-10 text-texto sm:px-6">
      <div
        className={`w-full ${ancho === "ancho" ? "max-w-md" : "max-w-sm"} rounded-3xl border border-borde bg-superficie p-6 shadow-sm sm:p-8`}
      >
        <div className="text-center">
          <Luka pose="rastreando" descripcion={null} className="mx-auto h-20 w-auto" />
          <p className="cifra mt-3 text-[11px] tracking-[0.08em] text-texto-tenue uppercase">Paso 2 de 2</p>
          <h1 className="font-marca mt-1 text-[1.45rem] leading-tight font-extrabold tracking-[-0.02em] text-balance">
            {titulo}
          </h1>
          <div className="mt-2 text-sm leading-relaxed text-pretty text-texto-tenue">{bajada}</div>
        </div>
        <div className="mt-6">{children}</div>
      </div>

      <form action={accionSalirSinVerificar}>
        <button
          type="submit"
          className="cursor-pointer text-sm font-semibold text-texto-tenue underline-offset-4 hover:text-texto hover:underline"
        >
          Salir y entrar con otra cuenta
        </button>
      </form>
    </main>
  );
}
