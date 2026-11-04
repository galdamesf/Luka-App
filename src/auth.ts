import NextAuth from "next-auth";
import { ARRANQUE, configuracionBase } from "@/auth.config";
import { puedeEntrar, tokenDeEntrada } from "@/lib/ingreso";
import { sesionDelToken } from "@/lib/sesion";
import { olvidarSesion } from "@/datos/dos-pasos";

/**
 * El ingreso de Luka: Google y nada mas, con la persona dentro de un hogar.
 *
 * Es la configuracion base (src/auth.config.ts, la que usa el middleware)
 * mas lo que necesita la base de datos (src/lib/ingreso.ts):
 *
 * - Al entrar se decide a que hogar va la persona: el suyo si ya es miembro
 *   o tiene una invitacion, «Mi hogar» si es el primero de
 *   CORREOS_AUTORIZADOS y ese hogar sigue sin dueno, y si no, uno nuevo (la
 *   puerta esta abierta). Si Google no confirma su correo, rebota con
 *   AccessDenied y la pantalla de ingreso lo dice en castellano.
 * - El token se sella con la hora, el arranque, el hogar y un id de sesion.
 *   Cada pagina revisa despues contra la base que la persona siga en ese
 *   hogar y que esta sesion ya haya puesto el codigo de su app
 *   (src/lib/hogar-actual.ts).
 * - Al salir, la sesion deja de contar como verificada.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configuracionBase,
  callbacks: {
    ...configuracionBase.callbacks,
    signIn({ profile }) {
      return puedeEntrar(profile);
    },
    jwt(parametros) {
      const { token, trigger } = parametros;
      if (trigger === "signIn" || trigger === "signUp") return tokenDeEntrada(token, ARRANQUE);
      return configuracionBase.callbacks.jwt(parametros);
    },
  },
  events: {
    async signOut(mensaje) {
      const token = "token" in mensaje ? mensaje.token : null;
      if (token) await olvidarSesion(sesionDelToken(token));
    },
  },
});
