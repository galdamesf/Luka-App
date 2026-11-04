import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Cierra la sesion de quien ya no es parte del hogar con que entro y lo
 * manda a la pantalla de ingreso, que le explica que paso.
 *
 * Es una ruta y no una pagina porque cerrar la sesion borra la cookie, y una
 * pagina no puede escribir cookies mientras se dibuja.
 */
export async function GET() {
  await signOut({ redirectTo: "/ingresar?error=SinHogar" });
}
