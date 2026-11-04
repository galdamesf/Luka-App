import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { correosAutorizados, estaAutorizado } from "@/lib/autorizados";
import {
  ahoraEnSegundos,
  SEGUNDOS_SIN_USO,
  sellarSesion,
  sesionVigente,
} from "@/lib/sesion";

// La marca de este arranque del servidor (la pone next.config.ts).
const ARRANQUE = process.env.LUKA_ARRANQUE ?? "";

/**
 * El ingreso de Luka: Google y nada mas.
 *
 * - No hay registro ni contrasenas propias: la cuenta de Google ES la
 *   identidad, como en Vitalia. Las credenciales (AUTH_GOOGLE_ID,
 *   AUTH_GOOGLE_SECRET, AUTH_SECRET) viven solo en el .env; next-auth las
 *   lee por su nombre sin que haya que pasarlas aqui.
 * - Solo entran los correos de CORREOS_AUTORIZADOS. La app es de la casa:
 *   no existe "crear una cuenta". Cualquier otro Google valido rebota con
 *   AccessDenied y la pantalla de ingreso lo dice en castellano.
 * - La sesion va en JWT (cookie firmada), no en la base de datos: la base
 *   guarda la plata del mes, no sesiones, y asi el middleware puede decidir
 *   sin tocar Prisma.
 * - La sesion es corta a proposito (ver src/lib/sesion.ts): 30 minutos sin
 *   uso, 8 horas como maximo, y se corta al volver a arrancar el servidor.
 * - Google pregunta siempre con que cuenta entrar, en vez de pasar derecho
 *   con la que este abierta en el navegador.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ authorization: { params: { prompt: "select_account" } } }),
  ],
  session: { strategy: "jwt", maxAge: SEGUNDOS_SIN_USO },
  pages: {
    signIn: "/ingresar",
    error: "/ingresar",
  },
  callbacks: {
    signIn({ profile }) {
      return estaAutorizado(
        profile?.email,
        correosAutorizados(process.env.CORREOS_AUTORIZADOS),
      );
    },
    // Al entrar se sella el token con la hora y el arranque; en cada visita
    // se revisa el sello. Devolver null borra la cookie: la sesion se acaba.
    jwt({ token, trigger }) {
      if (trigger === "signIn" || trigger === "signUp") {
        return { ...token, ...sellarSesion(ahoraEnSegundos(), ARRANQUE) };
      }
      return sesionVigente(token, ahoraEnSegundos(), ARRANQUE) ? token : null;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
