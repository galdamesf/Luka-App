import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Entrar a Luka" };

/**
 * Marcador de posicion: la pantalla de ingreso se construye en la seccion
 * siguiente, con el proveedor de Google y la lista de correos permitidos.
 * Existe para que los botones de la portada no caigan en un 404.
 */
export default function Ingresar() {
  return (
    <main className="mx-auto grid min-h-[70svh] w-full max-w-md place-content-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-marca)" }}>
        Entrar a Luka
      </h1>
      <p className="text-texto-tenue">
        El ingreso con Google todavía no está conectado. Es lo que viene.
      </p>
      <Link href="/bienvenida" className="text-sm font-semibold underline underline-offset-4">
        Volver a la portada
      </Link>
    </main>
  );
}
