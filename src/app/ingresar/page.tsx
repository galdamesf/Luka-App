import type { Metadata } from "next";
import Link from "next/link";
import { Luka } from "@/componentes/Luka";
import { signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Entrar a Luka",
};

/**
 * La pantalla de ingreso: una sola puerta, la de Google.
 *
 * Es pantalla de sistema, no de campana: fondo del tema, una carta al
 * centro, el boton con las reglas de marca de Google (fondo blanco, su logo
 * tal cual, tipografia sobria) y la unica letra chica que importa: solo los
 * correos autorizados entran. Si Google devuelve a alguien que no esta en la
 * lista, llega aqui con ?error=AccessDenied y se le dice en castellano.
 */
export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-svh place-items-center bg-fondo px-6 py-10 text-texto">
      <div className="w-full max-w-sm rounded-3xl border border-borde bg-superficie p-7 text-center shadow-sm sm:p-9">
        <Luka pose="rastreando" descripcion={null} className="mx-auto h-24 w-auto" />
        <h1 className="font-marca mt-4 text-[1.6rem] leading-none font-extrabold tracking-[-0.03em]">
          Entra a Luka
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-texto-tenue">
          Tu mes, anotado y sumado. Todo vive en tu computador.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-peligro/40 bg-peligro/10 px-4 py-3 text-sm text-pretty"
          >
            {error === "AccessDenied"
              ? "Ese correo no está autorizado para entrar a esta app."
              : "No se pudo completar el ingreso. Inténtalo de nuevo."}
          </p>
        ) : null}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="boton-google w-full cursor-pointer">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continuar con Google
          </button>
        </form>

        <p className="mt-4 text-xs text-texto-tenue">
          Solo los correos autorizados pueden entrar.
        </p>
      </div>

      <Link
        href="/bienvenida"
        className="text-sm font-semibold text-texto-tenue underline-offset-4 hover:underline"
      >
        ← Volver a la portada
      </Link>
    </main>
  );
}
