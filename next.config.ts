import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

/*
  La marca de este arranque del servidor. Cada `npm run dev` (o cada build,
  que en la nube es cada despliegue) trae una nueva, y src/auth.config.ts deja sin efecto las sesiones abiertas
  con una marca anterior: al volver a correr la terminal, Luka parte en la
  portada y hay que entrar de nuevo con Google.

  Se guarda primero en process.env para que todos los procesos que levanta
  Next en un mismo arranque (el build usa varios) hereden la misma marca, y
  `env` la deja escrita igual en el middleware y en el servidor.
*/
process.env.LUKA_ARRANQUE ??= randomUUID();

/*
  Cabeceras de seguridad en todas las respuestas:
  - solo HTTPS (el navegador lo recuerda dos anos; en localhost no aplica);
  - nadie puede meter Luka dentro de otra pagina (contra el «clickjacking»);
  - el navegador no adivina tipos de archivo;
  - al seguir un enlace afuera solo se manda el dominio, no la direccion;
  - sin camara, microfono, ubicacion ni pagos desde la pagina (la foto de la
    boleta usa el selector de archivos, que no necesita permisos);
  - los formularios solo se envian a Luka, y el ingreso, a Google.
*/
const CABECERAS_DE_SEGURIDAD = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    LUKA_ARRANQUE: process.env.LUKA_ARRANQUE,
  },
  experimental: {
    serverActions: {
      // Next acepta 1 MB por formulario si no se dice otra cosa, y una foto
      // de celular pesa mas. 4,5 MB es lo maximo que deja pasar Vercel; las
      // boletas tienen tope de 4 MB (src/lib/boletas.ts).
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default nextConfig;
