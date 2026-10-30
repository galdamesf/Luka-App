import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { correosAutorizados, estaAutorizado } from "@/lib/autorizados";

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
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
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
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
});
