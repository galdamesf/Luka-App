import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

/*
  La marca de este arranque del servidor. Cada `npm run dev` (o cada build)
  trae una nueva, y src/auth.ts deja sin efecto las sesiones abiertas con una
  marca anterior: al volver a correr la terminal, Luka parte en la portada y
  hay que entrar de nuevo con Google.

  Se guarda primero en process.env para que todos los procesos que levanta
  Next en un mismo arranque (el build usa varios) hereden la misma marca, y
  `env` la deja escrita igual en el middleware y en el servidor.
*/
process.env.LUKA_ARRANQUE ??= randomUUID();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    LUKA_ARRANQUE: process.env.LUKA_ARRANQUE,
  },
};

export default nextConfig;
