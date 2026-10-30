import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * La app detras de la sesion.
 *
 * - Sin sesion, cualquier pagina de la app manda a /bienvenida: quien llega
 *   a localhost:3000 sin haber entrado ve la portada, no su plata.
 * - Con sesion, /bienvenida e /ingresar mandan a /: ya estas adentro, no hay
 *   nada que venderte ni puerta que cruzar.
 * - /api/auth queda fuera del matcher (es la puerta misma), igual que los
 *   archivos estaticos de Next.
 *
 * La decision usa solo la cookie firmada (sesion JWT): el middleware no toca
 * la base de datos.
 */
export default auth((peticion) => {
  const { pathname } = peticion.nextUrl;
  const conSesion = Boolean(peticion.auth?.user);
  const esPublica = pathname === "/bienvenida" || pathname === "/ingresar";

  if (!conSesion && !esPublica) {
    return NextResponse.redirect(new URL("/bienvenida", peticion.nextUrl));
  }
  if (conSesion && esPublica) {
    return NextResponse.redirect(new URL("/", peticion.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // Todo menos la puerta (/api/auth), lo estatico de Next y los archivos con
  // extension (iconos, imagenes, fuentes).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\..*).*)"],
};
