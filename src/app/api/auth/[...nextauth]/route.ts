/**
 * La puerta de next-auth: /api/auth/* (el ingreso con Google, el callback
 * que Google tiene autorizado, la salida). Todo esta definido en src/auth.ts;
 * aqui solo se publica.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
