import { miembroDeSesion, registrarEntrada } from "@/datos/hogares";
import { reglasDeEntrada } from "@/lib/autorizados";
import { ahoraEnSegundos, sellarSesion, type HogarDeSesion, type SelloSesion } from "@/lib/sesion";

/** Lo que importa del perfil que entrega Google. */
type PerfilDeGoogle = {
  email?: string | null;
  name?: string | null;
  email_verified?: unknown;
};

/**
 * El momento de entrar con Google (callback signIn de next-auth): registra la
 * entrada en la base y dice si la persona pasa. Si no pasa, next-auth la
 * devuelve a /ingresar con ?error=AccessDenied.
 */
export async function puedeEntrar(
  perfil: PerfilDeGoogle | undefined,
  entorno: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  // Google entrega correos verificados; si alguna vez no, no se entra.
  if (perfil?.email_verified === false) return false;
  const hogar = await registrarEntrada(
    { correo: perfil?.email, nombre: perfil?.name },
    reglasDeEntrada(entorno),
  );
  return hogar !== null;
}

/**
 * El token recien entrado (callback jwt, al entrar): se sella con la hora y
 * el arranque, y lleva el hogar que dejo registrado puedeEntrar. null si en la
 * base no aparece: sin hogar no hay sesion.
 */
export async function tokenDeEntrada<T extends { email?: string | null }>(
  token: T,
  arranque: string,
  ahora: number = ahoraEnSegundos(),
): Promise<(T & SelloSesion & HogarDeSesion) | null> {
  const hogar = await miembroDeSesion(token.email);
  if (hogar === null) return null;
  return { ...token, ...sellarSesion(ahora, arranque), ...hogar };
}
