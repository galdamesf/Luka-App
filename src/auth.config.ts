import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import {
  ahoraEnSegundos,
  hogarDelToken,
  SEGUNDOS_SIN_USO,
  tokenVigente,
  type HogarDeSesion,
} from "@/lib/sesion";

declare module "next-auth" {
  interface Session {
    /** Con que hogar entro la persona (ver src/lib/sesion.ts). */
    hogar?: HogarDeSesion | null;
  }
}

/** La marca de este arranque del servidor (la pone next.config.ts). */
export const ARRANQUE = process.env.LUKA_ARRANQUE ?? "";

/**
 * La parte del ingreso que NO toca la base de datos.
 *
 * La usa el middleware, que corre antes de cada pagina y no puede hablar con
 * Postgres: decide solo con la cookie firmada. src/auth.ts la extiende con lo
 * que si necesita la base (registrar la entrada y poner el hogar en la
 * sesion), y esa version es la que usan las paginas y el ingreso con Google.
 *
 * - No hay registro ni contrasenas propias: la cuenta de Google ES la
 *   identidad. Las credenciales (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
 *   AUTH_SECRET) viven solo en el .env; next-auth las lee por su nombre.
 * - La sesion va en JWT (cookie firmada), no en la base de datos.
 * - La sesion es corta a proposito (ver src/lib/sesion.ts): 30 minutos sin
 *   uso, 8 horas como maximo, y se corta al volver a arrancar el servidor.
 *   Ademas tiene que traer un hogar: sin hogar no hay nada que mostrar.
 * - Google pregunta siempre con que cuenta entrar, en vez de pasar derecho
 *   con la que este abierta en el navegador.
 */
export const configuracionBase = {
  providers: [Google({ authorization: { params: { prompt: "select_account" } } })],
  session: { strategy: "jwt", maxAge: SEGUNDOS_SIN_USO },
  pages: {
    signIn: "/ingresar",
    error: "/ingresar",
  },
  callbacks: {
    // En cada visita se revisa el sello y el hogar. Devolver null borra la
    // cookie: la sesion se acaba.
    jwt({ token }) {
      return tokenVigente(token, ahoraEnSegundos(), ARRANQUE) ? token : null;
    },
    session({ session, token }) {
      return { ...session, hogar: hogarDelToken(token) };
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
