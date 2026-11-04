"use server";

import { signIn } from "@/auth";

/**
 * La entrada desde la portada: el mismo ingreso que el boton de /ingresar,
 * sin pasar por esa pantalla. Lo que no sale bien vuelve igual: Auth.js manda
 * los errores a /ingresar (pages.error en auth.ts), que los explica, y un
 * correo que Google no confirmo llega alli con ?error=AccessDenied.
 */
export async function entrarConGoogle() {
  // ?bienvenida=1 hace que el panel salude al llegar (y solo esta vez).
  await signIn("google", { redirectTo: "/?bienvenida=1" });
}
